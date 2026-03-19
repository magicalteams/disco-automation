import type { Need, Offer } from "@/schemas/disco-transcript";

interface OpportunityContext {
  id: string;
  title: string;
  category: string;
  description: string;
  industries: string[];
  dateDisplayText: string;
  contactMethod: string;
}

interface PartnerSummary {
  name: string;
  company: string;
  matchingSummary: string;
}

export function buildNeedsToOpportunitiesPrompt(
  needs: Need[],
  opportunities: OpportunityContext[],
  confidenceThreshold: number = 0.6
): { system: string; user: string } {
  const system = `You match a person's expressed needs against available newsletter opportunities. Only surface genuinely relevant matches — a forced match helps no one.

Return valid JSON only — no markdown fences, no commentary.`;

  const needsBlock = needs
    .map(
      (n, i) =>
        `${i}. "${n.statement}"\n   Context: ${n.context}\n   Industries: ${n.industries.join(", ")}\n   Urgency: ${n.urgency}`
    )
    .join("\n\n");

  const oppsBlock = opportunities
    .map(
      (o) =>
        `[${o.id}] ${o.title}\n   Category: ${o.category}\n   Description: ${o.description}\n   Industries: ${o.industries.join(", ")}\n   Date: ${o.dateDisplayText}\n   Contact: ${o.contactMethod}`
    )
    .join("\n\n");

  const user = `PERSON'S NEEDS:

${needsBlock}

ACTIVE OPPORTUNITIES:

${oppsBlock}

INSTRUCTIONS:
1. For each need, evaluate which opportunities could genuinely help address it.
2. Only return matches with confidence >= ${confidenceThreshold}.
3. Consider: industry alignment, specificity of the need vs. what the opportunity provides, urgency, and non-obvious connections.
4. A single opportunity can match multiple needs (use different needIndex values).
5. If no opportunities match a need, skip it — don't force matches.

Return JSON in this exact format:
{"matches": [{"needIndex": 0, "opportunityId": "2026-W09-001", "opportunityTitle": "...", "confidenceScore": 0.85, "rationale": "2-3 sentences explaining the match", "clientFacingLanguage": "2-3 sentences to share with the person about this opportunity"}]}

Return ONLY the JSON object. No other text.`;

  return { system, user };
}

export function buildOffersToPartnersPrompt(
  offers: Offer[],
  partners: PartnerSummary[],
  confidenceThreshold: number = 0.6
): { system: string; user: string } {
  const system = `You identify which partners in a professional network would benefit from being introduced to someone with specific capabilities. Only surface genuinely valuable introductions.

Return valid JSON only — no markdown fences, no commentary.`;

  const offersBlock = offers
    .map(
      (o, i) =>
        `${i}. "${o.statement}"\n   Context: ${o.context}\n   Industries: ${o.industries.join(", ")}\n   Specificity: ${o.specificity}`
    )
    .join("\n\n");

  const partnerBlock = partners
    .map(
      (p, i) =>
        `--- Partner ${i + 1}: ${p.name} (${p.company}) ---\n${p.matchingSummary}`
    )
    .join("\n\n");

  const user = `PERSON'S OFFERS (capabilities, services, expertise):

${offersBlock}

PARTNER PROFILES (evaluate ALL for potential benefit from an introduction):

${partnerBlock}

INSTRUCTIONS:
1. For each offer, evaluate which existing partners would benefit from being introduced to this person.
2. Only return matches with confidence >= ${confidenceThreshold}.
3. Consider: the partner's currentChallenges, idealIntroProfile, industry alignment, and non-obvious connections.
4. Think about whether the person's offer addresses a real gap or challenge the partner faces.
5. A single offer can match multiple partners.
6. If no partners would benefit from an offer, skip it.
7. Sort matches by confidence score, highest first.

Return JSON in this exact format:
{"matches": [{"offerIndex": 0, "partnerName": "Exact Name As Listed", "confidenceScore": 0.85, "rationale": "2-3 sentences explaining why this intro would be valuable", "clientFacingLanguage": "2-3 sentences to share with both parties about why they should connect"}]}

Return ONLY the JSON object. No other text.`;

  return { system, user };
}
