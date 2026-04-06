/**
 * Matching engine — shared types and utilities.
 *
 * The actual matching logic now runs via GitHub Actions
 * (scripts/run-weekly-matching.ts). This file retains shared
 * types and the MatchRunOptions interface for backward compatibility.
 */

export interface MatchRunOptions {
  thresholdOverride?: number;
  skipSlack?: boolean;
  dryRun?: boolean;
}

export interface MatchRunSummary {
  runId: string;
  weekIdentifier: string;
  opportunitiesScanned: number;
  matchesFound: number;
  partnersMatched: number;
  scoreDistribution?: {
    high: number;
    medium: number;
    low: number;
  };
  matches?: Array<{
    opportunityTitle: string;
    partnerName: string;
    company: string;
    confidenceScore: number;
    rationale: string;
    clientFacingLanguage: string;
    outreachDraftEmail?: string;
  }>;
}
