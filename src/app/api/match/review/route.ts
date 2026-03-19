import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/clients/db";
import { getWeekIdentifier } from "@/lib/utils/date-classifier";
import { validateApiKey } from "@/lib/utils/api-auth";

/**
 * GET /api/match/review?week=2026-W12
 *
 * Returns detailed match results for a given week, with quality metrics.
 * Used during Phase 1D validation to review match quality and inform tuning.
 */
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;
  const week =
    request.nextUrl.searchParams.get("week") || getWeekIdentifier(new Date());

  // Fetch match run
  const matchRun = await prisma.matchRun.findUnique({
    where: { weekIdentifier: week },
  });

  if (!matchRun) {
    return NextResponse.json(
      { error: `No match run found for ${week}` },
      { status: 404 }
    );
  }

  // Fetch all match results with related data
  const results = await prisma.matchResult.findMany({
    where: { matchRunId: matchRun.id },
    include: {
      opportunity: {
        select: {
          title: true,
          category: true,
          industries: true,
          dateDisplayText: true,
        },
      },
      partner: {
        select: {
          name: true,
          company: true,
          industries: true,
        },
      },
    },
    orderBy: { confidenceScore: "desc" },
  });

  // Compute quality metrics
  const scores = results.map((r) => r.confidenceScore);
  const avgScore = scores.length > 0
    ? scores.reduce((sum, s) => sum + s, 0) / scores.length
    : 0;

  const scoreDistribution = {
    high: scores.filter((s) => s >= 0.8).length,
    medium: scores.filter((s) => s >= 0.6 && s < 0.8).length,
    low: scores.filter((s) => s < 0.6).length,
  };

  // Matches per opportunity
  const byOpportunity = new Map<string, number>();
  for (const r of results) {
    const title = r.opportunity.title;
    byOpportunity.set(title, (byOpportunity.get(title) || 0) + 1);
  }

  // Matches per partner
  const byPartner = new Map<string, number>();
  for (const r of results) {
    const name = `${r.partner.name} / ${r.partner.company}`;
    byPartner.set(name, (byPartner.get(name) || 0) + 1);
  }

  // Total partners and opportunities in system
  const totalPartners = await prisma.partnerProfile.count();
  const totalOpportunities = await prisma.newsletterOpportunity.count({
    where: { weekIdentifier: week },
  });
  const activeOpportunities = await prisma.newsletterOpportunity.count({
    where: { weekIdentifier: week, status: "active" },
  });

  return NextResponse.json({
    run: {
      id: matchRun.id,
      weekIdentifier: matchRun.weekIdentifier,
      status: matchRun.status,
      model: matchRun.model,
      opportunityCount: matchRun.opportunityCount,
      matchCount: matchRun.matchCount,
      startedAt: matchRun.startedAt,
      completedAt: matchRun.completedAt,
    },
    quality: {
      averageConfidence: parseFloat(avgScore.toFixed(3)),
      scoreDistribution,
      matchesPerOpportunity: Object.fromEntries(byOpportunity),
      matchesPerPartner: Object.fromEntries(byPartner),
      coverageStats: {
        totalPartners,
        partnersMatched: byPartner.size,
        partnerCoverage: parseFloat(
          ((byPartner.size / Math.max(totalPartners, 1)) * 100).toFixed(1)
        ),
        totalOpportunities,
        activeOpportunities,
        opportunitiesWithMatches: byOpportunity.size,
      },
    },
    matches: results.map((r) => ({
      opportunityTitle: r.opportunity.title,
      opportunityCategory: r.opportunity.category,
      partnerName: r.partner.name,
      partnerCompany: r.partner.company,
      confidenceScore: r.confidenceScore,
      rationale: r.rationale,
      internalLanguage: r.internalLanguage,
      clientFacingLanguage: r.clientFacingLanguage,
    })),
  });
}
