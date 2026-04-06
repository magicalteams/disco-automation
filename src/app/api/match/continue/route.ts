import { NextRequest, NextResponse } from "next/server";
import { processMatchBatch, postMatchResultsToSlack } from "@/lib/matching/engine";

export const maxDuration = 60;

/**
 * Internal endpoint for batch-chaining weekly matching.
 * Each invocation processes one batch of partners or posts results to Slack.
 * Protected by CRON_SECRET to prevent external access.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { matchRunId, weekIdentifier, batchIndex, phase } = body;

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
