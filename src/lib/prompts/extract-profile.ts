export function buildDossierExtractionPrompt(rawText: string): {
  system: string;
  user: string;
} {
  const system = `You are analyzing a professional dossier to extract a structured partner profile for an opportunity matching system. The dossier is a 15-40 page narrative document with up to 12 sections. Extract precise, structured data optimized for opportunity matching. Return valid JSON only — no markdown fences, no commentary.`;

  const user = `DOSSIER TEXT:
${rawText}

Extract the following structured data (return as a single JSON object):

{
  "name": "Full name of the subject",
  "company": "Current company or business name",
  "title": "Current professional title",
  "industries": ["array of specific industries they operate in — be specific: 'food tech' not 'business', 'editorial media' not 'media'"],
  "servicesOffered": ["array of concrete services/capabilities they provide — list specific offerings, not vague capabilities"],
  "targetClients": "Description of who they serve (size, stage, industry, demographics)",
  "geographicFocus": ["array of geographic markets they operate in"],
  "companyStage": "One of: solo, agency, startup, growth, enterprise",
  "keyStrengths": ["3-5 key professional strengths drawn from the dossier"],
  "uniquePositioning": "What makes them different from competitors — 2-3 sentences synthesized from the dossier",
  "currentChallenges": ["2-4 business challenges they are currently facing — focus on challenges that opportunities could address"],
  "idealIntroProfile": "What kinds of people, companies, or opportunities they are looking for — synthesize from network analysis and strategic insights sections",
  "communicationStyle": "How they communicate professionally — 1-2 sentences from communication style section",
  "matchingSummary": "A 400-500 word paragraph that captures everything a matching engine needs to know to evaluate whether a given business opportunity is relevant to this person. Include: what they do, who they serve, what industries they work in, what makes them unique, what challenges they face, and what kinds of opportunities would be valuable to them. Write in third person, factual tone. This is the most important field — make it dense with signal."
}

EXTRACTION GUIDELINES:
- For industries: be specific and exhaustive. If they work across editorial, brand strategy, and community building, list all three.
- For servicesOffered: list concrete offerings, not capabilities. "Brand storytelling", "editorial strategy", "content production" not "creative services".
- For currentChallenges: focus on business challenges that newsletter opportunities (events, communities, roles, conferences) could help address.
- For matchingSummary: this field will be used verbatim in matching prompts. Make it information-dense. No fluff, no filler.
- If a section of the dossier is missing or sparse, extract what you can and note gaps in the relevant field.

Return ONLY the JSON object. No other text.`;

  return { system, user };
}
