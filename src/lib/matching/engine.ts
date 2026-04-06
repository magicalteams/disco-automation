import { prisma } from "@/lib/clients/db";
import { callClaude, getModelId } from "@/lib/clients/anthropic";
import { buildFullMatchingPrompt } from "@/lib/prompts/match-opportunities";
import {
  BatchMatchResponseSchema,
  LenientBatchMatchResponseSchema,
  type LenientMatchOutput,
} from "@/schemas/match-result";
import {
  formatMatchesToSlack,
  formatPartnerMatchesToSlack,
  postSlackMessage,
  postMatchThreadReplies,
  type ThreadReplyResult,
} from "@/lib/slack/formatter";

const DEFAULT_THRESHOLD = parseFloat(process.env.MATCH_CONFIDENCE_THRESHOLD || "0.6");
const BATCH_SIZE = 4; // Partners per Claude call — keeps each call under ~30s with 15+ opportunities

export interface MatchRunOptions {
  /** Override the confidence threshold (default: env var or 0.6) */
  thresholdOverride?: number;
  /** Skip posting results to Slack */
  skipSlack?: boolean;
  /** Dry-run: return results without writing to DB or Slack */
  dryRun?: boolean;
}

interface MatchRunSummary {
  runId: string;
  weekIdentifier: string;
  opportunitiesScanned: number;
  matchesFound: number;
  partnersMatched: number;
  scoreDistribution?: {
    high: number;
    medium: number;
    low: number;
  };
  matches?: Array<{
    opportunityTitle: string;
    partnerName: string;
    company: string;
    confidenceScore: number;
    rationale: string;
    clientFacingLanguage: string;
    outreachDraftEmail?: string;
  }>;
}

// --- Match data type used across functions ---

interface ResolvedMatch {
  opportunityId: string;
  opportunityTitle: string;
  partnerId: string;
  partnerName: string;
  confidenceScore: number;
  rationale: string;

  clientFacingLanguage: string;
  outreachDraftEmail?: string;
}

// ---------------------------------------------------------------------------
// Entry point — called by /match command, cron, and API
// ---------------------------------------------------------------------------

