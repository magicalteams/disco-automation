import { z } from "zod";

export const MatchOutputSchema = z.object({
  opportunityTitle: z.string(),
  partnerName: z.string(),
  confidenceScore: z.number().min(0).max(1),
  rationale: z.string(),
  clientFacingLanguage: z.string(),
  outreachDraftEmail: z.string().optional(),
});

export type MatchOutput = z.infer<typeof MatchOutputSchema>;

/**
 * Lenient schema that accepts matches with missing text fields.
 * Used for initial parsing — incomplete matches are retried individually.
 */
export const LenientMatchOutputSchema = z.object({
  opportunityTitle: z.string(),
  partnerName: z.string(),
  confidenceScore: z.number().min(0).max(1),
  rationale: z.string().optional(),
  clientFacingLanguage: z.string().optional(),
  outreachDraftEmail: z.string().optional(),
});

export type LenientMatchOutput = z.infer<typeof LenientMatchOutputSchema>;

export const BatchMatchResponseSchema = z.object({
  matches: z.array(MatchOutputSchema),
});

export const LenientBatchMatchResponseSchema = z.object({
  matches: z.array(LenientMatchOutputSchema),
});

export type BatchMatchResponse = z.infer<typeof BatchMatchResponseSchema>;
