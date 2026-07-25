/**
 * CLI-core behavior for semantic docs summaries without mutating the real corpus.
 * Covers Plan 08 enforcement: approval, receipts, repair guidance, stamp invalidation.
 */
import { describe, expect, test } from "bun:test";
import type { DocRecord } from "../src/docs/types";
import type { SemanticDocSummary, SummaryReviewReceipt } from "../src/docs/summary-types";
import {
  hashSemanticSummary,
  scaffoldSemanticSummary,
} from "../src/docs/summary-corpus";
import {
  buildSummaryQueue,
  checkPageApproved,
  checkPageAuthor,
  createScaffold,
  derivePageStatus,
  formatRepairGuidance,
  inventoryCorpus,
  inventoryPage,
  mergeReviewProjection,
  projectionsEqual,
  reviewPathFor,
  sidecarPathFor,
  stampPage,
  type SummaryCorpusPage,
} from "./docs-summaries-core";

const mdA = `# A\n\n## One\n\nBody for section one with enough prose for hashing.\n\n## Two\n\nBody for section two.\n`;
const mdB = `# B\n\n## Only\n\nShort page body.\n`;

const record = (id: string, path: string): DocRecord => ({
  id,
  path,
  title: id,
  audience: "dev",
  summary: "blurb",
  tags: [],
  related: [],
  semanticSummary: "",
  topics: [],
  anchors: [],
});

const fillWords = (n: number, seed: string): string =>
  Array.from({ length: n }, (_, i) => `${seed}${i}`).join(" ");

const fillSidecar = (rec: DocRecord, markdown: string): SemanticDocSummary => {
  const scaffold = scaffoldSemanticSummary(rec, markdown);
  return {
    ...scaffold,
    summary: fillWords(150, "page"),
    topics: ["topic a", "topic b", "topic c"],
    sections: scaffold.sections.map((section) => ({
      ...section,
      summary: fillWords(section.level === 2 ? 90 : 50, section.slug),
      topics: [`${section.slug} t1`, `${section.slug} t2`],
      children: section.children.map((child) => ({
        ...child,
        summary: fillWords(50, child.slug),
        topics: [`${child.slug} t1`, `${child.slug} t2`],
      })),
    })),
  };
};

const approve = (sidecar: SemanticDocSummary): SummaryReviewReceipt => ({
  schemaVersion: 1,
  docId: sidecar.docId,
  sourcePath: sidecar.sourcePath,
  sourceHash: sidecar.sourceHash,
  semanticSummaryHash: hashSemanticSummary(sidecar),
  verdict: "APPROVE",
  reviewer: "independent-reviewer-1",
  notes: "Page and H2 summaries match source.",
  reviewedAt: "2026-07-25T12:00:00.000Z",
});

const pageOf = (
  id: string,
  path: string,
  markdown: string,
  sidecar: SemanticDocSummary | null = null,
  review: SummaryReviewReceipt | null = null,
): SummaryCorpusPage => ({
  record: record(id, path),
  markdown,
  sidecarPath: sidecarPathFor(path),
  reviewPath: reviewPathFor(path),
  sidecar,
  reviewRaw: review,
  review,
});

describe("path helpers", () => {
  test("mirrors source paths under summaries and reviews", () => {
    expect(sidecarPathFor("docs/reference/kit/tools.md")).toBe("docs/summaries/reference/kit/tools.json");
    expect(reviewPathFor("docs/01-VISION.md")).toBe("docs/summary-reviews/01-VISION.json");
  });
});

describe("scaffold and stamp", () => {
  test("scaffold refuses overwrite and stamp refuses empty", () => {
    const rec = record("a", "docs/a.md");
    const scaffold = createScaffold(rec, mdA, null);
    expect(scaffold.summary).toBe("");
    expect(scaffold.sections).toHaveLength(2);
    expect(() => createScaffold(rec, mdA, scaffold)).toThrow(/refuse overwrite/);
    expect(() => stampPage(rec, mdA, scaffold)).toThrow(/empty/);
  });

  test("stamp after source edit invalidates prior approval binding", () => {
    const rec = record("a", "docs/a.md");
    const filled = fillSidecar(rec, mdA);
    const receipt = approve(filled);
    const edited = `${mdA}\nExtra.\n`;
    const stamped = stampPage(rec, edited, filled);
    expect(stamped.changed.length).toBeGreaterThan(0);
    expect(stamped.summary.sourceHash).not.toBe(receipt.sourceHash);
    const page = pageOf("a", "docs/a.md", edited, stamped.summary, receipt);
    expect(inventoryPage(page).status).toBe("READY_FOR_REVIEW");
    expect(checkPageApproved(page).ok).toBe(false);
    expect(checkPageAuthor(page).ok).toBe(true);
  });
});

describe("inventory and queue", () => {
  test("inventory reports missing sidecars without inventing status by hand", () => {
    const pages = [pageOf("a", "docs/a.md", mdA), pageOf("b", "docs/b.md", mdB)];
    const inv = inventoryCorpus(pages);
    expect(inv.missing).toBe(2);
    expect(inv.todo).toBe(2);
  });

  test("queue never splits a page and preserves stable order", () => {
    const recA = record("a", "docs/a.md");
    const recB = record("b", "docs/b.md");
    const pages = [
      pageOf("a", "docs/a.md", mdA, fillSidecar(recA, mdA)),
      pageOf("b", "docs/b.md", mdB, fillSidecar(recB, mdB)),
    ];
    const queue = buildSummaryQueue(pages, 10, "2026-07-25");
    expect(queue.totalPages).toBe(2);
    const ids = queue.batches.flatMap((b) => b.pages.map((p) => p.docId));
    expect(ids).toEqual(["a", "b"]);
  });
});

