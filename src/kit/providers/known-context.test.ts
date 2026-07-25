/** Known model-context tests for exact ids, provider prefixes, and fallback behavior. */
import { describe, expect, test } from "bun:test";
import { knownContext } from "./known-context";

describe("knownContext", () => {
  test("resolves an exact ENV_PROVIDERS model id", () => {
    expect(knownContext("claude-opus-4-8")).toBe(1_000_000);
    expect(knownContext("gpt-4o")).toBe(128_000);
    expect(knownContext("gemini-2.5-pro")).toBe(1_048_576);
  });

  test("is case-insensitive and trims surrounding space", () => {
    expect(knownContext("  Claude-Opus-4-8 ")).toBe(1_000_000);
  });

  test("resolves a path-prefixed id via its last segment", () => {
    expect(knownContext("anthropic/claude-opus-4-8")).toBe(1_000_000);
  });

  test("returns undefined for an unknown model (deny by absence)", () => {
    expect(knownContext("some-未知-model")).toBeUndefined();
    expect(knownContext("gpt-5-turbo")).toBeUndefined();
  });

  test("returns undefined for empty or non-string input", () => {
    expect(knownContext("")).toBeUndefined();
    expect(knownContext(undefined)).toBeUndefined();
  });
});
