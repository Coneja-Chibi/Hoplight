/** Verifies paste-card classification, byte caps, and submission assembly. */
import { describe, expect, test } from "bun:test";
import { buildSubmission, classifyPaste, type PasteCard } from "./paste-classify";

describe("classifyPaste", () => {
  test("small single-line paste stays inline", () => {
    expect(classifyPaste("just a word")).toEqual({ kind: "inline" });
  });

  test("many lines becomes a card", () => {
    const r = classifyPaste("a\nb\nc\nd\ne\nf");
    expect(r.kind).toBe("card");
    if (r.kind === "card") {
      expect(r.lineCount).toBe(6);
      expect(r.preview).toBe("pasted text · 6 lines");
      expect(r.truncated).toBe(false);
    }
  });

  test("large single-line paste becomes a card", () => {
    const r = classifyPaste("x".repeat(500));
    expect(r.kind).toBe("card");
  });

  test("oversized paste is truncated, flagged, and never throws", () => {
    const r = classifyPaste("y".repeat(300_000));
    expect(r.kind).toBe("card");
    if (r.kind === "card") {
      expect(r.truncated).toBe(true);
      expect(r.byteLength).toBeLessThanOrEqual(200_000);
      expect(r.preview).toContain("truncated");
    }
  });

  test("the byte cap is exact for multibyte text", () => {
    const r = classifyPaste("é".repeat(200_001));
    expect(r.kind).toBe("card");
    if (r.kind === "card") {
      const actualBytes = new TextEncoder().encode(r.text).length;
      expect(actualBytes).toBeLessThanOrEqual(200_000);
      expect(r.byteLength).toBe(actualBytes);
      expect(r.text.endsWith("\ud800")).toBe(false);
    }
  });

  test("empty paste does not crash", () => {
    expect(() => classifyPaste("")).not.toThrow();
  });
});

describe("buildSubmission", () => {
  const card = (text: string): PasteCard => ({ preview: "", lineCount: 1, byteLength: text.length, truncated: false, text });

  test("draft alone passes through", () => {
    expect(buildSubmission("hello", [])).toBe("hello");
  });

  test("draft plus cards are spliced in order", () => {
    expect(buildSubmission("look at this", [card("BIG PASTE")])).toBe("look at this\n\nBIG PASTE");
  });

  test("empty draft with a card yields just the card", () => {
    expect(buildSubmission("", [card("only paste")])).toBe("only paste");
  });
});
