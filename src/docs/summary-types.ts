/**
 * Wire types for authored semantic documentation sidecars and review receipts.
 */

export interface SemanticSummary {
  summary: string;
  topics: string[];
}

export interface SemanticSectionSummary extends SemanticSummary {
  slug: string;
  title: string;
  level: 2 | 3;
  sourceHash: string;
  children: SemanticSectionSummary[];
  /** Optional escape hatch when the source range is too short for the normal word band. */
  shortSource?: boolean;
}

export interface SemanticDocSummary extends SemanticSummary {
  schemaVersion: 1;
  docId: string;
  sourcePath: `docs/${string}.md`;
  sourceHash: string;
  sections: SemanticSectionSummary[];
  shortSource?: boolean;
}

export type SummaryReviewVerdict = "APPROVE" | "REVISE" | "BLOCK";

export interface SummaryReviewReceipt {
  schemaVersion: 1;
  docId: string;
  sourcePath: `docs/${string}.md`;
  sourceHash: string;
  semanticSummaryHash: string;
  verdict: SummaryReviewVerdict;
  reviewer: string;
  notes: string;
  reviewedAt: string;
}

export type SummaryPageStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "REVISE"
  | "BLOCKED";

export interface SummaryQueuePage {
  docId: string;
  sourcePath: string;
  sidecarPath: string;
  sectionCount: number;
  sourceChars: number;
  status: SummaryPageStatus;
}

export interface SummaryBatch {
  id: string;
  sourceChars: number;
  pages: SummaryQueuePage[];
}

export interface SummaryQueue {
  generated: string;
  targetChars: number;
  totalPages: number;
  totalSourceChars: number;
  batches: SummaryBatch[];
}

export interface SummaryValidationIssue {
  code: string;
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface SummaryValidationResult {
  ok: boolean;
  issues: SummaryValidationIssue[];
}
