import { NextRequest, NextResponse } from "next/server";
import { processMatchBatch, postMatchResultsToSlack } from "@/lib/matching/engine";
import { prisma } from "@/lib/clients/db";

export const maxDuration = 60;

/**
 * Internal endpoint for batch-chaining weekly matching.
 * Each invocation processes one batch of partners or posts results to Slack.
 * Validated by confirming the matchRunId exists in the database.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchRunId, weekIdentifier, batchIndex, phase } = body;

    if (!matchRunId || !weekIdentifier) {
      return NextResponse.json({ error: "Missing matchRunId or weekIdentifier" }, { status: 400 });
    }

    // Validate this is a real match run
    const matchRun = await prisma.matchRun.findUnique({ where: { id: matchRunId } });
    if (!matchRun) {
      return NextResponse.json({ error: "Invalid matchRunId" }, { status: 403 });
    }

    if (phase === "post") {
      console.log(`Batch chain: posting results for ${weekIdentifier}`);
      await postMatchResultsToSlack(matchRunId, weekIdentifier);
      return NextResponse.json({ message: "Slack posting completed" });
    }

    console.log(`Batch chain: processing batch ${batchIndex} for ${weekIdentifier}`);
    const result = await processMatchBatch(matchRunId, weekIdentifier, batchIndex);

    return NextResponse.json({
      message: `Batch ${batchIndex} completed`,
      matchesInBatch: result.matchesInBatch,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error("Match continue failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Continue failed" },
      { status: 500 }
    );
  }
}
