import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/clients/db";
import { getWeekIdentifier } from "@/lib/utils/date-classifier";

/**
 * POST /api/match/reset
 *
 * Resets a completed match run for a given week, deleting all associated
 * match results. This allows re-running matching after tuning prompts
 * or thresholds.
 *
 * Body: { weekIdentifier?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const weekIdentifier =
      body.weekIdentifier || getWeekIdentifier(new Date());

    const matchRun = await prisma.matchRun.findUnique({
      where: { weekIdentifier },
    });

    if (!matchRun) {
      return NextResponse.json(
        { error: `No match run found for ${weekIdentifier}` },
        { status: 404 }
      );
    }

    // Delete match results first (FK constraint), then the run
    const deletedResults = await prisma.matchResult.deleteMany({
      where: { matchRunId: matchRun.id },
    });

    await prisma.matchRun.delete({
      where: { id: matchRun.id },
    });

    return NextResponse.json({
      message: `Reset match run for ${weekIdentifier}`,
      deletedResults: deletedResults.count,
      previousStatus: matchRun.status,
      previousMatchCount: matchRun.matchCount,
    });
  } catch (error) {
    console.error("Match reset failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reset failed" },
      { status: 500 }
    );
  }
}
