/**
 * Fail-closed review receipt schema and binding tests.
 */
import { describe, expect, test } from "bun:test";
import { parseReviewReceipt, validateReviewReceipt } from "./review-receipt";
import type { SummaryReviewReceipt } from "./summary-types";

const binding = {
  docId: "sample",
  sourcePath: "docs/sample.md",
  sourceHash: "sha256:" + "a".repeat(64),
  semanticSummaryHash: "sha256:" + "b".repeat(64),
};

const good = (): SummaryReviewReceipt => ({
  schemaVersion: 1,
  docId: "sample",
  sourcePath: "docs/sample.md",
  sourceHash: binding.sourceHash,
  semanticSummaryHash: binding.semanticSummaryHash,
  verdict: "APPROVE",
  reviewer: "independent-reviewer-1",
  notes: "Page and H2 summaries match source constraints.",
  reviewedAt: "2026-07-25T12:00:00.000Z",
});

describe("parseReviewReceipt", () => {
  test("accepts a well-formed receipt", () => {
    expect(parseReviewReceipt(good())?.docId).toBe("sample");
  });

  test("rejects non-objects and bad schema", () => {
    expect(parseReviewReceipt(null)).toBeNull();
    expect(parseReviewReceipt({ ...good(), schemaVersion: 2 })).toBeNull();
    expect(parseReviewReceipt({ ...good(), reviewedAt: "not-a-date" })).toBeNull();
  });
});

describe("validateReviewReceipt", () => {
  test("current APPROVE receipt passes", () => {
    const result = validateReviewReceipt(good(), binding);
    expect(result.ok).toBe(true);
  });

  test("missing receipt fails", () => {
    const result = validateReviewReceipt(null, binding);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "missing-receipt")).toBe(true);
  });

  test("empty reviewer and empty APPROVE notes fail", () => {
    expect(validateReviewReceipt({ ...good(), reviewer: "  " }, binding).ok).toBe(false);
    expect(validateReviewReceipt({ ...good(), notes: "" }, binding).ok).toBe(false);
  });

  test("stale source or semantic-summary hash fails", () => {
    const staleSource = validateReviewReceipt(
      { ...good(), sourceHash: "sha256:" + "c".repeat(64) },
      binding,
    );
    expect(staleSource.issues.some((i) => i.code === "receipt-source-stale")).toBe(true);
    const staleSummary = validateReviewReceipt(
      { ...good(), semanticSummaryHash: "sha256:" + "d".repeat(64) },
      binding,
    );
    expect(staleSummary.issues.some((i) => i.code === "receipt-summary-stale")).toBe(true);
  });

  test("mismatched docId and sourcePath fail", () => {
    expect(validateReviewReceipt({ ...good(), docId: "other" }, binding).ok).toBe(false);
    expect(validateReviewReceipt({ ...good(), sourcePath: "docs/other.md" }, binding).ok).toBe(false);
  });

  test("each required field malformation is rejected", () => {
    expect(validateReviewReceipt({ ...good(), verdict: "MAYBE" }, binding).ok).toBe(false);
    expect(validateReviewReceipt({ ...good(), sourceHash: "nope" }, binding).ok).toBe(false);
    expect(validateReviewReceipt({ ...good(), reviewedAt: "" }, binding).ok).toBe(false);
  });
});
