/**
 * Fail-closed parsing and binding validation for semantic summary review receipts.
 * Provenance: audit-plans/08-fix-semantic-docs-enforcement.md.
 */
import type {
  SummaryReviewReceipt,
  SummaryReviewVerdict,
  SummaryValidationIssue,
  SummaryValidationResult,
} from "./summary-types";

const isSha256 = (value: unknown): value is string =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);

const isVerdict = (value: unknown): value is SummaryReviewVerdict =>
  value === "APPROVE" || value === "REVISE" || value === "BLOCK";

const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
};

const issue = (
  severity: "error" | "warning",
  code: string,
  path: string,
  message: string,
): SummaryValidationIssue => ({ severity, code, path, message });

export interface ReviewReceiptBinding {
  docId: string;
  sourcePath: string;
  sourceHash: string;
  semanticSummaryHash: string;
}

/**
 * Parse unknown JSON into a receipt shape without binding checks.
 * Returns null when the payload is not a well-formed receipt object.
 */
export function parseReviewReceipt(value: unknown): SummaryReviewReceipt | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Partial<SummaryReviewReceipt>;
  if (r.schemaVersion !== 1) return null;
  if (typeof r.docId !== "string" || r.docId.length === 0) return null;
  if (typeof r.sourcePath !== "string" || !r.sourcePath.startsWith("docs/") || !r.sourcePath.endsWith(".md")) {
    return null;
  }
  if (!isSha256(r.sourceHash) || !isSha256(r.semanticSummaryHash)) return null;
  if (!isVerdict(r.verdict)) return null;
  if (typeof r.reviewer !== "string") return null;
  if (typeof r.notes !== "string") return null;
  if (!isIsoDate(r.reviewedAt)) return null;
  return {
    schemaVersion: 1,
    docId: r.docId,
    sourcePath: r.sourcePath as `docs/${string}.md`,
    sourceHash: r.sourceHash,
    semanticSummaryHash: r.semanticSummaryHash,
    verdict: r.verdict,
    reviewer: r.reviewer,
    notes: r.notes,
    reviewedAt: r.reviewedAt,
  };
}

/**
 * Validate receipt schema and bind it to the current page source + semantic summary hashes.
 * APPROVE requires a nonempty reviewer and nonempty notes.
 */
export function validateReviewReceipt(
  value: unknown,
  binding: ReviewReceiptBinding,
): SummaryValidationResult {
  const issues: SummaryValidationIssue[] = [];
  const path = binding.docId;

  if (value === null || value === undefined) {
    return {
      ok: false,
      issues: [issue("error", "missing-receipt", path, "missing review receipt")],
    };
  }
  if (!value || typeof value !== "object") {
    return {
      ok: false,
      issues: [issue("error", "receipt-type", path, "review receipt must be an object")],
    };
  }
  const r = value as Partial<SummaryReviewReceipt>;
  if (r.schemaVersion !== 1) {
    issues.push(issue("error", "receipt-schema", path, "schemaVersion must be 1"));
  }
  if (typeof r.docId !== "string" || r.docId.length === 0) {
    issues.push(issue("error", "receipt-doc-id", path, "docId is required"));
  } else if (r.docId !== binding.docId) {
    issues.push(issue("error", "receipt-doc-id", path, `docId must be ${binding.docId}`));
  }
  if (typeof r.sourcePath !== "string") {
    issues.push(issue("error", "receipt-source-path", path, "sourcePath is required"));
  } else if (r.sourcePath !== binding.sourcePath) {
    issues.push(issue("error", "receipt-source-path", path, `sourcePath must be ${binding.sourcePath}`));
  }
  if (!isSha256(r.sourceHash)) {
    issues.push(issue("error", "receipt-source-hash", path, "sourceHash must be sha256:<hex>"));
  } else if (r.sourceHash !== binding.sourceHash) {
    issues.push(issue("error", "receipt-source-stale", path, "receipt sourceHash does not match current sidecar"));
  }
  if (!isSha256(r.semanticSummaryHash)) {
    issues.push(issue(
      "error",
      "receipt-summary-hash",
      path,
      "semanticSummaryHash must be sha256:<hex>",
    ));
  } else if (r.semanticSummaryHash !== binding.semanticSummaryHash) {
    issues.push(issue(
      "error",
      "receipt-summary-stale",
      path,
      "receipt semanticSummaryHash does not match current sidecar",
    ));
  }
  if (!isVerdict(r.verdict)) {
    issues.push(issue("error", "receipt-verdict", path, "verdict must be APPROVE|REVISE|BLOCK"));
  }
  if (typeof r.reviewer !== "string" || r.reviewer.trim().length === 0) {
    issues.push(issue("error", "receipt-reviewer", path, "reviewer must be nonempty"));
  }
  if (typeof r.notes !== "string") {
    issues.push(issue("error", "receipt-notes", path, "notes must be a string"));
  } else if (r.verdict === "APPROVE" && r.notes.trim().length === 0) {
    issues.push(issue("error", "receipt-notes", path, "APPROVE requires nonempty notes"));
  }
  if (!isIsoDate(r.reviewedAt)) {
    issues.push(issue("error", "receipt-timestamp", path, "reviewedAt must be a valid ISO timestamp"));
  }

  return { ok: issues.length === 0, issues };
}
