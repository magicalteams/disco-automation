import {
  processAndMatchTranscript,
  type DiscoMatchOptions,
} from "../src/lib/matching/disco-engine";

async function main() {
  const args = process.argv.slice(2);

  let transcriptId: string | null = null;
  let threshold: number | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--id" && args[i + 1]) {
      transcriptId = args[++i];
    } else if (args[i] === "--threshold" && args[i + 1]) {
      threshold = parseFloat(args[++i]);
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  if (!transcriptId) {
    console.error(
      "Usage: npm run disco -- --id <transcriptId> [--threshold 0.5] [--dry-run]"
    );
    process.exit(1);
  }

  console.log(`Processing transcript: ${transcriptId}`);
  if (dryRun) console.log("(dry-run mode — results won't be posted to Slack)");
  if (threshold) console.log(`Confidence threshold: ${threshold}`);

  const options: DiscoMatchOptions = {
    thresholdOverride: threshold,
    skipSlack: true, // CLI always skips Slack — results printed to console
    dryRun,
  };

  try {
    const summary = await processAndMatchTranscript(transcriptId, options);

    console.log("\n=== MEETING ===");
    console.log(`Title: ${summary.meetingTitle}`);
    console.log(
      `Person: ${summary.primaryPerson.name}${summary.primaryPerson.company ? ` @ ${summary.primaryPerson.company}` : ""}`
    );
    console.log(`Context: ${summary.extraction.meetingContext}`);

    console.log("\n=== NEEDS ===");
    for (const need of summary.extraction.needs) {
      console.log(`  [${need.urgency}] ${need.statement}`);
      console.log(`    Context: ${need.context}`);
      console.log(`    Industries: ${need.industries.join(", ")}`);
    }

    console.log("\n=== OFFERS ===");
    for (const offer of summary.extraction.offers) {
      console.log(`  [${offer.specificity}] ${offer.statement}`);
      console.log(`    Context: ${offer.context}`);
      console.log(`    Industries: ${offer.industries.join(", ")}`);
    }

    console.log("\n=== INTRO-WORTHINESS ===");
    console.log(
      `  Score: ${summary.extraction.introWorthiness.score.toFixed(2)}`
    );
    console.log(`  ${summary.extraction.introWorthiness.rationale}`);
    if (summary.extraction.introWorthiness.suggestedTopics.length > 0) {
      console.log(
        `  Topics: ${summary.extraction.introWorthiness.suggestedTopics.join(", ")}`
      );
    }

    console.log("\n=== NEED → OPPORTUNITY MATCHES ===");
    if (summary.needToOpportunityMatches.length === 0) {
      console.log("  No matches found.");
    } else {
      for (const m of summary.needToOpportunityMatches) {
        console.log(
          `  [${m.confidenceScore.toFixed(2)}] Need #${m.needIndex} → ${m.opportunityTitle}`
        );
        console.log(`    ${m.rationale}`);
        console.log(`    Client: "${m.clientFacingLanguage}"`);
      }
    }

    console.log("\n=== OFFER → PARTNER MATCHES ===");
    if (summary.offerToPartnerMatches.length === 0) {
      console.log("  No matches found.");
    } else {
      for (const m of summary.offerToPartnerMatches) {
        console.log(
          `  [${m.confidenceScore.toFixed(2)}] Offer #${m.offerIndex} → ${m.partnerName}`
        );
        console.log(`    ${m.rationale}`);
        console.log(`    Client: "${m.clientFacingLanguage}"`);
      }
    }

    console.log(
      `\n=== SUMMARY: ${summary.needToOpportunityMatches.length} need→opp, ${summary.offerToPartnerMatches.length} offer→partner ===`
    );
  } catch (error) {
    console.error(
      "Failed:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

main();
