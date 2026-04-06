import { prisma } from "@/lib/clients/db";
import { callClaude } from "@/lib/clients/anthropic";
import { buildNewsletterExtractionPrompt } from "@/lib/prompts/extract-newsletter";
import { ExtractedOpportunitySchema } from "@/schemas/newsletter-opportunity";
import { classifyAndSetExpiry, getWeekIdentifier } from "@/lib/utils/date-classifier";
import { pushOpportunitiesToSheet } from "@/lib/clients/google-sheets";
import { z } from "zod";

export interface ExtractionInput {
  markdown: string;
  issueNumber: number;
  publishDate: string; // YYYY-MM-DD
}

export interface ExtractionResult {
  weekIdentifier: string;
  opportunities: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
  }>;
  isExisting: boolean;
}

/**
 * Core newsletter extraction pipeline: markdown → Claude extraction →
 * Zod validation → Prisma write → Google Sheet push.
 * Used by both the manual API route and the automated cron.
 */
export async function extractNewsletter(
  input: ExtractionInput
): Promise<ExtractionResult> {
  const publishDate = new Date(input.publishDate);
  const weekId = getWeekIdentifier(publishDate);
  const ttlWeeks = parseInt(process.env.OPPORTUNITY_DEFAULT_TTL_WEEKS || "4", 10);

  // Check for existing extraction
  const existing = await prisma.newsletterOpportunity.findMany({
    where: { weekIdentifier: weekId },
  });
  if (existing.length > 0) {
    return {
      weekIdentifier: weekId,
      opportunities: existing.map((o) => ({
        id: o.id,
        title: o.title,
        category: o.category,
        status: o.status,
      })),
      isExisting: true,
    };
  }

  // Extract via Claude
  const { system, user } = buildNewsletterExtractionPrompt(
    input.markdown,
    input.issueNumber,
    input.publishDate
  );
  const rawResponse = await callClaude(user, {
    system,
    model: "haiku",
    maxTokens: 8192,
    retries: 0,
  });

  // Parse JSON response
  let jsonStr = rawResponse.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const extractedArray = z
    .array(ExtractedOpportunitySchema)
    .parse(JSON.parse(jsonStr));

  // Write to database with date classification
  const opportunities = [];
  for (const extracted of extractedArray) {
    const dateInfo = classifyAndSetExpiry(extracted, publishDate, ttlWeeks);
    const id = `${weekId}-${String(extracted.sequenceNumber).padStart(3, "0")}`;

    const opp = await prisma.newsletterOpportunity.create({
      data: {
        id,
        newsletterIssue: `Issue #${input.issueNumber}`,
        newsletterDate: publishDate,
        weekIdentifier: weekId,
        category: extracted.category,
        title: extracted.title,
        description: extracted.description,
        industries: extracted.industries,
        relevantFor: extracted.relevantFor,
        eventDate: dateInfo.eventDate,
        deadline: dateInfo.deadline,
        dateConfidence: extracted.dateConfidence,
        dateDisplayText: extracted.dateDisplayText,
        defaultExpiry: dateInfo.defaultExpiry,
        status: dateInfo.status,
        sourceUrl: extracted.sourceUrl,
        contactMethod: extracted.contactMethod,
        audienceRestrictions: extracted.audienceRestrictions ?? "none",
      },
    });
    opportunities.push(opp);
  }

  // Push opportunity rows to Google Sheet for human review
  try {
    await pushOpportunitiesToSheet(
      opportunities.map((opp) => ({
        id: opp.id,
        weekIdentifier: opp.weekIdentifier,
        title: opp.title,
        category: opp.category,
        dateDisplayText: opp.dateDisplayText,
        status: opp.status,
      }))
    );
  } catch (sheetError) {
    // Non-fatal: log but don't fail the extraction
    console.error("Failed to push opportunities to Google Sheet:", sheetError);
  }

  return {
    weekIdentifier: weekId,
    opportunities: opportunities.map((o) => ({
      id: o.id,
      title: o.title,
      category: o.category,
      status: o.status,
    })),
    isExisting: false,
  };
}
