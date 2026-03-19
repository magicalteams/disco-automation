-- CreateTable
CREATE TABLE "ProcessedMeeting" (
    "id" TEXT NOT NULL,
    "firefliesTranscriptId" TEXT NOT NULL,
    "meetingTitle" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "participants" TEXT[],
    "transcriptText" TEXT NOT NULL,
    "extractedData" JSONB,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "model" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessedMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoMatchResult" (
    "id" TEXT NOT NULL,
    "processedMeetingId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "sourceStatement" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "clientFacingLanguage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoMatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedMeeting_firefliesTranscriptId_key" ON "ProcessedMeeting"("firefliesTranscriptId");

-- CreateIndex
CREATE INDEX "DiscoMatchResult_processedMeetingId_idx" ON "DiscoMatchResult"("processedMeetingId");

-- AddForeignKey
ALTER TABLE "DiscoMatchResult" ADD CONSTRAINT "DiscoMatchResult_processedMeetingId_fkey" FOREIGN KEY ("processedMeetingId") REFERENCES "ProcessedMeeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
