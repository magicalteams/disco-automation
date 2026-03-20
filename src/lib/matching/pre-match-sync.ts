import { fetchStatusOverrides } from "@/lib/clients/google-sheets";
import { prisma } from "@/lib/clients/db";

interface SyncResult {
  overrideCount: number;
  expiredCount: number;
}

/**
 * Sync status overrides from Google Sheet and auto-expire past-due
 * opportunities. Run this before weekly matching to ensure the DB
 * reflects any manual review changes.
 */
export async function syncAndExpireOpportunities(
  weekIdentifier: string
): Promise<SyncResult> {
  // 1. Sync status overrides from Google Sheet (only update changed rows)
  const overrides = await fetchStatusOverrides(weekIdentifier);
  let overrideCount = 0;
  if (overrides.length > 0) {
    const dbOpportunities = await prisma.newsletterOpportunity.findMany({
      where: { id: { in: overrides.map((o) => o.opportunityId) } },
      select: { id: true, status: true },
    });
    const dbStatusMap = new Map(
      dbOpportunities.map((o) => [o.id, o.status])
    );

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

  return { overrideCount, expiredCount: expired.count };
}
