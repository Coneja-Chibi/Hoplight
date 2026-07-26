/**
 * Pure core for the semantic-docs summary CLI: inventory, queue, status, paths, diagnostics.
 */
import type { DocRecord } from "../src/docs/types";
import {
  reviewPathFor as reviewPathForSrc,
  sidecarPathFor as sidecarPathForSrc,
} from "../src/docs/discover";
import { validateReviewReceipt } from "../src/docs/review-receipt";
import type {
  SemanticDocSummary,
  SummaryBatch,
  SummaryPageStatus,
  SummaryQueue,
  SummaryQueuePage,
  SummaryReviewReceipt,
  SummaryReviewVerdict,
  SummaryValidationIssue,
  SummaryValidationResult,
} from "../src/docs/summary-types";
import {
  hashSemanticSummary,
  scaffoldSemanticSummary,
  splitDocSections,
  stampSemanticSummary,
  validateSemanticSummary,
} from "../src/docs/summary-corpus";

export const sidecarPathFor = sidecarPathForSrc;
export const reviewPathFor = reviewPathForSrc;

export interface SummaryCorpusPage {
  record: DocRecord;
  markdown: string;
  sidecarPath: string;
  reviewPath: string;
  sidecar: SemanticDocSummary | null;
  /** Raw JSON value loaded from disk (may be malformed). */
  reviewRaw: unknown | null;
  /** Validated receipt when parse + shape succeed; null when missing or unparseable. */
  review: SummaryReviewReceipt | null;
  /** True when a review file existed but could not be parsed as an object. */
  reviewParseError?: string;
}

export interface PageInventory {
  docId: string;
  sourcePath: string;
  sidecarPath: string;
  reviewPath: string;
  sectionCount: number;
  sourceChars: number;
  status: SummaryPageStatus;
  issues: SummaryValidationIssue[];
  missingSidecar: boolean;
  stale: boolean;
  invalid: boolean;
  reviewWarnings: number;
}

export interface CorpusInventory {
  pages: PageInventory[];
  missing: number;
  stale: number;
  invalid: number;
  readyForReview: number;
  approved: number;
  revise: number;
  blocked: number;
  todo: number;
  inProgress: number;
  warnings: number;
}

const hasEmptyProse = (summary: SemanticDocSummary): boolean => {
  if (!summary.summary.trim() || summary.topics.length === 0) return true;
  const walk = (sections: SemanticDocSummary["sections"]): boolean => {
    for (const section of sections) {
      if (!section.summary.trim() || section.topics.length === 0) return true;
      if (walk(section.children)) return true;
    }
    return false;
  };
  return walk(summary.sections);
};

export function derivePageStatus(
  validation: SummaryValidationResult | null,
  missingSidecar: boolean,
  sidecar: SemanticDocSummary | null,
  review: SummaryReviewReceipt | null,
  reviewRaw: unknown | null = null,
  reviewParseError?: string,
): SummaryPageStatus {
  if (missingSidecar || !sidecar) return "TODO";
  if (hasEmptyProse(sidecar)) return "IN_PROGRESS";
  if (!validation || !validation.ok) {
    if (review?.verdict === "BLOCK") return "BLOCKED";
    if (review?.verdict === "REVISE") return "REVISE";
    return "IN_PROGRESS";
  }
  // Sidecar is complete and fresh. Approval requires a bound APPROVE receipt.
  if (reviewParseError) return "READY_FOR_REVIEW";
  if (reviewRaw !== null && review === null) return "READY_FOR_REVIEW";
  if (!review) return "READY_FOR_REVIEW";

  const bound = validateReviewReceipt(review, {
    docId: sidecar.docId,
    sourcePath: sidecar.sourcePath,
    sourceHash: sidecar.sourceHash,
    semanticSummaryHash: hashSemanticSummary(sidecar),
  });
  if (!bound.ok) return "READY_FOR_REVIEW";
  if (review.verdict === "APPROVE") return "APPROVED";
  if (review.verdict === "REVISE") return "REVISE";
  if (review.verdict === "BLOCK") return "BLOCKED";
  return "READY_FOR_REVIEW";
}

