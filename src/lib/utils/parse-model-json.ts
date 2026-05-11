import { jsonrepair } from "jsonrepair";

/**
 * Find the first balanced JSON group ({...} or [...]) in `text` and return
 * its substring. Skips characters before the first opener and stops when
 * bracket depth returns to zero. String-aware (won't be confused by `{`/`}`
 * inside quoted strings or escape sequences).
 *
 * Handles the case where Claude wraps the JSON in prose preamble or suffix
 * despite "return ONLY the JSON" instructions — the SDK's own structured
 * output helper does similar recovery for thinking-mode responses.
 */
function extractFirstJsonGroup(text: string): string | null {
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{" || text[i] === "[") {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  const opener = text[start];
  const closer = opener === "{" ? "}" : "]";

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === opener) depth++;
    else if (c === closer) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

/**
 * Parse a JSON response from an LLM, recovering from common malformations.
 *
 * Order of operations:
 *   1. Strip markdown code fences (```json ... ```) that some models add.
 *   2. Try a plain JSON.parse — fast path for valid output.
 *   3. On failure, extract the first balanced {...} or [...] group from
 *      the text (skipping any prose preamble or trailing commentary) and
 *      try to parse that.
 *   4. On further failure, run jsonrepair (handles missing/trailing
 *      commas, stray quotes, unbalanced brackets) and re-parse.
 *   5. If all paths fail, throw with both parse errors and a prefix of the
 *      offending text so the failure is debuggable.
 *
 * Centralized here because every call site that parses model JSON used to
 * repeat the fence-strip + try/catch pattern, and missing one of the
 * fallback layers was the proximate cause of multiple weekly-matching
 * failures.
 */
/**
 * Verify the parsed value is a JSON object or array. All call sites of
 * parseModelJson expect structured data, never a primitive; this guards
 * against jsonrepair's permissive behavior, which happily quotes any
 * string into a valid JSON string and would otherwise silently bypass
 * "model returned garbage" failures.
 */
function isObjectOrArray(value: unknown): boolean {
  return typeof value === "object" && value !== null;
}

export function parseModelJson(rawResponse: string): unknown {
  let jsonStr = rawResponse.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  // 1. Fast path: valid JSON object/array.
  let firstError: unknown;
  try {
    const result = JSON.parse(jsonStr);
    if (isObjectOrArray(result)) return result;
    firstError = new Error("parsed JSON is not an object or array");
  } catch (err) {
    firstError = err;
  }

  // 2. Extract balanced JSON group — handles prose preamble/suffix.
  const extracted = extractFirstJsonGroup(jsonStr);
  if (extracted && extracted !== jsonStr) {
    try {
      const result = JSON.parse(extracted);
      if (isObjectOrArray(result)) return result;
    } catch {
      // fall through to jsonrepair
    }
  }

  // 3. jsonrepair as last resort — handles internal syntax glitches.
  try {
    const repaired = jsonrepair(jsonStr);
    const result = JSON.parse(repaired);
    if (isObjectOrArray(result)) return result;
    throw new Error("repaired JSON is not an object or array");
  } catch (repairError) {
    const firstMsg = firstError instanceof Error ? firstError.message : String(firstError);
    const repairMsg = repairError instanceof Error ? repairError.message : String(repairError);
    throw new Error(
      `Model returned unparseable JSON. Initial parse: ${firstMsg}. After jsonrepair: ${repairMsg}. Raw prefix: ${jsonStr.slice(0, 200)}`
    );
  }
}
