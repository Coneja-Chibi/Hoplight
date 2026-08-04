/**
 * Content-based detection for .lvbak archives (specs/formats/lumiverse-archive.md Detection).
 * Never extension-based: the user may have renamed the file or unzipped it into a folder.
 *
 * Cheap by contract: an entry listing plus the two manifests, no table ever opened. Fail closed,
 * so anything unreadable is a non-match and detection falls through to charx or bundle handling.
 * A ZIP whose manifest.json names a different producer is NOT this format.
 *
 * A schemaVersion past what we support is REPORTED, not denied. Calling a version-2 archive "not a
 * Lumiverse archive" would send a real .lvbak down the charx path and produce a confusing failure;
 * the importer owns the versioned error, and isSupportedLvbakSchema is how it decides.
 */
import { DATABASE_PREFIX, MANIFEST_ENTRY } from "./layout";
import { LUMIVERSE_PRODUCER, readManifest, readStats } from "./manifest";
import type { LvbakEntrySource } from "./source";

/** The only schemaVersion accepted today, mirroring Lumiverse's own importer. */
export const LVBAK_SCHEMA_VERSION = 1;

export interface LvbakDetection {
  isLumiverseArchive: boolean;
  schemaVersion?: number;
  ndjsonFormatVersion?: number;
  hasEncryptedSecrets?: boolean;
  /** From manifest-stats.json when present. Never from manifest.json's placeholder. */
  counts?: Record<string, number>;
}

const noMatch = (): LvbakDetection => ({ isLumiverseArchive: false });

/** True only for an archive this build can actually import. */
export const isSupportedLvbakSchema = (detection: LvbakDetection): boolean =>
  detection.isLumiverseArchive && detection.schemaVersion === LVBAK_SCHEMA_VERSION;

export async function detectLumiverseArchive(
  source: LvbakEntrySource,
): Promise<LvbakDetection> {
  try {
    const names = await source.list();
    if (!names.includes(MANIFEST_ENTRY)) return noMatch();
    if (!names.some((name) => name.startsWith(DATABASE_PREFIX))) return noMatch();

    const manifest = await readManifest(source);
    if (!manifest || manifest.producer !== LUMIVERSE_PRODUCER) return noMatch();

    const stats = await readStats(source);
    const detection: LvbakDetection = {
      isLumiverseArchive: true,
      schemaVersion: manifest.schemaVersion,
      hasEncryptedSecrets: manifest.hasEncryptedSecrets,
    };
    if (manifest.ndjsonFormatVersion !== undefined) {
      detection.ndjsonFormatVersion = manifest.ndjsonFormatVersion;
    }
    if (stats) detection.counts = stats.counts;
    return detection;
  } catch {
    // Bounds breach, malformed ZIP, unreadable directory: all the same answer at this layer.
    return noMatch();
  }
}
