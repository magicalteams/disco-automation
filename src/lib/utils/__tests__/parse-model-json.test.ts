import { describe, it, expect } from "vitest";
import { parseModelJson } from "../parse-model-json";

describe("parseModelJson", () => {
  describe("fast path", () => {
    it("parses valid JSON object", () => {
      expect(parseModelJson('{"a": 1}')).toEqual({ a: 1 });
    });

    it("parses valid JSON array", () => {
      expect(parseModelJson("[1, 2, 3]")).toEqual([1, 2, 3]);
    });

    it("trims leading/trailing whitespace", () => {
      expect(parseModelJson('  \n  {"a": 1}  \t\n')).toEqual({ a: 1 });
    });
  });

  describe("markdown fences", () => {
    it("strips ```json fences", () => {
      expect(parseModelJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    });

    it("strips bare ``` fences", () => {
      expect(parseModelJson('```\n{"a": 1}\n```')).toEqual({ a: 1 });
    });
  });

  describe("prose preamble/suffix (extract step)", () => {
    it("recovers from prose preamble", () => {
      expect(
        parseModelJson('Here is the JSON you requested:\n\n{"matches": [{"id": 1}]}')
      ).toEqual({ matches: [{ id: 1 }] });
    });

    it("recovers from trailing commentary", () => {
      expect(
        parseModelJson('{"matches": [{"id": 1}]}\n\nLet me know if you need more.')
      ).toEqual({ matches: [{ id: 1 }] });
    });

    it("recovers from prose preamble around array", () => {
      expect(parseModelJson("Sure thing! [1, 2, 3] hope this helps.")).toEqual([
        1,
        2,
        3,
      ]);
    });

    it("respects braces inside strings (does not return prematurely)", () => {
      const raw = 'Output: {"text": "value with } and { inside"}';
      expect(parseModelJson(raw)).toEqual({ text: "value with } and { inside" });
    });

    it("respects escaped quotes inside strings", () => {
      const raw = 'Reply: {"text": "she said \\"hi\\""}';
      expect(parseModelJson(raw)).toEqual({ text: 'she said "hi"' });
    });

    it("handles nested objects in prose context", () => {
      const raw = 'Result: {"a": {"b": {"c": 1}}} done.';
      expect(parseModelJson(raw)).toEqual({ a: { b: { c: 1 } } });
    });
  });

  describe("jsonrepair fallback", () => {
    it("recovers from trailing comma", () => {
      expect(parseModelJson('{"a": 1, "b": 2,}')).toEqual({ a: 1, b: 2 });
    });

    it("recovers from missing comma between array elements", () => {
      // jsonrepair handles this; vanilla JSON.parse and extract both fail
      expect(parseModelJson('[{"a": 1} {"b": 2}]')).toEqual([{ a: 1 }, { b: 2 }]);
    });
  });

  describe("unrecoverable input", () => {
    it("throws with context for non-JSON text", () => {
      expect(() => parseModelJson("this is not JSON at all")).toThrow(
        /unparseable JSON/i
      );
    });

    it("throws includes raw prefix for debugging", () => {
      try {
        parseModelJson("this is not JSON at all");
        throw new Error("should have thrown");
      } catch (err) {
        expect((err as Error).message).toContain("this is not JSON");
      }
    });
  });
});
