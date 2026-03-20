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

/**
 * Build a prompt that matches ALL opportunities against ALL partners
 * in a single Claude call (avoids rate limits on low-tier API plans).
 */
export function buildFullMatchingPrompt(
  opportunities: OpportunityContext[],
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

  const opportunityBlock = opportunities
    .map(
      (opp, i) =>
        `--- Opportunity ${i + 1}: "${opp.title}" ---
Category: ${opp.category}
Description: ${opp.description}
Industries: ${opp.industries.join(", ")}
Relevant For: ${opp.relevantFor}
Date: ${opp.dateDisplayText}
Contact: ${opp.contactMethod}${opp.sourceUrl ? `\nURL: ${opp.sourceUrl}` : ""}`
    )
    .join("\n\n");

  const user = `OPPORTUNITIES (${opportunities.length} total):

${opportunityBlock}

PARTNER PROFILES (${partners.length} total — evaluate ALL for relevance to EACH opportunity):

${partnerBlock}

INSTRUCTIONS:
1. For each opportunity, evaluate every partner's relevance.
2. Return ONLY pairings with confidence >= ${confidenceThreshold}. Do not force matches.
3. Each match must include:
   - "opportunityTitle": exact title as listed above
   - "partnerName": exact name as listed above
   - "confidenceScore": 0.0 to 1.0 (0.7+ = strong match, 0.5-0.7 = worth considering)
   - "rationale": 2-3 sentences explaining why this partner specifically. Be concrete — reference their services, positioning, or challenges.
   - "internalLanguage": 1-2 sentences the pod/strategist would say to each other about this match (professional shorthand, assumes context)
   - "clientFacingLanguage": 2-3 sentences to share with the client (warm, professional, specific to the opportunity — as if writing a brief email excerpt)
4. Consider non-obvious connections: a partner's current challenges might make an opportunity relevant even without direct industry overlap.
5. If NO partners are genuinely relevant to an opportunity, simply don't include matches for it. Empty results are better than bad matches.
6. Sort matches by opportunity (in order listed), then by confidence score highest first.
7. For matches with confidence >= 0.7, also include an "outreachDraftEmail" field: a ready-to-send email from the admin to the client partner about this opportunity. Format: Subject line + body. The email should be warm, direct, and specific — reference the partner's expertise and explain why this opportunity is relevant to them. Keep it concise (100-200 words). Use [Your name] as the sign-off placeholder. Do not use em dashes or the word "just". Do not use generic business language.

Return JSON in this exact format:
{"matches": [{"opportunityTitle": "...", "partnerName": "...", "confidenceScore": 0.85, "rationale": "...", "internalLanguage": "...", "clientFacingLanguage": "...", "outreachDraftEmail": "Subject: ...\\n\\nHey [Partner first name],\\n\\n...\\n\\nBest,\\n[Your name]"}]}

Return ONLY the JSON object. No other text.`;

  return { system, user };
}
