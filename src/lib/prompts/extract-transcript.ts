interface MeetingMetadata {
  title: string;
  date: string;
  participants: string[];
}

export function buildTranscriptExtractionPrompt(
  transcriptText: string,
  metadata: MeetingMetadata
): { system: string; user: string } {
  const system = `You extract structured intelligence from meeting transcripts for a professional services matchmaking agency. Focus on actionable business needs (problems to solve, resources sought) and offers (capabilities, services, expertise). Assess whether this person would value being introduced to others in the network.

Return valid JSON only — no markdown fences, no commentary.`;

  const user = `MEETING METADATA:
Title: ${metadata.title}
Date: ${metadata.date}
Participants: ${metadata.participants.join(", ")}

TRANSCRIPT:
${transcriptText}

INSTRUCTIONS:
Analyze this meeting transcript and extract structured intelligence about the non-Antonym participant. Identify:
1. Who the primary person is (name, company, role)
2. What they NEED — problems, asks, gaps, resources sought
3. What they OFFER — capabilities, services, expertise, value they provide
4. Whether they are intro-worthy — would they value being proactively introduced to others in a professional network?

For each need, assess urgency:
- "high": explicitly asked for help, time-sensitive, or blocking their progress
- "medium": mentioned as a challenge or area of interest
- "low": casually mentioned, aspirational, or long-term

For each offer, assess specificity:
- "concrete": specific service, product, or capability with clear delivery
- "moderate": general area of expertise with some specificity
- "vague": broad claim or aspiration without concrete evidence

Return JSON in this exact format:
{
  "meetingContext": "2-3 sentence description of what this call was about",
  "primaryPerson": {
    "name": "Person's name",
    "company": "Company name or null",
    "role": "Role/title or null"
  },
  "needs": [
    {
      "statement": "What they need, in their words or close paraphrase",
      "context": "Surrounding context that explains urgency/specificity",
      "industries": ["relevant", "industry", "tags"],
      "urgency": "high | medium | low"
    }
  ],
  "offers": [
    {
      "statement": "What they offer",
      "context": "Context about their capability",
      "industries": ["relevant", "industry", "tags"],
      "specificity": "concrete | moderate | vague"
    }
  ],
  "introWorthiness": {
    "score": 0.0,
    "rationale": "Why this person is/isn't worth proactive intros",
    "suggestedTopics": ["Topics that would make good intro hooks"]
  }
}

Return ONLY the JSON object. No other text.`;

  return { system, user };
}
