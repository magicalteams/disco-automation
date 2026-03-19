import { z } from "zod";

export const PartnerProfileSchema = z.object({
  name: z.string().min(1),
  company: z.string().min(1),
  title: z.string(),
  industries: z.array(z.string()),
  servicesOffered: z.array(z.string()),
  targetClients: z.string(),
  geographicFocus: z.array(z.string()),
  companyStage: z.string().optional(),
  keyStrengths: z.array(z.string()),
  uniquePositioning: z.string(),
  currentChallenges: z.array(z.string()),
  idealIntroProfile: z.string(),
  communicationStyle: z.string().optional(),
  matchingSummary: z.string().min(100, "Matching summary must be at least 100 characters"),
});

export type PartnerProfileInput = z.infer<typeof PartnerProfileSchema>;
