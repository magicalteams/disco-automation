import { z } from "zod";

export const MatchOutputSchema = z.object({
  opportunityTitle: z.string(),
  partnerName: z.string(),
  confidenceScore: z.number().min(0).max(1),
  rationale: z.string(),
  internalLanguage: z.string(),
  clientFacingLanguage: z.string(),
  outreachDraftEmail: z.string().optional(),
});

export type MatchOutput = z.infer<typeof MatchOutputSchema>;

export const BatchMatchResponseSchema = z.object({
  matches: z.array(MatchOutputSchema),
});

export type BatchMatchResponse = z.infer<typeof BatchMatchResponseSchema>;
