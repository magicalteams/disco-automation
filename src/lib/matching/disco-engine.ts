import { prisma } from "@/lib/clients/db";
import { callClaude, getModelId } from "@/lib/clients/anthropic";
import {
  getTranscript,
  getTranscriptSummary,
} from "@/lib/clients/fireflies";
import { buildTranscriptExtractionPrompt } from "@/lib/prompts/extract-transcript";
import {
  buildNeedsToOpportunitiesPrompt,
  buildOffersToPartnersPrompt,
} from "@/lib/prompts/match-disco";
import {
  TranscriptExtractionSchema,
  NeedToOpportunityResponseSchema,
  OfferToPartnerResponseSchema,
  type TranscriptExtraction,
  type NeedToOpportunityMatch,
  type OfferToPartnerMatch,
} from "@/schemas/disco-transcript";

const DEFAULT_THRESHOLD = parseFloat(
  process.env.MATCH_CONFIDENCE_THRESHOLD || "0.6"
);

export interface DiscoMatchOptions {
  thresholdOverride?: number;
  skipSlack?: boolean;
  dryRun?: boolean;
}

export interface DiscoMatchSummary {
  processedMeetingId: string;
  meetingTitle: string;
  primaryPerson: { name: string; company: string | null; role: string | null };
  extraction: TranscriptExtraction;
  needToOpportunityMatches: NeedToOpportunityMatch[];
  offerToPartnerMatches: OfferToPartnerMatch[];
}

function parseJsonResponse(raw: string): unknown {
  let jsonStr = raw.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(jsonStr);
}

/**
 * Process a Fireflies transcript: fetch, extract, match bidirectionally.
 * Returns existing results if the transcript was already processed (idempotent).
 */
