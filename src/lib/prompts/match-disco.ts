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
8. For matches with confidence >= 0.7, include an "introDraftEmail" field: a double-sided intro email following this format:
   - Subject line: "Intro"
   - Opening: "Hey [Prospect name] and [Partner name]," followed by "Connecting you two because this feels like a great match."
   - Paragraph 1: Introduce the partner to the prospect. "[Partner name] — Meet [Prospect name], [title/company] ([1-2 key credentials]). [Their specific need/situation the partner can help with]."
   - Paragraph 2: Introduce the prospect to the partner. "[Prospect name] — Meet [Partner name], [title/company] ([1-2 key credentials]). [How they can help with the specific need]."
   - Closing connector: State explicitly who helps whom and why. Then: "I'll let you both take it from here. Happy connecting!"
   - Sign-off: "Cheers, [Your name]"
   - Keep it ~100-150 words total. Direct, warm, specific about expertise and needs. No em dashes, no generic business language. Do not oversell the connection.

Return JSON in this exact format:
{"matches": [{"offerIndex": 0, "partnerName": "Exact Name As Listed", "confidenceScore": 0.85, "rationale": "2-3 sentences explaining why this intro would be valuable", "clientFacingLanguage": "2-3 sentences to share with both parties about why they should connect", "introDraftEmail": "Subject: Intro\\n\\nHey [Prospect] and [Partner],\\n\\nConnecting you two because this feels like a great match.\\n\\n[Partner] — Meet [Prospect], [title/company] ([credentials]). [Need/situation].\\n\\n[Prospect] — Meet [Partner], [title/company] ([credentials]). [How they help].\\n\\n[Explicit connection statement]. I'll let you both take it from here. Happy connecting!\\n\\nCheers,\\n[Your name]"}]}

Return ONLY the JSON object. No other text.`;

  return { system, user };
}
