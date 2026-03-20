import { prisma } from "@/lib/clients/db";
import { callClaude, getModelId } from "@/lib/clients/anthropic";
import { buildBatchMatchingPrompt } from "@/lib/prompts/match-opportunities";
import { BatchMatchResponseSchema } from "@/schemas/match-result";
import { formatMatchesToSlack, postSlackMessage } from "@/lib/slack/formatter";

const DEFAULT_THRESHOLD = parseFloat(process.env.MATCH_CONFIDENCE_THRESHOLD || "0.6");

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
  /** Score distribution buckets for quality analysis */
  scoreDistribution?: {
    high: number;   // >= 0.8
    medium: number; // 0.6 - 0.79
    low: number;    // < 0.6
  };
  /** Detailed match data (included in dry-run mode) */
  matches?: Array<{
    opportunityTitle: string;
    partnerName: string;
    company: string;
    confidenceScore: number;
    rationale: string;
    internalLanguage: string;
    clientFacingLanguage: string;
    outreachDraftEmail?: string;
  }>;
}

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
    where: {
      weekIdentifier,
      status: "active",
    },
  });

  if (opportunities.length === 0) {
    throw new Error(`No active opportunities found for ${weekIdentifier}`);
  }

  // 3. Fetch all partner profiles
  const partners = await prisma.partnerProfile.findMany({
    select: {
      id: true,
      name: true,
      company: true,
      matchingSummary: true,
    },
  });

  if (partners.length === 0) {
    throw new Error("No partner profiles found in database");
  }

  // 4. Create or update the match run record (skip in dry-run mode)
  const modelId = getModelId("sonnet");
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
    const allMatches: Array<{
      opportunityId: string;
      opportunityTitle: string;
      partnerId: string;
      partnerName: string;
      confidenceScore: number;
      rationale: string;
      internalLanguage: string;
      clientFacingLanguage: string;
      outreachDraftEmail?: string;
    }> = [];

    // 5. Match all opportunities in parallel (stay within Hobby 60s limit)
    const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

    const matchTasks = opportunities.map(async (opp) => {
      console.log(`Matching: "${opp.title}" against ${partners.length} partners...`);

      const { system, user } = buildBatchMatchingPrompt(
        {
          title: opp.title,
          category: opp.category,
          description: opp.description,
          industries: opp.industries,
          relevantFor: opp.relevantFor,
          dateDisplayText: opp.dateDisplayText,
          contactMethod: opp.contactMethod,
          sourceUrl: opp.sourceUrl,
        },
        partners.map((p) => ({
          name: p.name,
          company: p.company,
          matchingSummary: p.matchingSummary,
        })),
        threshold
      );

      try {
        const rawResponse = await callClaude(user, { system, model: "sonnet", maxTokens: 4096 });

        // Parse JSON from response (handle potential markdown fences)
        let jsonStr = rawResponse.trim();
        if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }

        const parsed = BatchMatchResponseSchema.safeParse(JSON.parse(jsonStr));
        if (!parsed.success) {
          console.error(`Failed to parse matches for "${opp.title}":`, parsed.error.message);
          return [];
        }

        // Resolve partner names to IDs and filter by threshold
        const oppMatches: typeof allMatches = [];
        for (const match of parsed.data.matches) {
          if (match.confidenceScore < threshold) continue;

          const matchName = normalize(match.partnerName);
          const partner = partners.find((p) => {
            const dbName = normalize(p.name);
            return dbName === matchName || matchName.startsWith(dbName);
          });
          if (!partner) {
            console.warn(
              `Partner "${match.partnerName}" not found in database (normalized: "${matchName}"), skipping. ` +
              `Available: ${partners.map((p) => p.name).join(", ")}`
            );
            continue;
          }

          oppMatches.push({
            opportunityId: opp.id,
            opportunityTitle: opp.title,
            partnerId: partner.id,
            partnerName: match.partnerName,
            confidenceScore: match.confidenceScore,
            rationale: match.rationale,
            internalLanguage: match.internalLanguage,
            clientFacingLanguage: match.clientFacingLanguage,
            outreachDraftEmail: match.outreachDraftEmail,
          });
        }
        return oppMatches;
      } catch (err) {
        console.error(`Matching failed for "${opp.title}":`, err);
        return [];
      }
    });

    const results = await Promise.all(matchTasks);
    for (const oppMatches of results) {
      allMatches.push(...oppMatches);
    }

    // 6. Compute quality metrics
    const uniquePartners = new Set(allMatches.map((m) => m.partnerName));
    const scoreDistribution = {
      high: allMatches.filter((m) => m.confidenceScore >= 0.8).length,
      medium: allMatches.filter((m) => m.confidenceScore >= 0.6 && m.confidenceScore < 0.8).length,
      low: allMatches.filter((m) => m.confidenceScore < 0.6).length,
    };

    // 7. Write all matches to DB in a transaction (skip in dry-run mode)
    if (!options.dryRun && matchRun) {
      await prisma.$transaction(async (tx) => {
        if (allMatches.length > 0) {
          await tx.matchResult.createMany({
            data: allMatches.map((m) => ({
              opportunityId: m.opportunityId,
              partnerId: m.partnerId,
              confidenceScore: m.confidenceScore,
              rationale: m.rationale,
              internalLanguage: m.internalLanguage,
              clientFacingLanguage: m.clientFacingLanguage,
              matchRunId: matchRun.id,
            })),
          });
        }

        // 8. Update match run as completed
        await tx.matchRun.update({
          where: { id: matchRun.id },
          data: {
            status: "completed",
            matchCount: allMatches.length,
            completedAt: new Date(),
          },
        });
      });
    }

    // 9. Post to Slack (skip in dry-run or skipSlack mode)
    if (!options.dryRun && !options.skipSlack) {
      const slackBlocks = formatMatchesToSlack(
        opportunities,
        allMatches,
        partners.map((p) => ({ name: p.name, company: p.company }))
      );
      await postSlackMessage(slackBlocks);
    }

    const summary: MatchRunSummary = {
      runId: matchRun?.id ?? "dry-run",
      weekIdentifier,
      opportunitiesScanned: opportunities.length,
      matchesFound: allMatches.length,
      partnersMatched: uniquePartners.size,
      scoreDistribution,
    };

    // Include detailed matches in dry-run mode for review
    if (options.dryRun) {
      summary.matches = allMatches.map((m) => ({
        opportunityTitle: m.opportunityTitle,
        partnerName: m.partnerName,
        company: partners.find((p) => p.id === m.partnerId)?.company ?? "",
        confidenceScore: m.confidenceScore,
        rationale: m.rationale,
        internalLanguage: m.internalLanguage,
        clientFacingLanguage: m.clientFacingLanguage,
        outreachDraftEmail: m.outreachDraftEmail,
      }));
    }

    return summary;
  } catch (error) {
    // Mark run as failed (skip in dry-run mode)
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
