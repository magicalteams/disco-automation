import { jsonrepair } from "jsonrepair";

/**
 * Parse a JSON response from an LLM, recovering from common malformations.
 *
 * Order of operations:
 *   1. Strip markdown code fences (```json ... ```) that some models add.
 *   2. Try a plain JSON.parse — fast path for valid output.
 *   3. On failure, run jsonrepair (handles missing/trailing commas, stray
 *      quotes, unbalanced brackets, etc.) and re-parse.
 *   4. If both fail, throw with the original parse error and a prefix of
 *      the offending text so the failure is debuggable.
 *
 * Centralized here because every call site that parses model JSON used
 * to repeat the fence-strip + try/catch pattern, and missing one of the
 * steps was the proximate cause of multiple weekly-matching failures.
 */
export function parseModelJson(rawResponse: string): unknown {
  let jsonStr = rawResponse.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    return JSON.parse(jsonStr);
  } catch (firstError) {
    try {
      const repaired = jsonrepair(jsonStr);
      return JSON.parse(repaired);
    } catch (repairError) {
      const firstMsg = firstError instanceof Error ? firstError.message : String(firstError);
      const repairMsg = repairError instanceof Error ? repairError.message : String(repairError);
      throw new Error(
        `Model returned unparseable JSON. Initial parse: ${firstMsg}. After jsonrepair: ${repairMsg}. Raw prefix: ${jsonStr.slice(0, 200)}`
      );
    }
  }
}
