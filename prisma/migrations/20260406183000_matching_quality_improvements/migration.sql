-- AlterTable: Add matchingNotes to PartnerProfile
ALTER TABLE "PartnerProfile" ADD COLUMN "matchingNotes" TEXT;

-- AlterTable: Add audienceRestrictions to NewsletterOpportunity
ALTER TABLE "NewsletterOpportunity" ADD COLUMN "audienceRestrictions" TEXT NOT NULL DEFAULT 'none';

-- CreateTable: GlobalExclusion
CREATE TABLE "GlobalExclusion" (
    "id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalExclusion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalExclusion_pattern_key" ON "GlobalExclusion"("pattern");
