import { NextRequest, NextResponse } from "next/server";
import { getWeekIdentifier } from "@/lib/utils/date-classifier";
import {
  getOpportunityCountForWeek,
  getSheetUrl,
} from "@/lib/clients/google-sheets";
import { formatSheetReminder, postSlackMessage } from "@/lib/slack/formatter";

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const weekIdentifier = getWeekIdentifier(new Date());
    console.log(`Cron triggered: sheet reminder for ${weekIdentifier}`);

    const opportunityCount = await getOpportunityCountForWeek(weekIdentifier);

    if (opportunityCount === 0) {
      return NextResponse.json({
        message: `No opportunities found for ${weekIdentifier}, skipping reminder`,
        weekIdentifier,
        opportunityCount: 0,
      });
    }

    const sheetUrl = getSheetUrl();
    const blocks = formatSheetReminder(sheetUrl, weekIdentifier, opportunityCount);
    await postSlackMessage(blocks);

    return NextResponse.json({
      message: `Reminder sent: ${opportunityCount} opportunities for ${weekIdentifier}`,
      weekIdentifier,
      opportunityCount,
    });
  } catch (error) {
    console.error("Cron sheet reminder failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reminder failed" },
      { status: 500 }
    );
  }
}
