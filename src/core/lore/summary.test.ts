/** Regression coverage for the summary.test behavior owned beside this file. */
import { describe, expect, test } from "bun:test";
import { emptyLorebookBody } from "./empty-book";
import { estimateBookTokens, estimateEntryTokens, loreSummary } from "./summary";

describe("lore summary", () => {
  test("loreSummary counts entries, enabled, keys", () => {
    const body = emptyLorebookBody("A");
    const s = loreSummary(body);
    expect(s.entryCount).toBe(body.entries.length);
    expect(s.enabledCount).toBeLessThanOrEqual(s.entryCount);
  });

  test("estimateEntryTokens is ceil((title+content)/4) and never negative", () => {
    const body = emptyLorebookBody("A");
    const e = { ...body.entries[0]!, title: "abcd", content: "12345" }; // 9 chars -> 3 tokens
    expect(estimateEntryTokens(e)).toBe(3);
    expect(estimateEntryTokens({ ...e, title: "", content: "" })).toBe(0);
  });

  test("estimateBookTokens sums entries and survives a malformed entries value", () => {
    const body = emptyLorebookBody("A");
    const a = { ...body.entries[0]!, id: "a", title: "abcd", content: "1234" }; // 2
    const b = { ...body.entries[0]!, id: "b", title: "", content: "12345678" }; // 2
    expect(estimateBookTokens({ ...body, entries: [a, b] })).toBe(4);
    expect(estimateBookTokens({ ...body, entries: null as unknown as [] })).toBe(0);
  });
});
