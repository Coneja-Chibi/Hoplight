/** Bounded session-result storage and opaque traversal coverage. */
import { describe, expect, test } from "bun:test";
import { createResultStore } from "./store";

describe("ResultStore", () => {
  test("captures oversized output behind an opaque readable handle", () => {
    const store = createResultStore({ inlineChars: 8, maxEntryBytes: 100 });
    const captured = store.capture("piece", "alpha\nbeta\ngamma");

    expect(captured.spilled).toBe(true);
    if (!captured.spilled) throw new Error("expected spill");
    expect(captured.handle).toMatch(/^result-\d+$/);
    expect(captured.peek).toBe("alpha\nbe");
    expect(store.stat(captured.handle!)).toMatchObject({
      totalChars: 16,
      totalLines: 3,
      label: "piece",
    });
    expect(store.read(captured.handle!, { offset: 8, limit: 8 })).toMatchObject({
      content: "ta\ngamma",
      nextOffset: null,
    });
  });

  test("searches literal text with bounded rows and never exposes paths", () => {
    const store = createResultStore({ inlineChars: 4, maxEntryBytes: 100 });
    const captured = store.capture("piece", "first\nNeedle one\nneedle two\nlast");
    if (!captured.spilled) throw new Error("expected spill");
    const result = store.search(captured.handle, { query: "needle", limit: 1 });

    if (!result) throw new Error("expected stored result");
    expect(result.matches).toEqual([{ line: 2, text: "Needle one" }]);
    expect(JSON.stringify(result)).not.toContain("\\");
    const literal = store.search(captured.handle, { query: "[", limit: 5 });
    expect(literal?.matches).toEqual([]);
  });

  test("evicts oldest entries and refuses oversized storage", () => {
    const store = createResultStore({
      inlineChars: 1,
      maxEntryBytes: 5,
      maxEntries: 1,
      maxTotalBytes: 5,
    });
    const first = store.capture("first", "12");
    const second = store.capture("second", "34");

    if (!first.spilled || !second.spilled) throw new Error("expected spills");
    expect(store.stat(first.handle)).toBeNull();
    expect(store.stat(second.handle)).not.toBeNull();
    expect(() => store.capture("large", "123456")).toThrow("result exceeds");
  });

  test("enforces entry and aggregate storage caps in UTF-8 bytes", () => {
    const store = createResultStore({
      inlineChars: 1,
      maxEntryBytes: 8,
      maxEntries: 2,
      maxTotalBytes: 8,
    });
    const first = store.capture("first", "éé");
    const second = store.capture("second", "界a");

    if (!first.spilled || !second.spilled) throw new Error("expected spills");
    expect(store.stat(first.handle)).toMatchObject({ totalChars: 2, totalBytes: 4 });
    expect(store.stat(second.handle)).toMatchObject({ totalChars: 2, totalBytes: 4 });
    expect(() => store.capture("too-large", "界界界")).toThrow("9 bytes");
  });
});
