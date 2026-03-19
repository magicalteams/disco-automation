import { describe, it, expect } from "vitest";
import { PartnerProfileSchema } from "../partner-profile";
import { ExtractedOpportunitySchema, NewsletterExtractionRequestSchema } from "../newsletter-opportunity";
import { MatchOutputSchema, BatchMatchResponseSchema } from "../match-result";

describe("PartnerProfileSchema", () => {
  const validProfile = {
    name: "Jane Doe",
    company: "Acme Corp",
    title: "CEO",
    industries: ["technology", "AI"],
    servicesOffered: ["consulting", "strategy"],
    targetClients: "Enterprise B2B SaaS companies",
    geographicFocus: ["US", "Europe"],
    keyStrengths: ["leadership", "fundraising"],
    uniquePositioning: "Deep AI expertise with enterprise focus",
    currentChallenges: ["scaling", "hiring"],
    idealIntroProfile: "Series B+ founders in AI",
    matchingSummary: "A".repeat(100),
  };

  it("accepts a valid profile", () => {
    const result = PartnerProfileSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
  });

  it("rejects when matchingSummary is too short", () => {
    const result = PartnerProfileSchema.safeParse({
      ...validProfile,
      matchingSummary: "Too short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when name is empty", () => {
    const result = PartnerProfileSchema.safeParse({ ...validProfile, name: "" });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields when omitted", () => {
    // validProfile doesn't include companyStage or communicationStyle (both optional)
    const result = PartnerProfileSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
  });

  it("accepts optional fields when included", () => {
    const result = PartnerProfileSchema.safeParse({
      ...validProfile,
      companyStage: "Growth",
      communicationStyle: "Direct and data-driven",
    });
    expect(result.success).toBe(true);
  });
});

describe("ExtractedOpportunitySchema", () => {
  const validOpp = {
    sequenceNumber: 1,
    category: "Networking Event",
    title: "AI Meetup",
    description: "A meetup for AI builders",
    industries: ["AI", "technology"],
    relevantFor: "AI founders and operators",
    eventDate: "2026-04-15",
    deadline: null,
    dateConfidence: "confirmed",
    dateDisplayText: "April 15, 2026",
    sourceUrl: "https://example.com",
    contactMethod: "Register via link",
  };

  it("accepts a valid opportunity", () => {
    const result = ExtractedOpportunitySchema.safeParse(validOpp);
    expect(result.success).toBe(true);
  });

  it("allows null eventDate and sourceUrl", () => {
    const result = ExtractedOpportunitySchema.safeParse({
      ...validOpp,
      eventDate: null,
      sourceUrl: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid dateConfidence", () => {
    const result = ExtractedOpportunitySchema.safeParse({
      ...validOpp,
      dateConfidence: "maybe",
    });
    expect(result.success).toBe(false);
  });
});

describe("NewsletterExtractionRequestSchema", () => {
  it("accepts valid extraction request", () => {
    const result = NewsletterExtractionRequestSchema.safeParse({
      markdown: "# Newsletter content",
      issueNumber: 44,
      publishDate: "2026-03-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format", () => {
    const result = NewsletterExtractionRequestSchema.safeParse({
      markdown: "# Content",
      issueNumber: 44,
      publishDate: "March 1, 2026",
    });
    expect(result.success).toBe(false);
  });
});

describe("BatchMatchResponseSchema", () => {
  it("accepts valid match response", () => {
    const result = BatchMatchResponseSchema.safeParse({
      matches: [
        {
          partnerName: "Jane Doe",
          confidenceScore: 0.85,
          rationale: "Strong alignment with AI focus",
          internalLanguage: "Great fit for AI track",
          clientFacingLanguage: "This opportunity aligns well with your AI expertise",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty matches array", () => {
    const result = BatchMatchResponseSchema.safeParse({ matches: [] });
    expect(result.success).toBe(true);
  });

  it("rejects confidence score above 1", () => {
    const result = BatchMatchResponseSchema.safeParse({
      matches: [
        {
          partnerName: "Jane Doe",
          confidenceScore: 1.5,
          rationale: "Test",
          internalLanguage: "Test",
          clientFacingLanguage: "Test",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
