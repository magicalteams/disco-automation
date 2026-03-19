import { NextRequest, NextResponse } from "next/server";
import { runWeeklyMatching } from "@/lib/matching/engine";
import { getWeekIdentifier } from "@/lib/utils/date-classifier";
import { validateApiKey } from "@/lib/utils/api-auth";

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const weekIdentifier =
      body.weekIdentifier || getWeekIdentifier(new Date());

    console.log(`Starting weekly matching for ${weekIdentifier}...`);
    const result = await runWeeklyMatching(weekIdentifier, {
      thresholdOverride: body.threshold,
      skipSlack: body.skipSlack,
      dryRun: body.dryRun,
    });

    return NextResponse.json({
      message: body.dryRun ? "Dry-run matching completed" : "Weekly matching completed",
      ...result,
    });
  } catch (error) {
    console.error("Weekly matching failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Matching failed" },
      { status: 500 }
    );
  }
}
