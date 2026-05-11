import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const MODELS = {
  opus: "claude-opus-4-6",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",
} as const;

type ModelKey = keyof typeof MODELS;

interface LLMCallOptions {
  model?: ModelKey;
  system?: string;
  maxTokens?: number;
  retries?: number;
}

export class MaxTokensError extends Error {
  constructor(maxTokens: number) {
    super(
      `Claude response hit max_tokens (${maxTokens}). Output truncated — raise maxTokens or reduce input size.`
    );
    this.name = "MaxTokensError";
  }
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

      // Use streaming: the SDK rejects non-streaming calls when the worst-case
      // completion time (60 * 60 * maxTokens / 128_000 seconds) exceeds 10
      // minutes, which kicks in above ~21k maxTokens. Streaming sidesteps the
      // check and is the SDK's official recommendation for long outputs.
      const stream = client.messages.stream({
        model: MODELS[model],
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages: [{ role: "user", content: userPrompt }],
      });

      const message = await stream.finalMessage();

      if (message.stop_reason === "max_tokens") {
        throw new MaxTokensError(maxTokens);
      }

      const block = message.content[0];
      if (block.type !== "text") {
        throw new Error(`Unexpected content type: ${block.type}`);
      }
      return block.text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Retrying won't help when the same prompt overflows the same budget.
      if (lastError instanceof MaxTokensError) throw lastError;
      if (attempt === retries) break;
      console.warn(`Claude API attempt ${attempt + 1} failed, retrying...`, lastError.message);
    }
  }

  throw lastError;
}

export function getModelId(key: ModelKey): string {
  return MODELS[key];
}
