import { NextRequest, NextResponse } from "next/server";
import { runWeeklyMatching } from "@/lib/matching/engine";
import { syncAndExpireOpportunities } from "@/lib/matching/pre-match-sync";
import { getWeekIdentifier } from "@/lib/utils/date-classifier";

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const weekIdentifier = getWeekIdentifier(new Date());
    console.log(`Cron triggered: weekly matching for ${weekIdentifier}`);

    // 1. Sync sheet overrides and auto-expire past-due opportunities
    const sync = await syncAndExpireOpportunities(weekIdentifier);

    // 2. Run matching (engine queries DB for active opportunities)
    const result = await runWeeklyMatching(weekIdentifier);

    return NextResponse.json({
      message: "Cron: weekly matching completed",
      overridesApplied: sync.overrideCount,
      autoExpired: sync.expiredCount,
      ...result,
    });
  } catch (error) {
    console.error("Cron weekly matching failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron matching failed" },
      { status: 500 }
    );
  }
}
