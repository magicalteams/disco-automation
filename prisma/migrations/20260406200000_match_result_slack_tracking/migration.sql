-- AlterTable: Add Slack tracking fields to MatchResult
ALTER TABLE "MatchResult" ADD COLUMN "slackMessageTs" TEXT;
ALTER TABLE "MatchResult" ADD COLUMN "slackChannelId" TEXT;
ALTER TABLE "MatchResult" ADD COLUMN "reactionStatus" TEXT NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "MatchResult_slackMessageTs_slackChannelId_idx" ON "MatchResult"("slackMessageTs", "slackChannelId");
