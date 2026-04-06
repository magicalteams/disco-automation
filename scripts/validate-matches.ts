/**
 * Review existing match results for a given week.
 *
 * Usage:
 *   npm run validate                         # Current week
 *   npm run validate -- --week 2026-W12      # Specific week
 *
 * To run matching in dry-run mode, use: /match dry-run (in Slack)
 */

import { getWeekIdentifier } from "../src/lib/utils/date-classifier";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs(): { week: string } {
  const args = process.argv.slice(2);
  let week = getWeekIdentifier(new Date());

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--week" && args[i + 1]) {
      week = args[i + 1];
      i++;
    }
  }

  return { week };
}

async function main() {
  const { week } = parseArgs();

  console.log(`\nMatch Results — ${week}\n`);

  const matchRun = await prisma.matchRun.findUnique({
    where: { weekIdentifier: week },
  });

  if (!matchRun) {
    console.log(`No match run found for ${week}.`);
    return;
  }

  console.log(`Run status: ${matchRun.status} | Model: ${matchRun.model} | Matches: ${matchRun.matchCount}`);
  console.log();

  const results = await prisma.matchResult.findMany({
    where: { matchRunId: matchRun.id },
    include: {
      partner: { select: { name: true, company: true } },
      opportunity: { select: { title: true, category: true } },
    },
    orderBy: [{ partner: { name: "asc" } }, { confidenceScore: "desc" }],
  });

  if (results.length === 0) {
    console.log("No match results found.");
    return;
  }

  // Group by partner
  const byPartner = new Map<string, typeof results>();
  for (const r of results) {
    const key = r.partner.name;
    const existing = byPartner.get(key) || [];
    existing.push(r);
    byPartner.set(key, existing);
  }

  for (const [partnerName, matches] of byPartner) {
    const partner = matches[0].partner;
    console.log(`${partnerName} / ${partner.company}`);
    console.log("─".repeat(60));

    for (const m of matches) {
      const bar = "█".repeat(Math.round(m.confidenceScore * 20));
      const empty = "░".repeat(20 - Math.round(m.confidenceScore * 20));
      const status = m.reactionStatus === "pending" ? "" : ` [${m.reactionStatus}]`;
      console.log(`  ${bar}${empty} ${m.confidenceScore.toFixed(2)}  ${m.opportunity.title}${status}`);
      console.log(`    Why: ${m.rationale}`);
      console.log(`    Client: "${m.clientFacingLanguage}"`);
      console.log();
    }
  }
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
