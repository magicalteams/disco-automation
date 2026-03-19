import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/utils/api-auth";
import {
  processAndMatchTranscript,
  type DiscoMatchOptions,
} from "@/lib/matching/disco-engine";
import {
  formatDiscoMatchesToSlack,
  postSlackMessage,
} from "@/lib/slack/formatter";

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    if (!body.transcriptId || typeof body.transcriptId !== "string") {
      return NextResponse.json(
        { error: "transcriptId is required" },
        { status: 400 }
      );
    }

    const options: DiscoMatchOptions = {
      thresholdOverride: body.threshold,
      skipSlack: body.skipSlack ?? false,
      dryRun: body.dryRun ?? false,
    };

    console.log(
      `Processing disco matching for transcript ${body.transcriptId}...`
    );

    const summary = await processAndMatchTranscript(
      body.transcriptId,
      options
    );

    // Post to Slack unless suppressed
    if (!options.dryRun && !options.skipSlack) {
      const blocks = formatDiscoMatchesToSlack({
        summary,
        needs: summary.extraction.needs,
        offers: summary.extraction.offers,
      });
      await postSlackMessage(blocks);
    }

    return NextResponse.json({
      message: options.dryRun
        ? "Dry-run disco matching completed"
        : "Disco matching completed",
      processedMeetingId: summary.processedMeetingId,
      meetingTitle: summary.meetingTitle,
      primaryPerson: summary.primaryPerson,
      needToOpportunityMatches: summary.needToOpportunityMatches.length,
      offerToPartnerMatches: summary.offerToPartnerMatches.length,
      ...(options.dryRun
        ? {
            needMatches: summary.needToOpportunityMatches,
            offerMatches: summary.offerToPartnerMatches,
            extraction: summary.extraction,
          }
        : {}),
    });
  } catch (error) {
    console.error("Disco matching failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Disco matching failed",
      },
      { status: 500 }
    );
  }
}
