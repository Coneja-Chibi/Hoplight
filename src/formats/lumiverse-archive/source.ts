/**
 * The entry-source seam (specs/formats/lumiverse-archive.md Public API sketch). A .lvbak ZIP and a
 * pre-extracted directory are the same archive to everything downstream: a source enumerates entry
 * names and streams entry bytes, and detection, the NDJSON table reader, and the files/ resolver
 * all run on this interface without knowing which one is underneath. New input shapes become new
 * sources, never new import paths.
 *
 * Path safety lives here so both sources apply exactly one rule, taken verbatim from
 * bundle-import Behavior step 1: reject traversal, absolute, backslash, and NUL paths; skip macOS
 * cruft. A rejected path is evidence for the report, so it is recorded rather than dropped.
 */
import { ArchiveLimitError, isArchiveLimitError, type UnzipBounds } from "../../core/archive";
import { isArchiveFormatError, type AggregateBudget } from "../../core/archive-stream";

/** Why an entry name never reached list(). */
export type EntryRejection = "unsafe" | "cruft";

export interface RejectedEntry {
  name: string;
  reason: EntryRejection;
}

export interface LvbakEntrySource {
  /** Safe entry names in archive order (manifest.json first when the producer wrote it first). */
  list(): Promise<string[]>;
  /** Streamed bytes of one entry. */
  open(name: string): Promise<ReadableStream<Uint8Array>>;
  /** Stored size in bytes, for bounds accounting before opening. */
  size(name: string): Promise<number>;
  /**
   * Names list() refused. Not in the spec's sketch, but the import report has to name what was
   * skipped, and list() alone throws that evidence away.
   */
  rejected(): Promise<RejectedEntry[]>;
}

/**
 * Unsafe per bundle-import step 1: any segment that is empty, ".", or "..", or a path carrying a
 * backslash, a NUL, or a leading slash. Windows drive prefixes are absolute too.
 */
export function isUnsafeEntryName(name: string): boolean {
  if (name === "" || name.startsWith("/") || name.includes("\\") || name.includes("\0")) return true;
  if (/^[a-zA-Z]:/.test(name)) return true;
  return name.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}

/** macOS archive litter: resource forks, .DS_Store, and the __MACOSX sidecar tree. */
export function isMacCruft(name: string): boolean {
  if (name.split("/").includes("__MACOSX")) return true;
  const base = name.slice(name.lastIndexOf("/") + 1);
  return base === ".DS_Store" || base.startsWith("._");
}

/**
 * Split raw entry names into the ones a source may serve and the ones it must refuse. Cruft is
 * checked first: a __MACOSX sidecar is litter to skip, not an attack to report.
 */
export function classifyEntryNames(names: readonly string[]): {
  keep: string[];
  rejected: RejectedEntry[];
} {
  const keep: string[] = [];
  const rejected: RejectedEntry[] = [];
  for (const name of names) {
    if (name.endsWith("/")) continue; // directory markers are not entries
    if (isMacCruft(name)) rejected.push({ name, reason: "cruft" });
    else if (isUnsafeEntryName(name)) rejected.push({ name, reason: "unsafe" });
    else keep.push(name);
  }
  return { keep, rejected };
}

/** A fresh aggregate counter for one archive, shared by every entry that source opens. */
export const newAggregateBudget = (bounds: UnzipBounds): AggregateBudget => ({
  used: 0,
  max: bounds.maxAggregateOriginal,
});

export const missingEntryError = (name: string): Error =>
  new Error(`lumiverse-archive: no entry named ${name}`);

/**
 * A bounds breach (ArchiveLimitError) or a malformed container (ArchiveFormatError): the SOURCE
 * itself can no longer be trusted to answer questions correctly, so this is a whole-archive abort
 * (spec Behavior step 1), never a per-row failure. Every kind module's per-row try/catch checks this
 * first and rethrows rather than swallowing it into recordFailure - otherwise a decompression bomb
 * partway through a table read would surface as a clean-looking partial import instead of a throw.
 */
export const isContainerAbort = (error: unknown): boolean =>
  isArchiveLimitError(error) || isArchiveFormatError(error);

/**
 * Drain an entry into bytes, refusing anything past `maxBytes`. Detection, the manifests, and the
 * files/ resolver all read whole entries, so they need a ceiling of their own: the container budget
 * alone would happily hand back gigabytes.
 */
export async function readEntryBytes(
  source: LvbakEntrySource,
  name: string,
  maxBytes: number,
): Promise<Uint8Array> {
  const reader = (await source.open(name)).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const step = await reader.read();
      if (step.done) break;
      total += step.value.byteLength;
      if (total > maxBytes) {
        throw new ArchiveLimitError(`lumiverse-archive: ${name} exceeds ${maxBytes} bytes`);
      }
      chunks.push(step.value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    joined.set(chunk, at);
    at += chunk.byteLength;
  }
  return joined;
}

/** Text is bytes decoded as UTF-8. Detection and the manifests want text; the files/ resolver wants
 * the bytes themselves, which is why the ceiling and the draining loop live in readEntryBytes. */
export async function readEntryText(
  source: LvbakEntrySource,
  name: string,
  maxBytes: number,
): Promise<string> {
  return new TextDecoder().decode(await readEntryBytes(source, name, maxBytes));
}
