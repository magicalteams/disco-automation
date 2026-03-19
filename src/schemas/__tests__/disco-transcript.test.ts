import { describe, it, expect } from "vitest";
import {
  TranscriptExtractionSchema,
  NeedToOpportunityResponseSchema,
  OfferToPartnerResponseSchema,
} from "../disco-transcript";

const validExtraction = {
  meetingContext: "Initial discovery call with a fintech founder exploring partnerships.",
  primaryPerson: {
    name: "Jane Smith",
    company: "FinCo",
    role: "CEO",
  },
  needs: [
    {
      statement: "Looking for a fractional CTO with AI experience",
      context: "Building out their ML pipeline and need technical leadership",
      industries: ["fintech", "AI/ML"],
      urgency: "high" as const,
    },
  ],
  offers: [
    {
      statement: "Deep expertise in financial compliance automation",
      context: "Built compliance systems for 3 banks",
      industries: ["fintech", "compliance"],
      specificity: "concrete" as const,
    },
  ],
  introWorthiness: {
    score: 0.85,
    rationale: "Strong network connector with clear needs and valuable expertise",
    suggestedTopics: ["AI in fintech", "compliance automation"],
  },
};

describe("TranscriptExtractionSchema", () => {
  it("accepts valid extraction", () => {
    const result = TranscriptExtractionSchema.safeParse(validExtraction);
    expect(result.success).toBe(true);
  });

  it("accepts null company and role", () => {
    const result = TranscriptExtractionSchema.safeParse({
      ...validExtraction,
      primaryPerson: { name: "Jane", company: null, role: null },
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty meetingContext", () => {
    const result = TranscriptExtractionSchema.safeParse({
      ...validExtraction,
      meetingContext: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid urgency value", () => {
    const result = TranscriptExtractionSchema.safeParse({
      ...validExtraction,
      needs: [{ ...validExtraction.needs[0], urgency: "critical" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid specificity value", () => {
    const result = TranscriptExtractionSchema.safeParse({
      ...validExtraction,
      offers: [{ ...validExtraction.offers[0], specificity: "very_specific" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects intro-worthiness score > 1", () => {
    const result = TranscriptExtractionSchema.safeParse({
      ...validExtraction,
      introWorthiness: { ...validExtraction.introWorthiness, score: 1.5 },
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty needs and offers arrays", () => {
    const result = TranscriptExtractionSchema.safeParse({
      ...validExtraction,
      needs: [],
      offers: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("NeedToOpportunityResponseSchema", () => {
  it("accepts valid matches", () => {
    const result = NeedToOpportunityResponseSchema.safeParse({
      matches: [
        {
          needIndex: 0,
          opportunityId: "2026-W09-001",
          opportunityTitle: "AI Meetup",
          confidenceScore: 0.85,
          rationale: "Strong industry alignment",
          clientFacingLanguage: "This event connects AI builders",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty matches array", () => {
    const result = NeedToOpportunityResponseSchema.safeParse({ matches: [] });
    expect(result.success).toBe(true);
  });
});

describe("OfferToPartnerResponseSchema", () => {
  it("accepts valid matches", () => {
    const result = OfferToPartnerResponseSchema.safeParse({
      matches: [
        {
          offerIndex: 0,
          partnerName: "John Doe",
          confidenceScore: 0.75,
          rationale: "Partner needs compliance expertise",
          clientFacingLanguage: "John could benefit from your compliance background",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects confidence score below 0", () => {
    const result = OfferToPartnerResponseSchema.safeParse({
      matches: [
        {
          offerIndex: 0,
          partnerName: "John",
          confidenceScore: -0.1,
          rationale: "test",
          clientFacingLanguage: "test",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