export async function processAndMatchTranscript(
  transcriptId: string,
  options: DiscoMatchOptions = {}
): Promise<DiscoMatchSummary> {
  const threshold = options.thresholdOverride ?? DEFAULT_THRESHOLD;

  // 1. Check for existing completed processing (idempotency)
  const existing = await prisma.processedMeeting.findUnique({
    where: { firefliesTranscriptId: transcriptId },
    include: { discoMatchResults: true },
  });

  if (existing?.status === "completed" && existing.extractedData) {
    const extraction = TranscriptExtractionSchema.parse(existing.extractedData);
    return {
      processedMeetingId: existing.id,
      meetingTitle: existing.meetingTitle,
      primaryPerson: extraction.primaryPerson,
      extraction,
      needToOpportunityMatches: existing.discoMatchResults
        .filter((r) => r.direction === "need_to_opportunity")
        .map((r) => ({
          needIndex: 0, // Not stored in DB — approximate
          opportunityId: r.targetId,
          opportunityTitle: "",
          confidenceScore: r.confidenceScore,
          rationale: r.rationale,
          clientFacingLanguage: r.clientFacingLanguage,
        })),
      offerToPartnerMatches: existing.discoMatchResults
        .filter((r) => r.direction === "offer_to_partner")
        .map((r) => ({
          offerIndex: 0,
          partnerName: r.targetId,
          confidenceScore: r.confidenceScore,
          rationale: r.rationale,
          clientFacingLanguage: r.clientFacingLanguage,
        })),
    };
  }

  // 2. Fetch transcript + summary from Fireflies
  const [transcript, summary] = await Promise.all([
    getTranscript(transcriptId),
    getTranscriptSummary(transcriptId).catch(() => null),
  ]);

  const transcriptText = transcript.sentences
    .map((s) => `${s.speaker_name}: ${s.text}`)
    .join("\n");

  const meetingDate = new Date(transcript.date);
  const modelId = getModelId("sonnet");

  // 3. Create ProcessedMeeting record
  const processedMeeting = existing
    ? await prisma.processedMeeting.update({
        where: { firefliesTranscriptId: transcriptId },
        data: {
          status: "processing",
          errorMessage: null,
          model: modelId,
        },
      })
    : await prisma.processedMeeting.create({
        data: {
          firefliesTranscriptId: transcriptId,
          meetingTitle: transcript.title,
          meetingDate: meetingDate,
          participants: transcript.participants,
          transcriptText,
          status: "processing",
          model: modelId,
        },
      });

  try {
    // 4. Extract needs/offers/intro-worthiness via Claude
    const enrichedTranscript = summary
      ? `${transcriptText}\n\n--- MEETING SUMMARY ---\nKeywords: ${summary.keywords.join(", ")}\nAction items: ${summary.action_items.join("; ")}\nOverview: ${summary.overview}`
      : transcriptText;

    const { system, user } = buildTranscriptExtractionPrompt(
      enrichedTranscript,
      {
        title: transcript.title,
        date: meetingDate.toISOString().split("T")[0],
        participants: transcript.participants,
      }
    );

    const rawExtraction = await callClaude(user, {
      system,
      model: "sonnet",
      maxTokens: 4096,
    });

    const extraction = TranscriptExtractionSchema.parse(
      parseJsonResponse(rawExtraction)
    );

    // 5. Store extracted data
    await prisma.processedMeeting.update({
      where: { id: processedMeeting.id },
      data: { extractedData: extraction as object },
    });

    // 6. Direction 1: Needs → Active Opportunities
    const needToOppMatches: NeedToOpportunityMatch[] = [];

    if (extraction.needs.length > 0) {
      const opportunities = await prisma.newsletterOpportunity.findMany({
        where: {
          status: "active",
          defaultExpiry: { gt: new Date() },
        },
      });

      if (opportunities.length > 0) {
        const { system: nSystem, user: nUser } =
          buildNeedsToOpportunitiesPrompt(
            extraction.needs,
            opportunities.map((o) => ({
              id: o.id,
              title: o.title,
              category: o.category,
              description: o.description,
              industries: o.industries,
              dateDisplayText: o.dateDisplayText,
              contactMethod: o.contactMethod,
            })),
            threshold
          );

        const rawNeedMatches = await callClaude(nUser, {
          system: nSystem,
          model: "sonnet",
          maxTokens: 4096,
        });

        const parsed = NeedToOpportunityResponseSchema.safeParse(
          parseJsonResponse(rawNeedMatches)
        );

        if (parsed.success) {
          for (const m of parsed.data.matches) {
            if (m.confidenceScore >= threshold) {
              needToOppMatches.push(m);
            }
          }
        } else {
          console.error(
            "Failed to parse need→opportunity matches:",
            parsed.error.message
          );
        }
      }
    }

    // 7. Direction 2: Offers → Partner Profiles
    const offerToPartnerMatches: OfferToPartnerMatch[] = [];

    if (extraction.offers.length > 0) {
      const partners = await prisma.partnerProfile.findMany({
        select: {
          id: true,
          name: true,
          company: true,
          matchingSummary: true,
        },
      });

      if (partners.length > 0) {
        const { system: oSystem, user: oUser } = buildOffersToPartnersPrompt(
          extraction.offers,
          partners.map((p) => ({
            name: p.name,
            company: p.company,
            matchingSummary: p.matchingSummary,
          })),
          threshold
        );

        const rawOfferMatches = await callClaude(oUser, {
          system: oSystem,
          model: "sonnet",
          maxTokens: 4096,
        });

        const parsed = OfferToPartnerResponseSchema.safeParse(
          parseJsonResponse(rawOfferMatches)
        );

        if (parsed.success) {
          for (const m of parsed.data.matches) {
            if (m.confidenceScore >= threshold) {
              // Resolve partner name to ID
              const normalize = (s: string) =>
                s.trim().replace(/\s+/g, " ").toLowerCase();
              const partner = partners.find(
                (p) => normalize(p.name) === normalize(m.partnerName)
              );
              if (!partner) {
                console.warn(
                  `Partner "${m.partnerName}" not found, skipping disco match`
                );
                continue;
              }
              offerToPartnerMatches.push(m);
            }
          }
        } else {
          console.error(
            "Failed to parse offer→partner matches:",
            parsed.error.message
          );
        }
      }
    }

    // 8. Write match results to DB (skip in dry-run)
    if (!options.dryRun) {
      const allResults = [
        ...needToOppMatches.map((m) => ({
          processedMeetingId: processedMeeting.id,
          direction: "need_to_opportunity" as const,
          sourceStatement: extraction.needs[m.needIndex]?.statement ?? "",
          targetId: m.opportunityId,
          confidenceScore: m.confidenceScore,
          rationale: m.rationale,
          clientFacingLanguage: m.clientFacingLanguage,
        })),
        ...offerToPartnerMatches.map((m) => {
          const partners_list = offerToPartnerMatches; // already filtered
          const normalize = (s: string) =>
            s.trim().replace(/\s+/g, " ").toLowerCase();
          // Re-resolve partner ID for storage
          // We need the partners list — fetch from closure
          return {
            processedMeetingId: processedMeeting.id,
            direction: "offer_to_partner" as const,
            sourceStatement: extraction.offers[m.offerIndex]?.statement ?? "",
            targetId: m.partnerName, // Store name as targetId for offer→partner
            confidenceScore: m.confidenceScore,
            rationale: m.rationale,
            clientFacingLanguage: m.clientFacingLanguage,
          };
        }),
      ];

      await prisma.$transaction(async (tx) => {
        if (allResults.length > 0) {
          await tx.discoMatchResult.createMany({ data: allResults });
        }

        await tx.processedMeeting.update({
          where: { id: processedMeeting.id },
          data: {
            status: "completed",
            processedAt: new Date(),
          },
        });
      });
    } else {
      // Dry-run: still mark as completed but without match results
      await prisma.processedMeeting.update({
        where: { id: processedMeeting.id },
        data: {
          status: "completed",
          processedAt: new Date(),
        },
      });
    }

    return {
      processedMeetingId: processedMeeting.id,
      meetingTitle: transcript.title,
      primaryPerson: extraction.primaryPerson,
      extraction,
      needToOpportunityMatches: needToOppMatches,
      offerToPartnerMatches: offerToPartnerMatches,
    };
  } catch (error) {
    // Mark as failed
    await prisma.processedMeeting.update({
      where: { id: processedMeeting.id },
      data: {
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
