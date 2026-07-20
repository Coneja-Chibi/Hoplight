/**
 * Parse and serialize loss reports. These are derived at orchestration boundaries from escrow and
 * live coverage declarations, so every CLI/API export has one report even before format-specific
 * codecs add narrower warnings.
 */
import type { CanonicalEntity } from "./canonical";
import type { CoverageDecl } from "./coverage";
import { coversPath } from "./coverage";

export interface ReportCounts {
  escrowed: number;
  dropped: number;
  escrowShadowed: number;
  warnings: number;
}

export interface LossReport {
  counts: ReportCounts;
  escrowed: string[];
  dropped: string[];
  escrowShadowed: string[];
  warnings: string[];
}

export type ParseReport = LossReport;
export type SerializeReport = LossReport;

const uniqueSorted = (values: readonly string[]): string[] => [...new Set(values)].sort();

/** Build counts from named lists so the two views can never disagree. */
export function lossReport(parts?: Partial<Omit<LossReport, "counts">>): LossReport {
  const escrowed = uniqueSorted(parts?.escrowed ?? []);
  const dropped = uniqueSorted(parts?.dropped ?? []);
  const escrowShadowed = uniqueSorted(parts?.escrowShadowed ?? []);
  const warnings = uniqueSorted(parts?.warnings ?? []);
  return {
    counts: {
      escrowed: escrowed.length,
      dropped: dropped.length,
      escrowShadowed: escrowShadowed.length,
      warnings: warnings.length,
    },
    escrowed,
    dropped,
    escrowShadowed,
    warnings,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function populatedPaths(value: unknown, prefix = ""): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.length > 0 && prefix ? [prefix] : [];
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      populatedPaths(child, prefix ? `${prefix}.${key}` : key));
  }
  if (value === false || value === 0 || value === "") return [];
  return prefix ? [prefix] : [];
}

/** Report fields intentionally sealed by a parser under its source-format escrow entry. */
export function buildParseReport(entity: CanonicalEntity<string, unknown>, sourceId: string): ParseReport {
  const source = entity.original?.[sourceId];
  const escrowed = Object.keys(source?.unmapped ?? {}).map((key) => `original.${sourceId}.unmapped.${key}`);
  return lossReport({ escrowed });
}

export interface ReportTarget {
  id: string;
  native?: boolean;
  coverage?: CoverageDecl;
}

/**
 * Report populated canonical paths the target does not claim and foreign escrow the target cannot
 * re-emit. Same-format escrow is not named as dropped because its owning codec merges it back.
 */
export function buildSerializeReport(
  entity: CanonicalEntity<string, unknown>,
  target: ReportTarget,
): SerializeReport {
  if (target.native) return lossReport();
  const warnings: string[] = [];
  const dropped = target.coverage
    ? populatedPaths(entity.body).filter((path) => !coversPath(target.coverage!, path))
    : [];
  if (!target.coverage) warnings.push(`${target.id}: canonical field coverage is not declared`);
  for (const [formatId, entry] of Object.entries(entity.original ?? {})) {
    if (formatId === target.id || formatId === "vaud-studio") continue;
    if (entry?.raw !== undefined) dropped.push(`original.${formatId}.raw`);
    for (const key of Object.keys(entry?.unmapped ?? {})) {
      dropped.push(`original.${formatId}.unmapped.${key}`);
    }
  }
  return lossReport({ dropped, warnings });
}