export async function runWeeklyMatching(
  weekIdentifier: string,
  options: MatchRunOptions = {}
): Promise<MatchRunSummary> {
  const threshold = options.thresholdOverride ?? DEFAULT_THRESHOLD;

  // 1. Check for existing completed run (skip in dry-run mode)
  const existing = await prisma.matchRun.findUnique({
    where: { weekIdentifier },
  });
  if (existing?.status === "completed" && !options.dryRun) {
    throw new Error(`Match run for ${weekIdentifier} already completed`);
  }

  // 2. Fetch active opportunities for this week
  const opportunities = await prisma.newsletterOpportunity.findMany({
    where: { weekIdentifier, status: "active" },
  });
  if (opportunities.length === 0) {
    throw new Error(`No active opportunities found for ${weekIdentifier}`);
  }

  // 3. Filter out globally excluded opportunities
  const exclusions = await prisma.globalExclusion.findMany();
  const filteredOpportunities = opportunities.filter((opp) => {
    const titleLower = opp.title.toLowerCase();
    const excluded = exclusions.find((ex) => titleLower.includes(ex.pattern.toLowerCase()));
    if (excluded) {
      console.log(`Excluding "${opp.title}" (matches exclusion: "${excluded.pattern}")`);
    }
    return !excluded;
  });

  if (filteredOpportunities.length === 0) {
    throw new Error(`All opportunities for ${weekIdentifier} were excluded or inactive`);
  }

  // 4. Fetch all partner profiles
  const partners = await prisma.partnerProfile.findMany({
    select: {
      id: true,
      name: true,
      company: true,
      matchingSummary: true,
      geographicFocus: true,
      matchingNotes: true,
      slackChannelId: true,
    },
    orderBy: { name: "asc" }, // Deterministic order for batching
  });
  if (partners.length === 0) {
    throw new Error("No partner profiles found in database");
  }

  const totalBatches = Math.ceil(partners.length / BATCH_SIZE);
  const needsChaining = totalBatches > 1 && !options.dryRun;

  // 4. Create or update the match run record (skip in dry-run mode)
  const modelId = getModelId("haiku");
  let matchRun: { id: string } | null = null;
  if (!options.dryRun) {
    matchRun = existing
      ? await prisma.matchRun.update({
          where: { weekIdentifier },
          data: {
            status: "running",
            opportunityCount: opportunities.length,
            matchCount: 0,
            model: modelId,
            startedAt: new Date(),
            completedAt: null,
            errorMessage: null,
          },
        })
      : await prisma.matchRun.create({
          data: {
            weekIdentifier,
            status: "running",
            opportunityCount: opportunities.length,
            model: modelId,
          },
        });
  }

  try {
    // 5. Process batch 0
    const batch0Partners = partners.slice(0, BATCH_SIZE);
    console.log(
      `Batch 0/${totalBatches - 1}: matching ${filteredOpportunities.length} opportunities against ${batch0Partners.length} partners (${opportunities.length - filteredOpportunities.length} excluded)...`
    );

    const batch0Matches = await matchPartnersAgainstOpportunities(
      filteredOpportunities,
      batch0Partners,
      partners,
      threshold
    );

    // 6. Save batch 0 results to DB
    if (!options.dryRun && matchRun) {
      await saveBatchResults(matchRun.id, batch0Matches);
    }

    // 7. If more batches needed and not dry-run, chain via internal fetch
    if (needsChaining && matchRun) {
      // Trigger batch 1 — it will chain the rest
      await triggerNextBatch(matchRun.id, weekIdentifier, 1);

      // Return partial summary (full results will be posted by the last batch)
      return {
        runId: matchRun.id,
        weekIdentifier,
        opportunitiesScanned: opportunities.length,
        matchesFound: batch0Matches.length,
        partnersMatched: new Set(batch0Matches.map((m) => m.partnerName)).size,
      };
    }

    // 8. Single batch (or dry-run) — complete everything here
    if (!options.dryRun && matchRun) {
      await prisma.matchRun.update({
        where: { id: matchRun.id },
        data: {
          status: "completed",
          matchCount: batch0Matches.length,
          completedAt: new Date(),
        },
      });
    }

    // 9. Post to Slack if single batch
    if (!options.dryRun && !options.skipSlack) {
      await postMatchesToSlack(batch0Matches, filteredOpportunities, partners);
    }

    const summary: MatchRunSummary = {
      runId: matchRun?.id ?? "dry-run",
      weekIdentifier,
      opportunitiesScanned: opportunities.length,
      matchesFound: batch0Matches.length,
      partnersMatched: new Set(batch0Matches.map((m) => m.partnerName)).size,
      scoreDistribution: computeScoreDistribution(batch0Matches),
    };

    if (options.dryRun) {
      summary.matches = batch0Matches.map((m) => ({
        opportunityTitle: m.opportunityTitle,
        partnerName: m.partnerName,
        company: partners.find((p) => p.id === m.partnerId)?.company ?? "",
        confidenceScore: m.confidenceScore,
        rationale: m.rationale,
        clientFacingLanguage: m.clientFacingLanguage,
        outreachDraftEmail: m.outreachDraftEmail,
      }));
    }

    return summary;
  } catch (error) {
    if (!options.dryRun && matchRun) {
      await prisma.matchRun.update({
        where: { id: matchRun.id },
        data: {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      });
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Process a single batch — called by /api/match/continue
// ---------------------------------------------------------------------------

export async function processMatchBatch(
  matchRunId: string,
  weekIdentifier: string,
  batchIndex: number
): Promise<{ matchesInBatch: number; hasMore: boolean }> {
  const threshold = DEFAULT_THRESHOLD;

  const opportunities = await prisma.newsletterOpportunity.findMany({
    where: { weekIdentifier, status: "active" },
  });

  // Apply global exclusions
  const exclusions = await prisma.globalExclusion.findMany();
  const filteredOpportunities = opportunities.filter((opp) => {
    const titleLower = opp.title.toLowerCase();
    return !exclusions.some((ex) => titleLower.includes(ex.pattern.toLowerCase()));
  });

  const allPartners = await prisma.partnerProfile.findMany({
    select: {
      id: true,
      name: true,
      company: true,
      matchingSummary: true,
      geographicFocus: true,
      matchingNotes: true,
      slackChannelId: true,
    },
    orderBy: { name: "asc" },
  });

  const totalBatches = Math.ceil(allPartners.length / BATCH_SIZE);
  const batchPartners = allPartners.slice(
    batchIndex * BATCH_SIZE,
    (batchIndex + 1) * BATCH_SIZE
  );

  if (batchPartners.length === 0) {
    await finalizeBatchRun(matchRunId);
    await triggerNextBatch(matchRunId, weekIdentifier, -1, "post");
    return { matchesInBatch: 0, hasMore: false };
  }

  console.log(
    `Batch ${batchIndex}/${totalBatches - 1}: matching ${filteredOpportunities.length} opportunities against ${batchPartners.length} partners...`
  );

  try {
    const matches = await matchPartnersAgainstOpportunities(
      filteredOpportunities,
      batchPartners,
      allPartners,
      threshold
    );

    await saveBatchResults(matchRunId, matches);

    const isLastBatch = batchIndex >= totalBatches - 1;

    if (isLastBatch) {
      // Finalize the run and trigger Slack posting
      await finalizeBatchRun(matchRunId);
      await triggerNextBatch(matchRunId, weekIdentifier, -1, "post");
      return { matchesInBatch: matches.length, hasMore: false };
    } else {
      // Chain next batch
      await triggerNextBatch(matchRunId, weekIdentifier, batchIndex + 1);
      return { matchesInBatch: matches.length, hasMore: true };
    }
  } catch (error) {
    await prisma.matchRun.update({
      where: { id: matchRunId },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Post all match results to Slack — called by /api/match/continue phase=post
// ---------------------------------------------------------------------------

export async function postMatchResultsToSlack(
  matchRunId: string,
  weekIdentifier: string
): Promise<void> {
  const matchResults = await prisma.matchResult.findMany({
    where: { matchRunId },
    include: {
      partner: { select: { name: true, company: true, slackChannelId: true } },
      opportunity: true,
    },
  });

  if (matchResults.length === 0) {
    console.log("No match results to post to Slack");
    return;
  }

  const opportunities = await prisma.newsletterOpportunity.findMany({
    where: { weekIdentifier, status: "active" },
  });

  // Reconstruct the match data format the formatter expects
  const allMatches: ResolvedMatch[] = matchResults.map((r) => ({
    opportunityId: r.opportunityId,
    opportunityTitle: r.opportunity.title,
    partnerId: r.partnerId,
    partnerName: r.partner.name,
    confidenceScore: r.confidenceScore,
    rationale: r.rationale,
    clientFacingLanguage: r.clientFacingLanguage,
    outreachDraftEmail: r.outreachDraftEmail ?? undefined,
  }));

  // Build partner info with channel mappings
  const partnerMap = new Map(
    matchResults.map((r) => [
      r.partner.name,
      {
        name: r.partner.name,
        company: r.partner.company,
        slackChannelId: r.partner.slackChannelId,
      },
    ])
  );
  const partners = [...partnerMap.values()];

  await postMatchesToSlack(allMatches, opportunities, partners);
}

// ---------------------------------------------------------------------------
// Shared: Claude matching for a batch of partners
// ---------------------------------------------------------------------------

async function matchPartnersAgainstOpportunities(
  opportunities: Array<{
    id: string;
    title: string;
    category: string;
    description: string;
    industries: string[];
    relevantFor: string;
    dateDisplayText: string;
    contactMethod: string;
    sourceUrl: string | null;
    audienceRestrictions: string;
  }>,
  batchPartners: Array<{
    id: string;
    name: string;
    company: string;
    matchingSummary: string;
    geographicFocus: string[];
    matchingNotes: string | null;
  }>,
  allPartners: Array<{
    id: string;
    name: string;
    company: string;
    matchingSummary: string;
  }>,
  threshold: number
): Promise<ResolvedMatch[]> {
  const { system, user } = buildFullMatchingPrompt(
    opportunities.map((opp) => ({
      title: opp.title,
      category: opp.category,
      description: opp.description,
      industries: opp.industries,
      relevantFor: opp.relevantFor,
      dateDisplayText: opp.dateDisplayText,
      contactMethod: opp.contactMethod,
      sourceUrl: opp.sourceUrl,
      audienceRestrictions: opp.audienceRestrictions,
    })),
    batchPartners.map((p) => ({
      name: p.name,
      company: p.company,
      matchingSummary: p.matchingSummary,
      geographicFocus: p.geographicFocus,
      matchingNotes: p.matchingNotes,
    })),
    threshold
  );

  const rawResponse = await callClaude(user, {
    system,
    model: "haiku",
    maxTokens: 8192,
    retries: 0,
  });

  let jsonStr = rawResponse.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  // Parse leniently first — allows missing text fields so we can retry just those
  const lenientParsed = LenientBatchMatchResponseSchema.safeParse(JSON.parse(jsonStr));
  if (!lenientParsed.success) {
    throw new Error(`Failed to parse match response: ${lenientParsed.error.message}`);
  }

  const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const oppByTitle = new Map(
    opportunities.map((o) => [normalize(o.title), o])
  );

  const matches: ResolvedMatch[] = [];
  const incompleteMatches: Array<{ match: LenientMatchOutput; opp: typeof opportunities[0]; partner: typeof batchPartners[0] }> = [];

  for (const match of lenientParsed.data.matches) {
    if (match.confidenceScore < threshold) continue;

    const oppTitle = normalize(match.opportunityTitle);
    const opp =
      oppByTitle.get(oppTitle) ??
      opportunities.find((o) => oppTitle.startsWith(normalize(o.title)));
    if (!opp) {
      console.warn(`Opportunity "${match.opportunityTitle}" not found, skipping`);
      continue;
    }

    const matchName = normalize(match.partnerName);
    const partner = allPartners.find((p) => {
      const dbName = normalize(p.name);
      return dbName === matchName || matchName.startsWith(dbName);
    });
    if (!partner) {
      console.warn(
        `Partner "${match.partnerName}" not found (normalized: "${matchName}"), skipping. ` +
          `Available: ${allPartners.map((p) => p.name).join(", ")}`
      );
      continue;
    }

    // Check if all required fields are present
    if (match.rationale && match.clientFacingLanguage) {
      matches.push({
        opportunityId: opp.id,
        opportunityTitle: opp.title,
        partnerId: partner.id,
        partnerName: partner.name,
        confidenceScore: match.confidenceScore,
        rationale: match.rationale,
        clientFacingLanguage: match.clientFacingLanguage,
        outreachDraftEmail: match.outreachDraftEmail,
      });
    } else {
      console.warn(
        `Incomplete match: ${match.partnerName} → ${match.opportunityTitle} (missing: ${!match.rationale ? "rationale " : ""}${!match.clientFacingLanguage ? "clientFacingLanguage" : ""}). Queuing for retry.`
      );
      const batchPartner = batchPartners.find((p) => p.id === partner.id);
      if (batchPartner) {
        incompleteMatches.push({ match, opp, partner: batchPartner });
      }
    }
  }

  // Retry incomplete matches individually — smaller prompt = Haiku won't truncate
  if (incompleteMatches.length > 0) {
    console.log(`Retrying ${incompleteMatches.length} incomplete match(es)...`);

    for (const { match, opp, partner } of incompleteMatches) {
      try {
        const retryResult = await retrySingleMatch(opp, partner, threshold);
        if (retryResult) {
          matches.push(retryResult);
          console.log(`Retry succeeded: ${partner.name} → ${opp.title}`);
        } else {
          console.warn(`Retry returned no match: ${partner.name} → ${opp.title}`);
        }
      } catch (err) {
        console.error(`Retry failed for ${partner.name} → ${opp.title}:`, err);
      }
    }
  }

  return matches;
}

/**
 * Retry a single match that was incomplete in the batch response.
 * Sends just one opportunity + one partner to Claude — tiny prompt, reliable output.
 */
async function retrySingleMatch(
  opp: { id: string; title: string; category: string; description: string; industries: string[]; relevantFor: string; dateDisplayText: string; contactMethod: string; sourceUrl: string | null; audienceRestrictions: string },
  partner: { id: string; name: string; company: string; matchingSummary: string; geographicFocus: string[]; matchingNotes: string | null },
  threshold: number
): Promise<ResolvedMatch | null> {
  const { system, user } = buildFullMatchingPrompt(
    [{ title: opp.title, category: opp.category, description: opp.description, industries: opp.industries, relevantFor: opp.relevantFor, dateDisplayText: opp.dateDisplayText, contactMethod: opp.contactMethod, sourceUrl: opp.sourceUrl, audienceRestrictions: opp.audienceRestrictions }],
    [{ name: partner.name, company: partner.company, matchingSummary: partner.matchingSummary, geographicFocus: partner.geographicFocus, matchingNotes: partner.matchingNotes }],
    threshold
  );

  const rawResponse = await callClaude(user, {
    system,
    model: "haiku",
    maxTokens: 2048,
    retries: 0,
  });

  let jsonStr = rawResponse.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = BatchMatchResponseSchema.safeParse(JSON.parse(jsonStr));
  if (!parsed.success || parsed.data.matches.length === 0) {
    return null;
  }

  const m = parsed.data.matches[0];
  return {
    opportunityId: opp.id,
    opportunityTitle: opp.title,
    partnerId: partner.id,
    partnerName: partner.name,
    confidenceScore: m.confidenceScore,
    rationale: m.rationale,
    clientFacingLanguage: m.clientFacingLanguage,
    outreachDraftEmail: m.outreachDraftEmail,
  };
}

// ---------------------------------------------------------------------------
// Shared: Save batch results to DB
// ---------------------------------------------------------------------------

async function saveBatchResults(
  matchRunId: string,
  matches: ResolvedMatch[]
): Promise<void> {
  if (matches.length === 0) return;

  await prisma.matchResult.createMany({
    data: matches.map((m) => ({
      opportunityId: m.opportunityId,
      partnerId: m.partnerId,
      confidenceScore: m.confidenceScore,
      rationale: m.rationale,
      clientFacingLanguage: m.clientFacingLanguage,
      outreachDraftEmail: m.outreachDraftEmail ?? null,
      matchRunId,
    })),
  });
}

// ---------------------------------------------------------------------------
// Shared: Finalize match run as completed
// ---------------------------------------------------------------------------

async function finalizeBatchRun(matchRunId: string): Promise<void> {
  const totalMatches = await prisma.matchResult.count({
    where: { matchRunId },
  });

  await prisma.matchRun.update({
    where: { id: matchRunId },
    data: {
      status: "completed",
      matchCount: totalMatches,
      completedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Shared: Post matches to Slack (per-channel routing + thread replies)
// ---------------------------------------------------------------------------

async function postMatchesToSlack(
  allMatches: ResolvedMatch[],
  opportunities: Array<{
    id: string;
    title: string;
    category: string;
    description: string;
    dateDisplayText: string;
    dateConfidence: string;
    sourceUrl: string | null;
    newsletterIssue: string;
    newsletterDate: Date;
    [key: string]: unknown;
  }>,
  partners: Array<{
    name: string;
    company: string;
    slackChannelId?: string | null;
  }>
): Promise<void> {
  const partnerByName = new Map(partners.map((p) => [p.name, p]));
  const matchesByChannel = new Map<string, ResolvedMatch[]>();
  const fallbackChannel = process.env.SLACK_CHANNEL_MATCHES || "";

  for (const match of allMatches) {
    const partner = partnerByName.get(match.partnerName);
    const channel = partner?.slackChannelId || fallbackChannel;
    const existing = matchesByChannel.get(channel) || [];
    existing.push(match);
    matchesByChannel.set(channel, existing);
  }

  const allThreadResults: ThreadReplyResult[] = [];

  for (const [channel, channelMatches] of matchesByChannel) {
    const channelPartnerNames = new Set(channelMatches.map((m) => m.partnerName));
    const channelPartners = partners.filter((p) => channelPartnerNames.has(p.name));

    // Type-cast opportunities for the formatter (it expects full NewsletterOpportunity)
    const opps = opportunities as Parameters<typeof formatPartnerMatchesToSlack>[0];

    if (channelPartners.length === 1) {
      const partner = channelPartners[0];
      const blocks = formatPartnerMatchesToSlack(opps, channelMatches, {
        name: partner.name,
        company: partner.company,
      });
      const parentTs = await postSlackMessage(blocks, channel);

      if (parentTs && channelMatches.length > 0) {
        const threadResults = await postMatchThreadReplies(parentTs, channel, channelMatches, opps);
        allThreadResults.push(...threadResults);
      }
    } else {
      const blocks = formatMatchesToSlack(
        opps,
        channelMatches,
        channelPartners.map((p) => ({ name: p.name, company: p.company }))
      );
      const parentTs = await postSlackMessage(blocks, channel);

      if (parentTs && channelMatches.length > 0) {
        const threadResults = await postMatchThreadReplies(parentTs, channel, channelMatches, opps);
        allThreadResults.push(...threadResults);
      }
    }
  }

  // Save Slack message timestamps to MatchResults for reaction tracking
  if (allThreadResults.length > 0) {
    for (const tr of allThreadResults) {
      await prisma.matchResult.updateMany({
        where: {
          opportunityId: tr.opportunityId,
          partner: { name: tr.partnerName },
          slackMessageTs: null, // Only update if not already set
        },
        data: {
          slackMessageTs: tr.messageTs,
          slackChannelId: tr.channel,
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Shared: Trigger next batch via internal fetch
// ---------------------------------------------------------------------------

async function triggerNextBatch(
  matchRunId: string,
  weekIdentifier: string,
  batchIndex: number,
  phase?: "post"
): Promise<void> {
  const appUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.APP_URL || "http://localhost:3000";

  const body = phase
    ? { matchRunId, weekIdentifier, phase }
    : { matchRunId, weekIdentifier, batchIndex };

  console.log(
    phase
      ? `Triggering Slack posting for ${weekIdentifier}`
      : `Triggering batch ${batchIndex} for ${weekIdentifier}`
  );

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    // Vercel Deployment Protection blocks unauthenticated requests.
    // The bypass secret allows internal automation calls through.
    const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (bypassSecret) {
      headers["x-vercel-protection-bypass"] = bypassSecret;
    }

    // Use a short timeout so we confirm the request was accepted but don't
    // wait for the full response (which would block until the next batch finishes).
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${appUrl}/api/match/continue`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    }).catch((err: Error) => {
      // AbortError is expected — it means the request was sent and we timed out
      // waiting for the response, which is exactly what we want.
      if (err.name === "AbortError") return null;
      throw err;
    });

    clearTimeout(timeout);
    console.log(`Triggered next step — status ${res?.status ?? "sent (response pending)"}`);
  } catch (err) {
    console.error("Failed to trigger next batch:", err);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeScoreDistribution(matches: ResolvedMatch[]) {
  return {
    high: matches.filter((m) => m.confidenceScore >= 0.8).length,
    medium: matches.filter((m) => m.confidenceScore >= 0.6 && m.confidenceScore < 0.8).length,
    low: matches.filter((m) => m.confidenceScore < 0.6).length,
  };
}
