import { z } from "zod";

export const UrgencySchema = z.enum(["high", "medium", "low"]);
export const SpecificitySchema = z.enum(["concrete", "moderate", "vague"]);

export const PrimaryPersonSchema = z.object({
  name: z.string().min(1),
  company: z.string().nullable(),
  role: z.string().nullable(),
});

export const NeedSchema = z.object({
  statement: z.string().min(1),
  context: z.string(),
  industries: z.array(z.string()),
  urgency: UrgencySchema,
});

export const OfferSchema = z.object({
  statement: z.string().min(1),
  context: z.string(),
  industries: z.array(z.string()),
  specificity: SpecificitySchema,
});

export const IntroWorthinessSchema = z.object({
  score: z.number().min(0).max(1),
  rationale: z.string(),
  suggestedTopics: z.array(z.string()),
});

export const TranscriptExtractionSchema = z.object({
  meetingContext: z.string().min(1),
  primaryPerson: PrimaryPersonSchema,
  needs: z.array(NeedSchema),
  offers: z.array(OfferSchema),
  introWorthiness: IntroWorthinessSchema,
});

export type TranscriptExtraction = z.infer<typeof TranscriptExtractionSchema>;
export type Need = z.infer<typeof NeedSchema>;
export type Offer = z.infer<typeof OfferSchema>;

// Disco match result schemas for Claude response parsing

export const NeedToOpportunityMatchSchema = z.object({
  needIndex: z.number().int().min(0),
  opportunityId: z.string(),
  opportunityTitle: z.string(),
  confidenceScore: z.number().min(0).max(1),
  rationale: z.string(),
  clientFacingLanguage: z.string(),
});

export const OfferToPartnerMatchSchema = z.object({
  offerIndex: z.number().int().min(0),
  partnerName: z.string(),
  confidenceScore: z.number().min(0).max(1),
  rationale: z.string(),
  clientFacingLanguage: z.string(),
});

export const NeedToOpportunityResponseSchema = z.object({
  matches: z.array(NeedToOpportunityMatchSchema),
});

export const OfferToPartnerResponseSchema = z.object({
  matches: z.array(OfferToPartnerMatchSchema),
});

export type NeedToOpportunityMatch = z.infer<typeof NeedToOpportunityMatchSchema>;
export type OfferToPartnerMatch = z.infer<typeof OfferToPartnerMatchSchema>;
