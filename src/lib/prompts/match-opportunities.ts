interface PartnerSummary {
  name: string;
  company: string;
  matchingSummary: string;
}

interface OpportunityContext {
  title: string;
  category: string;
  description: string;
  industries: string[];
  relevantFor: string;
  dateDisplayText: string;
  contactMethod: string;
  sourceUrl: string | null;
}

export function buildBatchMatchingPrompt(
  opportunity: OpportunityContext,
  partners: PartnerSummary[],
  confidenceThreshold: number = 0.6
): { system: string; user: string } {
  const system = `You are a professional services matching engine for Antonym, an agency that connects client partners with relevant opportunities. You evaluate whether newsletter opportunities are relevant to specific client partners.

You consider: industry fit, service alignment, geographic relevance, career stage, unique positioning, current challenges, and non-obvious connections. You are critical — a forced match helps no one. Only surface genuinely relevant pairings.

Return valid JSON only — no markdown fences, no commentary.`;

  const partnerBlock = partners
    .map(
      (p, i) =>
        `--- Partner ${i + 1}: ${p.name} (${p.company}) ---\n${p.matchingSummary}`
    )
    .join("\n\n");

  const user = `OPPORTUNITY:
Title: ${opportunity.title}
Category: ${opportunity.category}
Description: ${opportunity.description}
Industries: ${opportunity.industries.join(", ")}
Relevant For: ${opportunity.relevantFor}
Date: ${opportunity.dateDisplayText}
Contact: ${opportunity.contactMethod}
${opportunity.sourceUrl ? `URL: ${opportunity.sourceUrl}` : ""}

PARTNER PROFILES (evaluate ALL for relevance to this opportunity):

${partnerBlock}

INSTRUCTIONS:
1. Evaluate each partner's relevance to this specific opportunity.
2. Return ONLY partners with confidence >= ${confidenceThreshold}. Do not force matches.
3. For each match, provide:
   - "partnerName": exact name as listed above
   - "confidenceScore": 0.0 to 1.0 (0.7+ = strong match, 0.5-0.7 = worth considering)
   - "rationale": 2-3 sentences explaining why this partner specifically. Be concrete — reference their services, positioning, or challenges.
   - "internalLanguage": 1-2 sentences the pod/strategist would say to each other about this match (professional shorthand, assumes context)
   - "clientFacingLanguage": 2-3 sentences to share with the client (warm, professional, specific to the opportunity — as if writing a brief email excerpt)
4. Consider non-obvious connections: a partner's current challenges might make an opportunity relevant even without direct industry overlap.
5. If NO partners are genuinely relevant, return an empty array. That's better than bad matches.
6. Sort matches by confidence score, highest first.

Return JSON in this exact format:
{"matches": [{"partnerName": "...", "confidenceScore": 0.85, "rationale": "...", "internalLanguage": "...", "clientFacingLanguage": "..."}]}

Return ONLY the JSON object. No other text.`;

  return { system, user };
}
