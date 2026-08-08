/**
 * The public API (specs/formats/lumiverse-archive.md Public API sketch): `importLumiverseArchive`
 * is the one function everything else in this folder exists to serve. It owns exactly what the rest
 * of the pipeline deliberately does not: the two errors that abort a whole archive (detect.ts:8-11
 * hands the versioned-schema decision here on purpose, since a future schemaVersion is a real
 * archive, just one this build cannot read), and the wiring that gives every kind stage the same
 * shared resources built exactly once (one `source.list()`, one binaries resolver, one link map, one
 * images index, one gallery index) rather than each kind module reaching back into the source for
 * its own copy.
 *
 * Everything past detection is per-row isolation, spec Behavior step 7's full promise: a container-
 * level bounds breach (ArchiveLimitError, ArchiveFormatError) still aborts the whole archive, exactly
 * as bundle-import's own ceilings do, but nothing else escapes this function. This is parse-only by
 * construction: no kind module, and nothing here, ever writes to the filesystem or executes any
 * imported script/regex/Lua content; the entities this returns are the caller's to commit.
 */
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import { createBinaries, indexImages } from "./binaries";
import { indexCharacterGallery, importCharacters } from "./characters";
import { detectLumiverseArchive, isSupportedLvbakSchema, LVBAK_SCHEMA_VERSION } from "./detect";
import { createIdMint, createLinkMap } from "./links";
import { importLorebooks } from "./lorebooks";
import { readManifest, readStats } from "./manifest";
import { ndjsonLineCeiling } from "./ndjson";
import { importPersonas } from "./personas";
import { importPresets } from "./presets";
import { importRegexSets } from "./regex-sets";
import {
  addWarning,
  applyManifestWarnings,
  createLvbakReport,
  recordFailure,
  setSkippedTables,
  type LvbakImportReport,
} from "./report";
import type { LvbakEntrySource } from "./source";
import { planTableWalk, type ReadTableOptions } from "./table-walk";
import type { LvbakKind } from "./tables";

/**
 * The dispatch order every run actually walks: parents before the rows that link to them (lorebooks
 * before the personas that attach them, characters before the regex sets scoped to them), mirroring
 * MAPPED_TABLES's own table order in tables.ts (that file's doc comment points back here). A test
 * (import.test.ts) derives the kind order MAPPED_TABLES/TABLE_KINDS implies and pins it against this
 * constant, so the two can never silently drift apart.
 */
export const IMPORT_STAGE_ORDER: readonly LvbakKind[] = ["lorebook", "persona", "character", "preset", "regex"];

/**
 * A `.lvbak` this build cannot read, because its `schemaVersion` is past `LVBAK_SCHEMA_VERSION`.
 * Detection reports rather than denies (a future-schema archive really is Lumiverse's, just not one
 * this importer knows how to walk), so the versioned rejection belongs here, not in detect.ts.
 */
export class LvbakSchemaError extends Error {
  readonly schemaVersion: number;

  constructor(schemaVersion: number) {
    super(
      `lumiverse-archive: schemaVersion ${schemaVersion} is newer than the ${LVBAK_SCHEMA_VERSION} this build supports`,
    );
    this.name = "LvbakSchemaError";
    this.schemaVersion = schemaVersion;
  }
}

export interface LvbakImportResult {
  entities: ParsedCanonicalEntity[];
  report: LvbakImportReport;
}

/** Human words for a rejected entry's reason, for the warning it becomes. */
const rejectionWord = (reason: "unsafe" | "cruft"): string =>
  reason === "unsafe" ? "an unsafe path" : "macOS archive clutter";

export async function importLumiverseArchive(source: LvbakEntrySource): Promise<LvbakImportResult> {
  const detection = await detectLumiverseArchive(source);
  if (!detection.isLumiverseArchive) {
    throw new Error(
      "lumiverse-archive: not a recognizable .lvbak archive (no manifest.json naming producer \"lumiverse\" with a database/ tree beside it)",
    );
  }
  if (!isSupportedLvbakSchema(detection)) {
    throw new LvbakSchemaError(detection.schemaVersion ?? -1);
  }

  const manifest = await readManifest(source);
  if (!manifest) {
    // Detection just proved this archive's manifest reads fine; a source cannot legitimately change
    // answers between the two calls, so this is defensive, not a real path.
    throw new Error("lumiverse-archive: manifest.json could not be read for import");
  }
  const stats = await readStats(source);

  const report = createLvbakReport();
  applyManifestWarnings(report, manifest);

  const entryNames = await source.list();
  const plan = planTableWalk(entryNames, stats);
  setSkippedTables(report, plan.skipped);

  for (const rejected of await source.rejected()) {
    addWarning(report, `"${rejected.name}" was not read (${rejectionWord(rejected.reason)}).`);
  }
  if (stats && stats.missingFiles.length > 0) {
    addWarning(
      report,
      `The archive's own records name ${stats.missingFiles.length} file(s) missing at export time.`,
    );
  }

  const lineCeiling = ndjsonLineCeiling(manifest.ndjsonFormatVersion);
  const links = createLinkMap();
  // One mint for the whole run, shared across every kind stage: a character and a lorebook (or two
  // characters, or an embedded character_book and a standalone lorebook) that mint the SAME id from
  // canonical Id(name) have to collide against each other, never just against their own kind's rows.
  const idMint = createIdMint();
  const binaries = createBinaries(source, entryNames, report);
  // images and character_gallery are read once, here, as shared resources every kind stage below
  // draws from; no kind module reads either table itself, so this is the only onFailure wiring
  // either one gets, matching how every other table read reports its own line-level failures.
  const tableOpts: ReadTableOptions = { lineCeiling, onFailure: (failure) => recordFailure(report, failure) };
  const images = await indexImages(source, tableOpts);
  const gallery = await indexCharacterGallery(source, tableOpts);

  // One runner per kind, keyed so IMPORT_STAGE_ORDER is what actually drives dispatch below, not
  // just a comment describing it.
  const stages: Record<LvbakKind, () => Promise<ParsedCanonicalEntity[]>> = {
    lorebook: () => importLorebooks(source, { lineCeiling, report, links, idMint }),
    persona: () => importPersonas(source, { lineCeiling, report, links, binaries, idMint }),
    character: () => importCharacters(source, { lineCeiling, report, links, binaries, images, gallery, idMint }),
    preset: () => importPresets(source, { lineCeiling, report, links, idMint }),
    regex: () => importRegexSets(source, { lineCeiling, report, links, idMint }),
  };

  const entities: ParsedCanonicalEntity[] = [];
  for (const kind of IMPORT_STAGE_ORDER) {
    entities.push(...(await stages[kind]()));
  }

  return { entities, report };
}