describe("approval enforcement", () => {
  test("valid sidecar without receipt is READY_FOR_REVIEW and fails global check", () => {
    const rec = record("a", "docs/a.md");
    const filled = fillSidecar(rec, mdA);
    const page = pageOf("a", "docs/a.md", mdA, filled);
    expect(checkPageAuthor(page).ok).toBe(true);
    expect(checkPageApproved(page).ok).toBe(false);
    expect(inventoryPage(page).status).toBe("READY_FOR_REVIEW");
    const guidance = formatRepairGuidance(inventoryPage(page)).join("\n");
    expect(guidance).toContain("docs:summaries:review -- a APPROVE");
    expect(guidance).toMatch(/must not self-review/i);
  });

  test("REVISE and BLOCK fail global check", () => {
    const rec = record("a", "docs/a.md");
    const filled = fillSidecar(rec, mdA);
    for (const verdict of ["REVISE", "BLOCK"] as const) {
      const receipt = { ...approve(filled), verdict, notes: "needs work" };
      const page = pageOf("a", "docs/a.md", mdA, filled, receipt);
      expect(checkPageApproved(page).ok).toBe(false);
      expect(["REVISE", "BLOCKED"]).toContain(inventoryPage(page).status);
    }
  });

  test("stale source hash or semantic-summary hash on receipt fails", () => {
    const rec = record("a", "docs/a.md");
    const filled = fillSidecar(rec, mdA);
    const base = approve(filled);
    const staleSource = pageOf("a", "docs/a.md", mdA, filled, {
      ...base,
      sourceHash: "sha256:" + "0".repeat(64),
    });
    expect(checkPageApproved(staleSource).ok).toBe(false);
    const staleSummary = pageOf("a", "docs/a.md", mdA, filled, {
      ...base,
      semanticSummaryHash: "sha256:" + "1".repeat(64),
    });
    expect(checkPageApproved(staleSummary).ok).toBe(false);
  });

  test("current valid APPROVE receipt passes global check", () => {
    const rec = record("a", "docs/a.md");
    const filled = fillSidecar(rec, mdA);
    const page = pageOf("a", "docs/a.md", mdA, filled, approve(filled));
    expect(inventoryPage(page).status).toBe("APPROVED");
    expect(checkPageApproved(page).ok).toBe(true);
  });
});

describe("repair guidance", () => {
  test("new-page TODO includes exact scaffold command", () => {
    const page = inventoryPage(pageOf("guide/new", "docs/guide/new.md", mdA));
    const text = formatRepairGuidance(page).join("\n");
    expect(text).toContain("bun run docs:summaries:scaffold -- guide/new");
    expect(text).toContain("docs/summaries/guide/new.json");
  });

  test("stale path does not recommend blind hash stamping alone", () => {
    const rec = record("a", "docs/a.md");
    const filled = fillSidecar(rec, mdA);
    const edited = `${mdA}\nTail.\n`;
    const stamped = stampPage(rec, edited, filled);
    const page = inventoryPage(pageOf("a", "docs/a.md", edited, stamped.summary, approve(filled)));
    const text = formatRepairGuidance(page).join("\n");
    expect(text).toMatch(/Do not stamp without reviewing prose/);
    expect(text).toContain("re-read changed ranges");
  });

  test("REVISE path mentions re-review", () => {
    const rec = record("a", "docs/a.md");
    const filled = fillSidecar(rec, mdA);
    const page = inventoryPage(pageOf("a", "docs/a.md", mdA, filled, {
      ...approve(filled),
      verdict: "REVISE",
      notes: "Expand the second H2.",
    }));
    const text = formatRepairGuidance(page).join("\n");
    expect(text).toContain("re-review");
    expect(text).toContain("docs:summaries:review -- a APPROVE");
  });
});

describe("projections", () => {
  test("source edit changes derived status projection away from APPROVED", () => {
    const rec = record("a", "docs/a.md");
    const filled = fillSidecar(rec, mdA);
    const pages = [pageOf("a", "docs/a.md", mdA, filled, approve(filled))];
    const before = mergeReviewProjection(pages, "2026-07-25");
    expect(before.pages[0]!.status).toBe("APPROVED");

    const edited = `${mdA}\nExtra.\n`;
    const stamped = stampPage(rec, edited, filled);
    const afterPages = [pageOf("a", "docs/a.md", edited, stamped.summary, approve(filled))];
    const after = mergeReviewProjection(afterPages, "2026-07-25");
    expect(after.pages[0]!.status).toBe("READY_FOR_REVIEW");

    const beforeText = `${JSON.stringify(before, null, 2)}\n`;
    expect(projectionsEqual(after, beforeText)).toBe(false);
  });

  test("derivePageStatus still returns READY_FOR_REVIEW without review", () => {
    const rec = record("a", "docs/a.md");
    const filled = fillSidecar(rec, mdA);
    const result = checkPageAuthor(pageOf("a", "docs/a.md", mdA, filled));
    expect(derivePageStatus(result, false, filled, null)).toBe("READY_FOR_REVIEW");
  });
});
