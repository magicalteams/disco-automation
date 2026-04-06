interface PartnerSummary {
  name: string;
  company: string;
  matchingSummary: string;
  geographicFocus: string[];
  matchingNotes: string | null;
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
  audienceRestrictions: string;
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

HARD REJECTION RULES — if ANY of these apply, do NOT return the match regardless of other fit:
1. GEOGRAPHIC: If the opportunity requires in-person attendance in a specific city or region and the partner's Geographic Focus does not include that area, reject. Remote/virtual opportunities are fine for anyone.
2. AUDIENCE RESTRICTIONS: If the opportunity has audience restrictions (gender, identity, experience level), only match partners who clearly meet those criteria. When in doubt, do not match.
3. TOOL/PLATFORM PREREQUISITES: If the opportunity is a discount, feature, or benefit for a specific software tool, only match partners whose summary explicitly mentions using that tool. Industry adjacency alone is not enough.
4. STRATEGIST NOTES: If a partner has Strategist Notes containing instructions about what NOT to match, respect those instructions absolutely.

CRITICAL: Return valid JSON only — no markdown fences, no commentary. Every match object MUST include ALL required fields: opportunityTitle, partnerName, confidenceScore, rationale, clientFacingLanguage. Never omit any field.`;

  const partnerBlock = partners
    .map(
      (p, i) =>
        `--- Partner ${i + 1}: ${p.name} (${p.company}) ---
Geographic Focus: ${p.geographicFocus.length > 0 ? p.geographicFocus.join(", ") : "Not specified"}${p.matchingNotes ? `\nStrategist Notes: ${p.matchingNotes}` : ""}
${p.matchingSummary}`
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
Audience Restrictions: ${opp.audienceRestrictions}
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
2. FIRST check the Hard Rejection Rules. If any rule rejects the pair, skip it entirely.
3. Return ONLY pairings with confidence >= ${confidenceThreshold}. Do not force matches.
4. Each match must include:
   - "opportunityTitle": exact title as listed above
   - "partnerName": exact name as listed above
   - "confidenceScore": 0.0 to 1.0 (0.7+ = strong match, 0.5-0.7 = worth considering)
   - "rationale": 2-3 sentences explaining why this partner specifically. Be concrete — reference their services, positioning, or challenges.
   - "clientFacingLanguage": 2-3 sentences to share with the client (warm, professional, specific to the opportunity — as if writing a brief email excerpt)
5. Consider non-obvious connections: a partner's current challenges might make an opportunity relevant even without direct industry overlap.
6. If NO partners are genuinely relevant to an opportunity, simply don't include matches for it. Empty results are better than bad matches.
7. Sort matches by opportunity (in order listed), then by confidence score highest first.
8. For matches with confidence >= 0.7, also include an "outreachDraftEmail" field: a ready-to-send email from the admin to the client partner about this opportunity. Format: Subject line + body. The email should be warm, direct, and specific — reference the partner's expertise and explain why this opportunity is relevant to them. Keep it concise (100-200 words). Use [Your name] as the sign-off placeholder. Do not use em dashes or the word "just". Do not use generic business language.

REQUIRED FIELDS for every match object (do NOT omit any):
- "opportunityTitle" (string, required)
- "partnerName" (string, required)
- "confidenceScore" (number, required)
- "rationale" (string, required)
- "clientFacingLanguage" (string, required)
- "outreachDraftEmail" (string, only for confidence >= 0.7)

Return JSON in this exact format:
{"matches": [{"opportunityTitle": "...", "partnerName": "...", "confidenceScore": 0.85, "rationale": "...", "clientFacingLanguage": "...", "outreachDraftEmail": "Subject: ...\\n\\nHey [Partner first name],\\n\\n...\\n\\nBest,\\n[Your name]"}]}

Return ONLY the JSON object. No other text.`;

  return { system, user };
}
