import { NextRequest, NextResponse } from "next/server";
import { runWeeklyMatching } from "@/lib/matching/engine";
import { getWeekIdentifier } from "@/lib/utils/date-classifier";
import { fetchStatusOverrides } from "@/lib/clients/google-sheets";
import { prisma } from "@/lib/clients/db";

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

    // 1. Sync status overrides from Google Sheet (only update changed rows)
    const overrides = await fetchStatusOverrides(weekIdentifier);
    let overrideCount = 0;
    if (overrides.length > 0) {
      const dbOpportunities = await prisma.newsletterOpportunity.findMany({
        where: { id: { in: overrides.map((o) => o.opportunityId) } },
        select: { id: true, status: true },
      });
      const dbStatusMap = new Map(dbOpportunities.map((o) => [o.id, o.status]));

      for (const override of overrides) {
        if (dbStatusMap.get(override.opportunityId) !== override.status) {
          await prisma.newsletterOpportunity.update({
            where: { id: override.opportunityId },
            data: { status: override.status },
          });
          overrideCount++;
        }
      }
    }
    if (overrideCount > 0) {
      console.log(`Applied ${overrideCount} status overrides from Sheet`);
    }

    // 2. Auto-expire opportunities past their defaultExpiry
    const expired = await prisma.newsletterOpportunity.updateMany({
      where: {
        status: "active",
        defaultExpiry: { lt: new Date() },
      },
      data: { status: "expired" },
    });
    if (expired.count > 0) {
      console.log(`Auto-expired ${expired.count} past-due opportunities`);
    }

    // 3. Run matching (engine queries DB for active opportunities)
    const result = await runWeeklyMatching(weekIdentifier);

    return NextResponse.json({
      message: "Cron: weekly matching completed",
      overridesApplied: overrideCount,
      autoExpired: expired.count,
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
