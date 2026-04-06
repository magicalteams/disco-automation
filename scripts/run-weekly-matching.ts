/**
 * Weekly opportunity matching — runs as a standalone script via GitHub Actions.
 * No Vercel timeout constraints. Uses Sonnet for higher quality matching.
 *
 * Usage: npx tsx scripts/run-weekly-matching.ts
 *
 * Environment variables:
 *   ANTHROPIC_API_KEY — required
 *   DATABASE_URL — required
 *   DIRECT_URL — required
 *   SLACK_BOT_TOKEN — required (for posting results)
 *   SLACK_CHANNEL_MATCHES — required (fallback channel)
 *   DRY_RUN — set to "true" for dry-run mode (no DB writes, no Slack posts)
 *   MATCH_CONFIDENCE_THRESHOLD — override threshold (default: 0.6)
 */
import { PrismaClient } from "@prisma/client";
import { callClaude, getModelId } from "../src/lib/clients/anthropic";
import { buildFullMatchingPrompt } from "../src/lib/prompts/match-opportunities";
import {
  BatchMatchResponseSchema,
  LenientBatchMatchResponseSchema,
  type LenientMatchOutput,
} from "../src/schemas/match-result";
import {
  formatMatchesToSlack,
  formatPartnerMatchesToSlack,
  postSlackMessage,
  postMatchThreadReplies,
  type ThreadReplyResult,
} from "../src/lib/slack/formatter";
import { syncAndExpireOpportunities } from "../src/lib/matching/pre-match-sync";
import { getWeekIdentifier } from "../src/lib/utils/date-classifier";

const prisma = new PrismaClient();
const BATCH_SIZE = 4; // Partners per Claude call (for prompt size, not timeout)
const DEFAULT_THRESHOLD = parseFloat(process.env.MATCH_CONFIDENCE_THRESHOLD || "0.6");

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

