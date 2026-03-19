import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const MODELS = {
  opus: "claude-opus-4-6-20250415",
  sonnet: "claude-sonnet-4-5-20250929",
} as const;

type ModelKey = keyof typeof MODELS;

interface LLMCallOptions {
  model?: ModelKey;
  system?: string;
  maxTokens?: number;
  retries?: number;
}

export async function callClaude(
  userPrompt: string,
  options: LLMCallOptions = {}
): Promise<string> {
  const {
    model = "sonnet",
    system,
    maxTokens = 4096,
    retries = 2,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
      }

      const message = await client.messages.create({
        model: MODELS[model],
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages: [{ role: "user", content: userPrompt }],
      });

      const block = message.content[0];
      if (block.type !== "text") {
        throw new Error(`Unexpected content type: ${block.type}`);
      }
      return block.text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === retries) break;
      console.warn(`Claude API attempt ${attempt + 1} failed, retrying...`, lastError.message);
    }
  }

  throw lastError;
}

export function getModelId(key: ModelKey): string {
  return MODELS[key];
}
