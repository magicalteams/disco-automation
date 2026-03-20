import { NextRequest, NextResponse } from "next/server";
import { NewsletterExtractionRequestSchema } from "@/schemas/newsletter-opportunity";
import { extractNewsletter } from "@/lib/ingest/extract-newsletter";
import { validateApiKey } from "@/lib/utils/api-auth";
import { z } from "zod";

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const input = NewsletterExtractionRequestSchema.parse(body);

    const result = await extractNewsletter(input);

    if (result.isExisting) {
      return NextResponse.json({
        message: `Opportunities for ${result.weekIdentifier} already extracted`,
        ...result,
      });
    }

    return NextResponse.json({
      message: `Extracted ${result.opportunities.length} opportunities from Issue #${input.issueNumber}`,
      ...result,
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
