import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/clients/db";
import { callClaude } from "@/lib/clients/anthropic";
import { buildNewsletterExtractionPrompt } from "@/lib/prompts/extract-newsletter";
import {
  NewsletterExtractionRequestSchema,
  ExtractedOpportunitySchema,
} from "@/schemas/newsletter-opportunity";
import { classifyAndSetExpiry, getWeekIdentifier } from "@/lib/utils/date-classifier";
import { pushOpportunitiesToSheet } from "@/lib/clients/google-sheets";
import { validateApiKey } from "@/lib/utils/api-auth";
import { z } from "zod";

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const input = NewsletterExtractionRequestSchema.parse(body);

    const publishDate = new Date(input.publishDate);
    const weekId = getWeekIdentifier(publishDate);
    const ttlWeeks = parseInt(process.env.OPPORTUNITY_DEFAULT_TTL_WEEKS || "4", 10);

    // Check for existing extraction
    const existing = await prisma.newsletterOpportunity.findMany({
      where: { weekIdentifier: weekId },
    });
    if (existing.length > 0) {
      return NextResponse.json({
        message: `Opportunities for ${weekId} already extracted`,
        weekIdentifier: weekId,
        opportunities: existing,
        isExisting: true,
      });
    }

    // Extract via Claude
    const { system, user } = buildNewsletterExtractionPrompt(
      input.markdown,
      input.issueNumber,
      input.publishDate
    );
    const rawResponse = await callClaude(user, { system, model: "sonnet", maxTokens: 8192 });

    // Parse JSON response
    let jsonStr = rawResponse.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const extractedArray = z.array(ExtractedOpportunitySchema).parse(JSON.parse(jsonStr));

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

    return NextResponse.json({
      message: `Extracted ${opportunities.length} opportunities from Issue #${input.issueNumber}`,
      weekIdentifier: weekId,
      opportunities,
      isExisting: false,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Newsletter extraction failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
