const FIREFLIES_ENDPOINT = "https://api.fireflies.ai/graphql";

function getApiKey(): string {
  const key = process.env.FIREFLIES_API_KEY;
  if (!key) {
    throw new Error("Missing FIREFLIES_API_KEY environment variable");
  }
  return key;
}

async function graphqlRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
  retries = 2
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
      }

      const response = await fetch(FIREFLIES_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        throw new Error(
          `Fireflies API returned ${response.status}: ${await response.text()}`
        );
      }

      const json = (await response.json()) as {
        data?: T;
        errors?: Array<{ message: string }>;
      };

      if (json.errors && json.errors.length > 0) {
        throw new Error(
          `Fireflies GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`
        );
      }

      if (!json.data) {
        throw new Error("Fireflies API returned no data");
      }

      return json.data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === retries) break;
      console.warn(
        `Fireflies API attempt ${attempt + 1} failed, retrying...`,
        lastError.message
      );
    }
  }

  throw lastError;
}

// --- Types ---

export interface FirefliesSentence {
  text: string;
  speaker_name: string;
  start_time: number;
  end_time: number;
}

export interface FirefliesTranscript {
  id: string;
  title: string;
  date: number; // Unix timestamp in ms
  duration: number; // seconds
  participants: string[];
  sentences: FirefliesSentence[];
}

export interface FirefliesSummary {
  id: string;
  title: string;
  keywords: string[];
  action_items: string[];
  overview: string;
}

export interface FirefliesMeetingListItem {
  id: string;
  title: string;
  date: number;
  duration: number;
  participants: string[];
}

// --- Queries ---

const GET_TRANSCRIPT_QUERY = `
  query GetTranscript($id: String!) {
    transcript(id: $id) {
      id
      title
      date
      duration
      participants
      sentences {
        text
        speaker_name
        start_time
        end_time
      }
    }
  }
`;

const GET_SUMMARY_QUERY = `
  query GetTranscriptSummary($id: String!) {
    transcript(id: $id) {
      id
      title
      summary {
        keywords
        action_items
        overview
      }
    }
  }
`;

const LIST_RECENT_MEETINGS_QUERY = `
  query ListRecentMeetings($limit: Int) {
    transcripts(limit: $limit) {
      id
      title
      date
      duration
      participants
    }
  }
`;

// --- Exported functions ---

export async function getTranscript(
  transcriptId: string
): Promise<FirefliesTranscript> {
  const data = await graphqlRequest<{ transcript: FirefliesTranscript }>(
    GET_TRANSCRIPT_QUERY,
    { id: transcriptId }
  );
  return data.transcript;
}

export async function getTranscriptSummary(
  transcriptId: string
): Promise<FirefliesSummary> {
  const data = await graphqlRequest<{
    transcript: {
      id: string;
      title: string;
      summary: { keywords: string[]; action_items: string[]; overview: string };
    };
  }>(GET_SUMMARY_QUERY, { id: transcriptId });

  return {
    id: data.transcript.id,
    title: data.transcript.title,
    keywords: data.transcript.summary.keywords,
    action_items: data.transcript.summary.action_items,
    overview: data.transcript.summary.overview,
  };
}

export async function listRecentMeetings(options?: {
  limit?: number;
}): Promise<FirefliesMeetingListItem[]> {
  const limit = options?.limit ?? 20;
  const data = await graphqlRequest<{
    transcripts: FirefliesMeetingListItem[];
  }>(LIST_RECENT_MEETINGS_QUERY, { limit });
  return data.transcripts;
}
