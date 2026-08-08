/**
 * The two manifests (specs/formats/lumiverse-archive.md Behavior step 2).
 *
 * manifest.json is the archive's identity: producer, schemaVersion, the NDJSON line-ceiling
 * signal, and the two content flags. Its own `counts` and `missingFiles` fields are placeholders
 * that a real export always writes as {} and [], so this module never surfaces them; believing
 * them would report zero rows for a full archive.
 *
 * manifest-stats.json carries the real per-table counts and the list of files rows reference but
 * disk lacked at export time. It is optional: absent or truncated degrades reporting to unknown
 * and never fails the import.
 */
import { readEntryText, type LvbakEntrySource } from "./source";
import { MANIFEST_ENTRY, STATS_ENTRY } from "./layout";

export const LUMIVERSE_PRODUCER = "lumiverse";

/** Generous for a small JSON object, tight enough that a hostile manifest cannot be gigabytes. */
export const MANIFEST_MAX_BYTES = 4 * 1024 * 1024;
/** The real export inspected listed 1,971 missing files, so stats need real room. */
export const STATS_MAX_BYTES = 16 * 1024 * 1024;

export interface LvbakManifest {
  schemaVersion: number;
  producer: string;
  /** Absent on legacy archives, which is exactly what raises the NDJSON line ceiling. */
  ndjsonFormatVersion?: number;
  exportedAt?: string;
  hasEncryptedSecrets: boolean;
  includeVectors: boolean;
}

export interface LvbakStats {
  counts: Record<string, number>;
  missingFiles: string[];
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const bool = (v: unknown): boolean => v === true;

const readJson = (text: string): Rec | null => {
  try {
    const parsed: unknown = JSON.parse(text);
    return isRec(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/** Null unless the object carries a string producer and an integer schemaVersion. */
export function parseManifest(text: string): LvbakManifest | null {
  const raw = readJson(text);
  if (!raw) return null;
  if (typeof raw.producer !== "string") return null;
  if (typeof raw.schemaVersion !== "number" || !Number.isInteger(raw.schemaVersion)) return null;

  const manifest: LvbakManifest = {
    schemaVersion: raw.schemaVersion,
    producer: raw.producer,
    hasEncryptedSecrets: bool(raw.hasEncryptedSecrets),
    includeVectors: bool(raw.includeVectors),
  };
  if (typeof raw.ndjsonFormatVersion === "number" && Number.isInteger(raw.ndjsonFormatVersion)) {
    manifest.ndjsonFormatVersion = raw.ndjsonFormatVersion;
  }
  if (typeof raw.exportedAt === "string") manifest.exportedAt = raw.exportedAt;
  return manifest;
}

/** Tolerant by design: a stats file missing either field still contributes the one it has. */
export function parseStats(text: string): LvbakStats | null {
  const raw = readJson(text);
  if (!raw) return null;
  const counts: Record<string, number> = {};
  if (isRec(raw.counts)) {
    for (const [table, value] of Object.entries(raw.counts)) {
      if (typeof value === "number" && Number.isFinite(value)) counts[table] = value;
    }
  }
  const missingFiles = Array.isArray(raw.missingFiles)
    ? raw.missingFiles.filter((f): f is string => typeof f === "string")
    : [];
  return { counts, missingFiles };
}

export async function readManifest(source: LvbakEntrySource): Promise<LvbakManifest | null> {
  const names = await source.list();
  if (!names.includes(MANIFEST_ENTRY)) return null;
  return parseManifest(await readEntryText(source, MANIFEST_ENTRY, MANIFEST_MAX_BYTES));
}

/** Absent, oversized, or malformed all mean the same thing to the caller: no stats. */
export async function readStats(source: LvbakEntrySource): Promise<LvbakStats | null> {
  try {
    const names = await source.list();
    if (!names.includes(STATS_ENTRY)) return null;
    return parseStats(await readEntryText(source, STATS_ENTRY, STATS_MAX_BYTES));
  } catch {
    return null;
  }
}
