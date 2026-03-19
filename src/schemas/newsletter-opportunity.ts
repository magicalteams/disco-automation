import { z } from "zod";

export const DateConfidenceSchema = z.enum(["confirmed", "inferred", "unknown"]);
export const OpportunityStatusSchema = z.enum(["active", "expired", "needs_review"]);

export const ExtractedOpportunitySchema = z.object({
  sequenceNumber: z.number().int().positive(),
  category: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  industries: z.array(z.string()),
  relevantFor: z.string(),
  eventDate: z.string().nullable(),
  deadline: z.string().nullable(),
  dateConfidence: DateConfidenceSchema,
  dateDisplayText: z.string(),
  sourceUrl: z.string().nullable(),
  contactMethod: z.string(),
});

export type ExtractedOpportunity = z.infer<typeof ExtractedOpportunitySchema>;

export const NewsletterExtractionRequestSchema = z.object({
  markdown: z.string().min(1, "Newsletter markdown is required"),
  issueNumber: z.number().int().positive(),
  publishDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
});

export type NewsletterExtractionRequest = z.infer<typeof NewsletterExtractionRequestSchema>;