async function main() {
  const dryRun = process.env.DRY_RUN === "true";
  const threshold = DEFAULT_THRESHOLD;
  const weekIdentifier = getWeekIdentifier(new Date());

  console.log(`\nWeekly Matching — ${weekIdentifier}`);
  console.log(`======================================`);
  console.log(`Model: Sonnet`);
  console.log(`Threshold: ${threshold}`);
  console.log(`Dry run: ${dryRun}\n`);

  // 1. Sync sheet overrides and auto-expire
  console.log("Syncing sheet overrides and expiring past-due opportunities...");
  const sync = await syncAndExpireOpportunities(weekIdentifier);
  console.log(`  ${sync.overrideCount} overrides applied, ${sync.expiredCount} auto-expired\n`);

  // 2. Fetch all active, unexpired opportunities (across all weeks)
  const allOpportunities = await prisma.newsletterOpportunity.findMany({
    where: {
      status: "active",
      defaultExpiry: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  // 3. Apply global exclusions
  const exclusions = await prisma.globalExclusion.findMany();
  const opportunities = allOpportunities.filter((opp) => {
    const titleLower = opp.title.toLowerCase();
    const excluded = exclusions.find((ex) => titleLower.includes(ex.pattern.toLowerCase()));
    if (excluded) {
      console.log(`  Excluding "${opp.title}" (matches: "${excluded.pattern}")`);
    }
    return !excluded;
  });

  console.log(`${opportunities.length} active opportunities (${allOpportunities.length - opportunities.length} excluded)\n`);

  if (opportunities.length === 0) {
    console.log("No active opportunities to match. Exiting.");
    return;
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
    orderBy: { name: "asc" },
  });

  console.log(`${partners.length} partner profiles loaded\n`);

  if (partners.length === 0) {
    console.log("No partner profiles found. Exiting.");
    return;
  }

  // 5. Fetch existing resolved matches to skip (shared or skipped)
  const resolvedMatches = await prisma.matchResult.findMany({
    where: {
      reactionStatus: { in: ["shared", "skipped"] },
      opportunity: { status: "active", defaultExpiry: { gt: new Date() } },
    },
    select: { opportunityId: true, partnerId: true },
  });

  const resolvedSet = new Set(
    resolvedMatches.map((r) => `${r.opportunityId}:${r.partnerId}`)
  );
  console.log(`${resolvedSet.size} already-resolved matches will be skipped\n`);

  // 6. Create match run record
  const modelId = getModelId("sonnet");
  let matchRun: { id: string } | null = null;

  if (!dryRun) {
    // Check for existing completed run this week
    const existing = await prisma.matchRun.findUnique({
      where: { weekIdentifier },
    });
    if (existing?.status === "completed") {
      console.log(`Match run for ${weekIdentifier} already completed. Use /match reset first.`);
      return;
    }

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
    const allMatches: ResolvedMatch[] = [];
    const totalBatches = Math.ceil(partners.length / BATCH_SIZE);

    // 7. Process partners in batches (sequential, no chaining needed)
    for (let i = 0; i < partners.length; i += BATCH_SIZE) {
      const batchPartners = partners.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE);

      console.log(`Batch ${batchNum}/${totalBatches - 1}: matching against ${batchPartners.length} partners...`);

      const batchMatches = await matchBatch(opportunities, batchPartners, partners, threshold);

      // Filter out already-resolved matches
      const newMatches = batchMatches.filter(
        (m) => !resolvedSet.has(`${m.opportunityId}:${m.partnerId}`)
      );

      const skipped = batchMatches.length - newMatches.length;
      if (skipped > 0) {
        console.log(`  ${skipped} already-resolved matches skipped`);
      }

      console.log(`  ${newMatches.length} new matches found\n`);
      allMatches.push(...newMatches);

      // Save progressively to DB
      if (!dryRun && matchRun && newMatches.length > 0) {
        await prisma.matchResult.createMany({
          data: newMatches.map((m) => ({
            opportunityId: m.opportunityId,
            partnerId: m.partnerId,
            confidenceScore: m.confidenceScore,
            rationale: m.rationale,
            clientFacingLanguage: m.clientFacingLanguage,
            outreachDraftEmail: m.outreachDraftEmail ?? null,
            matchRunId: matchRun.id,
          })),
        });
      }
    }

    // 8. Finalize match run
    if (!dryRun && matchRun) {
      await prisma.matchRun.update({
        where: { id: matchRun.id },
        data: {
          status: "completed",
          matchCount: allMatches.length,
          completedAt: new Date(),
        },
      });
    }

    // 9. Post to Slack
    if (!dryRun && allMatches.length > 0) {
      console.log("Posting results to Slack...");
      await postMatchesToSlack(allMatches, opportunities, partners);
      console.log("Slack posting complete.\n");
    }

    // 10. Summary
    const uniquePartners = new Set(allMatches.map((m) => m.partnerName));
    console.log(`======================================`);
    console.log(`Matching Complete${dryRun ? " (DRY RUN)" : ""}`);
    console.log(`  Opportunities: ${opportunities.length}`);
    console.log(`  Partners:      ${partners.length}`);
    console.log(`  Matches:       ${allMatches.length}`);
    console.log(`  Partners matched: ${uniquePartners.size}`);
    console.log();

    if (dryRun && allMatches.length > 0) {
      console.log("Dry-run matches:");
      for (const m of allMatches) {
        console.log(`  ${m.partnerName} → ${m.opportunityTitle} (${m.confidenceScore.toFixed(2)})`);
      }
    }
  } catch (error) {
    if (!dryRun && matchRun) {
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
// Matching logic (uses Sonnet, no timeout pressure)
// ---------------------------------------------------------------------------

async function matchBatch(
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
    model: "sonnet",
    maxTokens: 8192,
  });

  let jsonStr = rawResponse.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  // Parse leniently, retry incomplete matches
  const lenientParsed = LenientBatchMatchResponseSchema.safeParse(JSON.parse(jsonStr));
  if (!lenientParsed.success) {
    throw new Error(`Failed to parse match response: ${lenientParsed.error.message}`);
  }

  const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const oppByTitle = new Map(
    opportunities.map((o) => [normalize(o.title), o])
  );

  const matches: ResolvedMatch[] = [];
  const incompleteMatches: Array<{
    match: LenientMatchOutput;
    opp: typeof opportunities[0];
    partner: typeof batchPartners[0];
  }> = [];

  for (const match of lenientParsed.data.matches) {
    if (match.confidenceScore < threshold) continue;

    const oppTitle = normalize(match.opportunityTitle);
    const opp =
      oppByTitle.get(oppTitle) ??
      opportunities.find((o) => oppTitle.startsWith(normalize(o.title)));
    if (!opp) {
      console.warn(`  Opportunity "${match.opportunityTitle}" not found, skipping`);
      continue;
    }

    const matchName = normalize(match.partnerName);
    const partner = allPartners.find((p) => {
      const dbName = normalize(p.name);
      return dbName === matchName || matchName.startsWith(dbName);
    });
    if (!partner) {
      console.warn(`  Partner "${match.partnerName}" not found, skipping`);
      continue;
    }

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
      const batchPartner = batchPartners.find((p) => p.id === partner.id);
      if (batchPartner) {
        incompleteMatches.push({ match, opp, partner: batchPartner });
      }
    }
  }

  // Retry incomplete matches with a focused 1:1 call
  if (incompleteMatches.length > 0) {
    console.log(`  Retrying ${incompleteMatches.length} incomplete match(es)...`);

    for (const { opp, partner } of incompleteMatches) {
      try {
        const retryResult = await retrySingleMatch(opp, partner, threshold);
        if (retryResult) {
          matches.push(retryResult);
          console.log(`  Retry succeeded: ${partner.name} → ${opp.title}`);
        }
      } catch (err) {
        console.error(`  Retry failed for ${partner.name} → ${opp.title}:`, err);
      }
    }
  }

  return matches;
}

async function retrySingleMatch(
  opp: { title: string; category: string; description: string; industries: string[]; relevantFor: string; dateDisplayText: string; contactMethod: string; sourceUrl: string | null; audienceRestrictions: string; id: string },
  partner: { id: string; name: string; company: string; matchingSummary: string; geographicFocus: string[]; matchingNotes: string | null },
  threshold: number
): Promise<ResolvedMatch | null> {
  const { system, user } = buildFullMatchingPrompt(
    [{ title: opp.title, category: opp.category, description: opp.description, industries: opp.industries, relevantFor: opp.relevantFor, dateDisplayText: opp.dateDisplayText, contactMethod: opp.contactMethod, sourceUrl: opp.sourceUrl, audienceRestrictions: opp.audienceRestrictions }],
    [{ name: partner.name, company: partner.company, matchingSummary: partner.matchingSummary, geographicFocus: partner.geographicFocus, matchingNotes: partner.matchingNotes }],
    threshold
  );

  const rawResponse = await callClaude(user, { system, model: "sonnet", maxTokens: 2048 });

  let jsonStr = rawResponse.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = BatchMatchResponseSchema.safeParse(JSON.parse(jsonStr));
  if (!parsed.success || parsed.data.matches.length === 0) return null;

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
// Slack posting (reuses formatter functions)
// ---------------------------------------------------------------------------

async function postMatchesToSlack(
  allMatches: ResolvedMatch[],
  opportunities: Array<{ id: string; title: string; category: string; description: string; dateDisplayText: string; dateConfidence: string; sourceUrl: string | null; newsletterIssue: string; newsletterDate: Date; [key: string]: unknown }>,
  partners: Array<{ name: string; company: string; slackChannelId?: string | null }>
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

  // Save Slack message timestamps for reaction tracking
  for (const tr of allThreadResults) {
    await prisma.matchResult.updateMany({
      where: {
        opportunityId: tr.opportunityId,
        partner: { name: tr.partnerName },
        slackMessageTs: null,
      },
      data: {
        slackMessageTs: tr.messageTs,
        slackChannelId: tr.channel,
      },
    });
  }
}

// ---------------------------------------------------------------------------

main()
  .catch((e) => {
    console.error("Weekly matching failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
