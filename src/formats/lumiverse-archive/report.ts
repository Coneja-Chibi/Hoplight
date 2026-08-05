/**
 * The import report (spec Behavior step 7 and the Public API sketch). Its whole job is honesty:
 * per-kind totals, the rows that failed and why, the tables that were never read, the binaries
 * that were missing, and the links that resolved to nothing.
 *
 * The skipped-tables list is the part users most need. Nobody should finish an import believing
 * their chats came along, and a row count quoted from manifest-stats makes the omission concrete.
 * When stats are absent the count is null, which reads as unknown rather than zero.
 */
import type { LvbakManifest } from "./manifest";
import { rowId, rowName, type LvbakKind } from "./tables";

export interface ImportedEntity {
  id: string;
  name: string;
}

export interface LvbakRowFailure {
  table: string;
  rowId: string;
  name?: string;
  reason: string;
}

export interface SkippedTable {
  table: string;
  /** Rows from manifest-stats, or null when no stats were available. Never zero as a guess. */
  rows: number | null;
}

export interface UnresolvedLink {
  from: string;
  to: string;
  reason: string;
}

export interface LvbakImportReport {
  imported: Record<LvbakKind, ImportedEntity[]>;
  failed: LvbakRowFailure[];
  skippedTables: SkippedTable[];
  missingBinaries: string[];
  unresolvedLinks: UnresolvedLink[];
  warnings: string[];
}

export const ENCRYPTED_SECRETS_WARNING =
  "Encrypted API keys were not imported. The key lives only in your separate Lumiverse ticket file, and Hoplight never asks for it.";

export const VECTORS_WARNING =
  "Vector index data was skipped. Nothing in Hoplight reads Lumiverse vectors.";

export function createLvbakReport(): LvbakImportReport {
  return {
    imported: { character: [], lorebook: [], preset: [], persona: [], regex: [] },
    failed: [],
    skippedTables: [],
    missingBinaries: [],
    unresolvedLinks: [],
    warnings: [],
  };
}

export function recordImported(
  report: LvbakImportReport,
  kind: LvbakKind,
  entity: ImportedEntity,
): void {
  report.imported[kind].push(entity);
}

export function recordFailure(report: LvbakImportReport, failure: LvbakRowFailure): void {
  report.failed.push(failure);
}

/**
 * Build a row failure from whatever a synthesize/dispatch try/catch just caught (spec Behavior step
 * 7's outer catch, one per kind module). Shared so every kind module names the failing row the same
 * way rather than five slightly different reasons-from-an-error idioms.
 */
export function codecRowFailure(table: string, row: Record<string, unknown>, error: unknown): LvbakRowFailure {
  const failure: LvbakRowFailure = {
    table,
    rowId: rowId(row),
    reason: error instanceof Error ? error.message : String(error),
  };
  const name = rowName(row);
  if (name !== undefined) failure.name = name;
  return failure;
}

/** Replaces the list wholesale: the table walk computes it once from the entry names and stats. */
export function setSkippedTables(
  report: LvbakImportReport,
  skipped: readonly SkippedTable[],
): void {
  report.skippedTables = [...skipped];
}

/** Deduped: one absent avatar referenced by forty rows is one missing binary, not forty. */
export function recordMissingBinary(report: LvbakImportReport, path: string): void {
  if (!report.missingBinaries.includes(path)) report.missingBinaries.push(path);
}

export function recordUnresolvedLink(report: LvbakImportReport, link: UnresolvedLink): void {
  report.unresolvedLinks.push(link);
}

/** Deduped: a warning repeated per row is noise that buries the ones that matter. */
export function addWarning(report: LvbakImportReport, text: string): void {
  if (!report.warnings.includes(text)) report.warnings.push(text);
}

/** The two content flags each earn a standing warning, whether or not their entries were seen. */
export function applyManifestWarnings(
  report: LvbakImportReport,
  manifest: LvbakManifest,
): void {
  if (manifest.hasEncryptedSecrets) addWarning(report, ENCRYPTED_SECRETS_WARNING);
  if (manifest.includeVectors) addWarning(report, VECTORS_WARNING);
}

export function reportTotals(report: LvbakImportReport): {
  imported: number;
  failed: number;
  skippedTables: number;
} {
  return {
    imported: Object.values(report.imported).reduce((n, list) => n + list.length, 0),
    failed: report.failed.length,
    skippedTables: report.skippedTables.length,
  };
}
