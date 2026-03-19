-- CreateTable
CREATE TABLE "PartnerProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "industries" TEXT[],
    "servicesOffered" TEXT[],
    "targetClients" TEXT NOT NULL,
    "geographicFocus" TEXT[],
    "companyStage" TEXT,
    "keyStrengths" TEXT[],
    "uniquePositioning" TEXT NOT NULL,
    "currentChallenges" TEXT[],
    "idealIntroProfile" TEXT NOT NULL,
    "communicationStyle" TEXT,
    "matchingSummary" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceReference" TEXT,
    "lastExtractedAt" TIMESTAMP(3) NOT NULL,
    "extractionModel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterOpportunity" (
    "id" TEXT NOT NULL,
    "newsletterIssue" TEXT NOT NULL,
    "newsletterDate" TIMESTAMP(3) NOT NULL,
    "weekIdentifier" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "industries" TEXT[],
    "relevantFor" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "dateConfidence" TEXT NOT NULL,
    "dateDisplayText" TEXT NOT NULL,
    "defaultExpiry" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sourceUrl" TEXT,
    "contactMethod" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchResult" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "internalLanguage" TEXT NOT NULL,
    "clientFacingLanguage" TEXT NOT NULL,
    "matchRunId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchRun" (
    "id" TEXT NOT NULL,
    "weekIdentifier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "opportunityCount" INTEGER NOT NULL,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "MatchRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProfile_name_company_key" ON "PartnerProfile"("name", "company");

-- CreateIndex
CREATE INDEX "NewsletterOpportunity_weekIdentifier_idx" ON "NewsletterOpportunity"("weekIdentifier");

-- CreateIndex
CREATE INDEX "NewsletterOpportunity_status_idx" ON "NewsletterOpportunity"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MatchResult_opportunityId_partnerId_matchRunId_key" ON "MatchResult"("opportunityId", "partnerId", "matchRunId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchRun_weekIdentifier_key" ON "MatchRun"("weekIdentifier");

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "NewsletterOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_matchRunId_fkey" FOREIGN KEY ("matchRunId") REFERENCES "MatchRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
