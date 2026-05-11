import { callClaude, getModelId } from "@/lib/clients/anthropic";
import { buildDossierExtractionPrompt } from "@/lib/prompts/extract-profile";
import {
  PartnerProfileSchema,
  type PartnerProfileInput,
} from "@/schemas/partner-profile";
import { prisma } from "@/lib/clients/db";

export interface ExtractionSource {
  sourceType: "drive_import" | "manual_paste";
  sourceReference: string;
}

export interface ExtractAndUpsertResult {
  profile: {
    id: string;
    name: string;
    company: string;
  };
  extracted: PartnerProfileInput;
  isNew: boolean;
}

/**
 * Core extraction pipeline: raw dossier text → Claude Opus extraction →
 * Zod validation → Prisma upsert. Used by both the API route and
 * the CLI batch import script.
 */
export async function extractAndUpsertProfile(
  rawText: string,
  source: ExtractionSource
): Promise<ExtractAndUpsertResult> {
  // 1. Build extraction prompt
  const { system, user } = buildDossierExtractionPrompt(rawText);

  // 2. Call Claude Opus
  const rawResponse = await callClaude(user, {
    system,
    model: "opus",
    maxTokens: 4096,
  });

  // 3. Parse JSON (handle markdown fences the LLM sometimes adds). Both the
  // raw JSON parse and the Zod validation can fail on bad model output; we
  // surface a clear error so the bulk-import loop can skip and continue.
  let jsonStr = rawResponse.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(
      `Profile extraction returned invalid JSON: ${err instanceof Error ? err.message : err}. Raw response prefix: ${jsonStr.slice(0, 200)}`
    );
  }

  // 4. Validate with Zod
  const validated = PartnerProfileSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error(
      `Profile extraction failed schema validation: ${validated.error.message}`
    );
  }
  const extracted = validated.data;

  // 5. Check if profile already exists (to report isNew)
  const existing = await prisma.partnerProfile.findUnique({
    where: {
      name_company: {
        name: extracted.name,
        company: extracted.company,
      },
    },
    select: { id: true },
  });

  // 6. Upsert to database
  const modelId = getModelId("opus");
  const profile = await prisma.partnerProfile.upsert({
    where: {
      name_company: {
        name: extracted.name,
        company: extracted.company,
      },
    },
    update: {
      title: extracted.title,
      industries: extracted.industries,
      servicesOffered: extracted.servicesOffered,
      targetClients: extracted.targetClients,
      geographicFocus: extracted.geographicFocus,
      companyStage: extracted.companyStage,
      keyStrengths: extracted.keyStrengths,
      uniquePositioning: extracted.uniquePositioning,
      currentChallenges: extracted.currentChallenges,
      idealIntroProfile: extracted.idealIntroProfile,
      communicationStyle: extracted.communicationStyle,
      matchingSummary: extracted.matchingSummary,
      sourceType: source.sourceType,
      sourceReference: source.sourceReference,
      lastExtractedAt: new Date(),
      extractionModel: modelId,
    },
    create: {
      name: extracted.name,
      company: extracted.company,
      title: extracted.title,
      industries: extracted.industries,
      servicesOffered: extracted.servicesOffered,
      targetClients: extracted.targetClients,
      geographicFocus: extracted.geographicFocus,
      companyStage: extracted.companyStage,
      keyStrengths: extracted.keyStrengths,
      uniquePositioning: extracted.uniquePositioning,
      currentChallenges: extracted.currentChallenges,
      idealIntroProfile: extracted.idealIntroProfile,
      communicationStyle: extracted.communicationStyle,
      matchingSummary: extracted.matchingSummary,
      sourceType: source.sourceType,
      sourceReference: source.sourceReference,
      lastExtractedAt: new Date(),
      extractionModel: modelId,
    },
  });

  return {
    profile: { id: profile.id, name: profile.name, company: profile.company },
    extracted,
    isNew: !existing,
  };
}
