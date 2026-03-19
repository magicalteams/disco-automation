/**
 * Validation script for Phase 1D match quality tuning.
 *
 * Runs matching in dry-run mode (no DB writes, no Slack post) and outputs
 * detailed results to the console for human review.
 *
 * Usage:
 *   npm run validate                         # Current week, default threshold
 *   npm run validate -- --week 2026-W12      # Specific week
 *   npm run validate -- --threshold 0.5      # Override threshold
 *   npm run validate -- --threshold 0.7      # Test stricter threshold
 *   npm run validate -- --week 2026-W12 --threshold 0.5
 */

import { runWeeklyMatching } from "../src/lib/matching/engine";
import { getWeekIdentifier } from "../src/lib/utils/date-classifier";
import { prisma } from "../src/lib/clients/db";

function parseArgs(): { week: string; threshold?: number } {
  const args = process.argv.slice(2);
  let week = getWeekIdentifier(new Date());
  let threshold: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--week" && args[i + 1]) {
      week = args[i + 1];
      i++;
    } else if (args[i] === "--threshold" && args[i + 1]) {
      threshold = parseFloat(args[i + 1]);
      if (isNaN(threshold) || threshold < 0 || threshold > 1) {
        console.error("Error: threshold must be between 0.0 and 1.0");
        process.exit(1);
      }
      i++;
    }
  }

  return { week, threshold };
}

function printSeparator(char = "─", length = 72) {
  console.log(char.repeat(length));
}

async function main() {
  const { week, threshold } = parseArgs();

  console.log("\n");
  printSeparator("═");
  console.log("  MATCH VALIDATION — DRY RUN");
  printSeparator("═");
  console.log(`  Week:      ${week}`);
  console.log(`  Threshold: ${threshold ?? `${process.env.MATCH_CONFIDENCE_THRESHOLD || "0.6"} (default)`}`);

  // Verify data exists
  const oppCount = await prisma.newsletterOpportunity.count({
    where: { weekIdentifier: week, status: "active" },
  });
  const partnerCount = await prisma.partnerProfile.count();

  console.log(`  Active opportunities: ${oppCount}`);
  console.log(`  Partner profiles:     ${partnerCount}`);
  printSeparator("═");

  if (oppCount === 0) {
    console.error(`\n  No active opportunities for ${week}. Extract a newsletter first.\n`);
    process.exit(1);
  }
  if (partnerCount === 0) {
    console.error("\n  No partner profiles found. Import dossiers first.\n");
    process.exit(1);
  }

  console.log("\n  Running matching (this may take a minute)...\n");

  const result = await runWeeklyMatching(week, {
    dryRun: true,
    thresholdOverride: threshold,
  });

  // Print results
  printSeparator("═");
  console.log("  RESULTS");
  printSeparator("═");
  console.log(`  Opportunities scanned: ${result.opportunitiesScanned}`);
  console.log(`  Matches found:         ${result.matchesFound}`);
  console.log(`  Partners matched:      ${result.partnersMatched}`);
  console.log(`  Score distribution:    High(≥0.8): ${result.scoreDistribution?.high}  Med(0.6-0.79): ${result.scoreDistribution?.medium}  Low(<0.6): ${result.scoreDistribution?.low}`);

  if (result.matchesFound > 0) {
    const avgScore =
      result.matches!.reduce((sum, m) => sum + m.confidenceScore, 0) /
      result.matches!.length;
    console.log(`  Average confidence:    ${avgScore.toFixed(3)}`);
  }
  printSeparator();

  // Group matches by opportunity for readability
  if (result.matches && result.matches.length > 0) {
    const grouped = new Map<string, typeof result.matches>();
    for (const m of result.matches) {
      const existing = grouped.get(m.opportunityTitle) || [];
      existing.push(m);
      grouped.set(m.opportunityTitle, existing);
    }

    for (const [oppTitle, matches] of grouped) {
      console.log(`\n  ${oppTitle}`);
      printSeparator("─", 72);

      for (const m of matches.sort((a, b) => b.confidenceScore - a.confidenceScore)) {
        const bar = "█".repeat(Math.round(m.confidenceScore * 20));
        const empty = "░".repeat(20 - Math.round(m.confidenceScore * 20));
        console.log(
          `    ${bar}${empty} ${m.confidenceScore.toFixed(2)}  ${m.partnerName} / ${m.company}`
        );
        console.log(`      Why: ${m.rationale}`);
        console.log(`      Pod: "${m.internalLanguage}"`);
        console.log(`      Client: "${m.clientFacingLanguage}"`);
        console.log();
      }
    }

    // Unmatched partners
    const matchedNames = new Set(result.matches.map((m) => m.partnerName));
    const allPartners = await prisma.partnerProfile.findMany({
      select: { name: true, company: true },
    });
    const unmatched = allPartners.filter((p) => !matchedNames.has(p.name));

    if (unmatched.length > 0) {
      printSeparator();
      console.log(`\n  UNMATCHED PARTNERS (${unmatched.length}):`);
      for (const p of unmatched) {
        console.log(`    - ${p.name} / ${p.company}`);
      }
    }
  } else {
    console.log("\n  No matches found. Consider lowering the threshold.\n");
  }

  printSeparator("═");
  console.log("  Dry run complete — no data was written to the database.");
  console.log("  To run for real: POST /api/match/weekly\n");

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("Validation failed:", error);
  await prisma.$disconnect();
  process.exit(1);
});
