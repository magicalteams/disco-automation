-- Add covering indexes for foreign keys on MatchResult. Flagged by the
-- Supabase advisor; without them, every query filtering by partnerId or
-- matchRunId does a sequential scan, which gets worse as match history grows.

CREATE INDEX "MatchResult_partnerId_idx" ON "MatchResult"("partnerId");
CREATE INDEX "MatchResult_matchRunId_idx" ON "MatchResult"("matchRunId");
