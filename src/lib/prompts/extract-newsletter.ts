export function buildNewsletterExtractionPrompt(
  markdown: string,
  issueNumber: number,
  publishDate: string
): { system: string; user: string } {
  const system = `You are a structured data extraction engine. You parse newsletter content and extract each opportunity into a precise JSON format. You are accurate with dates, URLs, and categorization. Return only valid JSON — no markdown fences, no commentary.`;

  const user = `Given the following newsletter (Issue #${issueNumber}, published ${publishDate}):

---
${markdown}
---

Extract each opportunity into the following JSON structure. Return a JSON array of objects.

Each object must have these fields:
- "sequenceNumber": integer, order of appearance starting at 1
- "category": the label from the "*the* ..." heading (e.g., "Networking Event", "Angel Investment Opportunity", "Community Membership"). Capitalize each word.
- "title": the bold title of the opportunity (the main heading text after the category)
- "description": 2-3 sentence summary of what this opportunity is and why someone would care
- "industries": array of relevant industry/topic tags (be specific: "food tech" not "business", "AI/ML" not "technology")
- "relevantFor": comma-separated description of who this is most relevant for (e.g., "LGBTQ+ founders, AI builders, investors")
- "eventDate": ISO date string (YYYY-MM-DD) if a specific event date is mentioned, null otherwise
- "deadline": ISO date string (YYYY-MM-DD) if a registration or application deadline is mentioned, null otherwise
- "dateConfidence": "confirmed" if an explicit date is stated in the text, "inferred" if a date can be reasonably estimated from context, "unknown" if no date information exists
- "dateDisplayText": human-readable date string (e.g., "March 11, 2026, 6:00-8:00 PM PDT" or "Open until filled" or "April 29-30, 2026"). If no date, use "No deadline — open until filled" or similar.
- "sourceUrl": the URL if one is provided in the text, null otherwise
- "contactMethod": how to engage (e.g., "Register via URL", "DM on LinkedIn", "Comment on LinkedIn post", "Apply via URL")
- "audienceRestrictions": a brief string describing any hard eligibility constraints. Examples: "women only", "LGBTQ+ founders only", "must attend in person in NYC", "requires active Planoly account", "female founders who have raised funding". If the opportunity is open to anyone with no restrictions, use "none". Capture: gender restrictions, geographic requirements (in-person attendance, city-specific), tool/platform prerequisites, identity-based criteria.

IMPORTANT:
- Extract ALL opportunities from the newsletter. Do not skip any.
- For dates: only use "confirmed" if the text explicitly states a date. Use "inferred" if you can estimate (e.g., "last week of March" → infer a date). Use "unknown" for evergreen opportunities with no time component.
- For industries: be specific and multi-tag where relevant. An AI meetup for LGBTQ+ founders should have ["AI/ML", "LGBTQ+ Community", "Startups"].
- For sourceUrl: extract the actual URL, not anchor text.

Return ONLY the JSON array. No other text.`;

  return { system, user };
}