export function inventoryPage(page: SummaryCorpusPage): PageInventory {
  const parsed = splitDocSections(page.markdown);
  const missingSidecar = page.sidecar === null;
  let validation: SummaryValidationResult | null = null;
  if (page.sidecar) {
    validation = validateSemanticSummary(page.record, parsed, page.sidecar);
  } else if (parsed.errors.length > 0) {
    validation = {
      ok: false,
      issues: parsed.errors.map((message) => ({
        code: "parse",
        path: page.record.id,
        message,
        severity: "error" as const,
      })),
    };
  }

  const issues = [...(validation?.issues ?? [])];
  if (page.reviewParseError) {
    issues.push({
      code: "receipt-parse",
      path: page.record.id,
      message: page.reviewParseError,
      severity: "error",
    });
  } else if (page.reviewRaw !== null && page.sidecar && validation?.ok) {
    const bound = validateReviewReceipt(page.reviewRaw, {
      docId: page.record.id,
      sourcePath: page.record.path,
      sourceHash: page.sidecar.sourceHash,
      semanticSummaryHash: hashSemanticSummary(page.sidecar),
    });
    if (!bound.ok) {
      for (const item of bound.issues) issues.push(item);
    }
  } else if (page.reviewRaw === null && page.sidecar && validation?.ok && !hasEmptyProse(page.sidecar)) {
    issues.push({
      code: "missing-receipt",
      path: page.record.id,
      message: `missing review receipt ${page.reviewPath}`,
      severity: "error",
    });
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const stale = errors.some((i) =>
    i.code === "page-stale"
    || i.code === "section-stale"
    || i.code === "receipt-source-stale"
    || i.code === "receipt-summary-stale");
  const invalid = !missingSidecar && errors.length > 0 && !stale
    && !errors.every((i) =>
      i.code === "missing-receipt"
      || i.code.startsWith("receipt-"));
  const status = derivePageStatus(
    validation,
    missingSidecar,
    page.sidecar,
    page.review,
    page.reviewRaw,
    page.reviewParseError,
  );

  return {
    docId: page.record.id,
    sourcePath: page.record.path,
    sidecarPath: page.sidecarPath,
    reviewPath: page.reviewPath,
    sectionCount: parsed.flat.length,
    sourceChars: parsed.normalized.length,
    status,
    issues,
    missingSidecar,
    stale,
    invalid: status === "IN_PROGRESS" && !missingSidecar && Boolean(validation && !validation.ok),
    reviewWarnings: warnings.length,
  };
}

export function inventoryCorpus(pages: readonly SummaryCorpusPage[]): CorpusInventory {
  const items = pages.map(inventoryPage);
  const count = (status: SummaryPageStatus): number =>
    items.filter((p) => p.status === status).length;
  return {
    pages: items,
    missing: items.filter((p) => p.missingSidecar).length,
    stale: items.filter((p) => p.stale).length,
    invalid: items.filter((p) => p.invalid).length,
    readyForReview: count("READY_FOR_REVIEW"),
    approved: count("APPROVED"),
    revise: count("REVISE"),
    blocked: count("BLOCKED"),
    todo: count("TODO"),
    inProgress: count("IN_PROGRESS"),
    warnings: items.reduce((n, p) => n + p.reviewWarnings, 0),
  };
}

export function buildSummaryQueue(
  pages: readonly SummaryCorpusPage[],
  targetChars: number,
  generated: string,
): SummaryQueue {
  if (targetChars < 1) {
    throw new Error("docs-summaries: target-chars must be >= 1");
  }
  const inventory = inventoryCorpus(pages);
  const byId = new Map(inventory.pages.map((p) => [p.docId, p]));
  const queuePages: SummaryQueuePage[] = [];
  for (const page of pages) {
    const inv = byId.get(page.record.id)!;
    queuePages.push({
      docId: inv.docId,
      sourcePath: inv.sourcePath,
      sidecarPath: inv.sidecarPath,
      sectionCount: inv.sectionCount,
      sourceChars: inv.sourceChars,
      status: inv.status,
    });
  }

  const batches: SummaryBatch[] = [];
  let current: SummaryQueuePage[] = [];
  let currentChars = 0;
  let batchIndex = 0;

  const flush = (): void => {
    if (current.length === 0) return;
    batchIndex += 1;
    batches.push({
      id: `batch-${String(batchIndex).padStart(3, "0")}`,
      sourceChars: currentChars,
      pages: current,
    });
    current = [];
    currentChars = 0;
  };

  for (const page of queuePages) {
    if (current.length > 0 && currentChars + page.sourceChars > targetChars) {
      flush();
    }
    current.push(page);
    currentChars += page.sourceChars;
    if (currentChars >= targetChars) flush();
  }
  flush();

  return {
    generated,
    targetChars,
    totalPages: queuePages.length,
    totalSourceChars: queuePages.reduce((n, p) => n + p.sourceChars, 0),
    batches,
  };
}

export function createScaffold(
  record: DocRecord,
  markdown: string,
  existing: SemanticDocSummary | null,
): SemanticDocSummary {
  if (existing) {
    throw new Error(`docs-summaries: refuse overwrite of existing sidecar for ${record.id}`);
  }
  return scaffoldSemanticSummary(record, markdown);
}

export function stampPage(
  record: DocRecord,
  markdown: string,
  existing: SemanticDocSummary | null,
): { summary: SemanticDocSummary; changed: string[] } {
  if (!existing) {
    throw new Error(`docs-summaries: cannot stamp missing sidecar for ${record.id}`);
  }
  return stampSemanticSummary(record, markdown, existing);
}

/** Author-focused: validate sidecar completeness and freshness only. */
export function checkPageAuthor(page: SummaryCorpusPage): SummaryValidationResult {
  if (!page.sidecar) {
    return {
      ok: false,
      issues: [{
        code: "missing-sidecar",
        path: page.record.id,
        message: `missing sidecar ${page.sidecarPath}`,
        severity: "error",
      }],
    };
  }
  const parsed = splitDocSections(page.markdown);
  return validateSemanticSummary(page.record, parsed, page.sidecar);
}

/** Global completion: sidecar valid and status APPROVED. */
export function checkPageApproved(page: SummaryCorpusPage): SummaryValidationResult {
  const inv = inventoryPage(page);
  if (inv.status === "APPROVED") {
    return {
      ok: true,
      issues: inv.issues.filter((i) => i.severity === "warning"),
    };
  }
  const issues: SummaryValidationIssue[] = inv.issues.filter((i) => i.severity === "error");
  if (issues.length === 0) {
    issues.push({
      code: "not-approved",
      path: page.record.id,
      message: `status is ${inv.status}; global check requires APPROVED`,
      severity: "error",
    });
  }
  return { ok: false, issues };
}

/** @deprecated use checkPageAuthor; kept for call-site migration */
export const checkPage = checkPageAuthor;

export function buildReviewReceipt(args: {
  page: SummaryCorpusPage;
  verdict: SummaryReviewVerdict;
  reviewer: string;
  notes: string;
  reviewedAt: string;
  existing: SummaryReviewReceipt | null;
}): SummaryReviewReceipt {
  const { page, verdict, reviewer, notes, reviewedAt } = args;
  if (!page.sidecar) {
    throw new Error(`docs-summaries: cannot review missing sidecar for ${page.record.id}`);
  }
  const validation = checkPageAuthor(page);
  if (!validation.ok && verdict === "APPROVE") {
    throw new Error(`docs-summaries: refuse APPROVE for invalid/stale ${page.record.id}`);
  }
  if (typeof reviewer !== "string" || reviewer.trim().length === 0) {
    throw new Error("docs-summaries: reviewer must be nonempty");
  }
  if (verdict === "APPROVE" && notes.trim().length === 0) {
    throw new Error("docs-summaries: refuse APPROVE without notes");
  }
  return {
    schemaVersion: 1,
    docId: page.record.id,
    sourcePath: page.record.path as `docs/${string}.md`,
    sourceHash: page.sidecar.sourceHash,
    semanticSummaryHash: hashSemanticSummary(page.sidecar),
    verdict,
    reviewer: reviewer.trim(),
    notes: notes.trim(),
    reviewedAt,
  };
}

export function mergeReviewProjection(
  pages: readonly SummaryCorpusPage[],
  generated: string,
): {
  generated: string;
  count: number;
  pages: Array<{
    docId: string;
    status: SummaryPageStatus;
    verdict: SummaryReviewVerdict | null;
    reviewer: string | null;
    sourceHash: string | null;
    semanticSummaryHash: string | null;
  }>;
} {
  const inventory = inventoryCorpus(pages);
  return {
    generated,
    count: inventory.pages.length,
    pages: inventory.pages.map((p) => {
      const page = pages.find((x) => x.record.id === p.docId)!;
      return {
        docId: p.docId,
        status: p.status,
        verdict: page.review?.verdict ?? null,
        reviewer: page.review?.reviewer ?? null,
        sourceHash: page.review?.sourceHash ?? null,
        semanticSummaryHash: page.review?.semanticSummaryHash ?? null,
      };
    }),
  };
}

export {
  formatInventoryReport,
  formatRepairGuidance,
  isApprovedForMerge,
  normalizeProjectionJson,
  projectionsEqual,
} from "./docs-summaries-report";
