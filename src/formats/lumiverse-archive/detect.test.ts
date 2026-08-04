/**
 * Detection must claim every real .lvbak and nothing else. The refusals matter as much as the
 * accepts: a wrong claim here sends a charx or a plain ZIP down an importer that will find no
 * tables, and a wrong refusal sends a real backup to the charx path.
 */
import { describe, expect, test } from "bun:test";
import { strToU8, zipSync } from "fflate";
import {
  assembleLvbak,
  buildFutureSchemaLvbak,
  buildLegacyNoFormatVersionLvbak,
  buildMinimalLvbak,
  buildSecretsAndVectorsLvbak,
  buildWrongProducerZip,
  lvbakManifest,
} from "../_fixtures/lumiverse-archive/build-lvbak";
import { characterRow } from "../_fixtures/lumiverse-archive/rows";
import {
  ZIP_DEFLATE,
  writeZip64,
} from "../_fixtures/lumiverse-archive/zip64-writer";
import { detectLumiverseArchive, isSupportedLvbakSchema } from "./detect";
import { zipEntrySource } from "./zip-source";

const detect = (bytes: Uint8Array) => detectLumiverseArchive(zipEntrySource(bytes));

describe("detectLumiverseArchive accepts", () => {
  test("the minimal archive, with the manifest fields the importer needs", async () => {
    const result = await detect(buildMinimalLvbak());
    expect(result.isLumiverseArchive).toBe(true);
    expect(result.schemaVersion).toBe(1);
    expect(result.ndjsonFormatVersion).toBe(1);
    expect(result.hasEncryptedSecrets).toBe(false);
    expect(isSupportedLvbakSchema(result)).toBe(true);
  });

  test("counts come from manifest-stats, never from the manifest placeholder", async () => {
    const result = await detect(buildMinimalLvbak());
    expect(result.counts?.characters).toBe(1);
    // manifest.json's own counts are {}, so a non-empty result proves stats were the source
    expect(result.counts?.chats).toBe(3);
  });

  test("stats absent downgrades counts to unknown without failing detection", async () => {
    const bytes = assembleLvbak({
      manifest: lvbakManifest(),
      tables: { characters: [characterRow()] },
      stats: null,
    });
    const result = await detect(bytes);
    expect(result.isLumiverseArchive).toBe(true);
    expect(result.counts).toBeUndefined();
  });

  test("a legacy archive is a match and reports no ndjsonFormatVersion", async () => {
    const result = await detect(buildLegacyNoFormatVersionLvbak());
    expect(result.isLumiverseArchive).toBe(true);
    expect(result.ndjsonFormatVersion).toBeUndefined();
  });

  test("encrypted secrets are reported so the importer can warn", async () => {
    expect((await detect(buildSecretsAndVectorsLvbak())).hasEncryptedSecrets).toBe(true);
  });

  test("a future schema is reported, not denied", async () => {
    const result = await detect(buildFutureSchemaLvbak());
    expect(result.isLumiverseArchive).toBe(true);
    expect(result.schemaVersion).toBe(2);
    // the versioned error belongs to the importer, and this is how it knows to throw
    expect(isSupportedLvbakSchema(result)).toBe(false);
  });
});

describe("detectLumiverseArchive refuses", () => {
  test("a valid layout whose producer is someone else", async () => {
    const result = await detect(buildWrongProducerZip());
    expect(result.isLumiverseArchive).toBe(false);
    expect(result.schemaVersion).toBeUndefined();
  });

  test("a charx-shaped archive", async () => {
    const charx = zipSync({
      "card.json": strToU8(JSON.stringify({ spec: "chara_card_v3", data: { name: "A" } })),
    });
    expect((await detect(charx)).isLumiverseArchive).toBe(false);
  });

  test("a plain ZIP with no manifest at all", async () => {
    expect((await detect(zipSync({ "notes.txt": strToU8("hello") }))).isLumiverseArchive).toBe(false);
  });

  test("a manifest with no database entries behind it", async () => {
    const bytes = writeZip64([
      {
        name: "manifest.json",
        data: strToU8(JSON.stringify(lvbakManifest())),
        method: ZIP_DEFLATE,
        level: 3,
      },
    ]);
    expect((await detect(bytes)).isLumiverseArchive).toBe(false);
  });

  test("a manifest nested below the root", async () => {
    const bytes = assembleLvbak({
      manifest: lvbakManifest(),
      tables: { characters: [characterRow()] },
      stats: null,
    });
    const nested = zipSync({
      "export/manifest.json": strToU8(JSON.stringify(lvbakManifest())),
      "export/database/characters.ndjson": strToU8("{}\n"),
    });
    expect((await detect(nested)).isLumiverseArchive).toBe(false);
    // the same content at the root is a match, so nesting is the only difference that mattered
    expect((await detect(bytes)).isLumiverseArchive).toBe(true);
  });

  test("a manifest that is not JSON, and bytes that are not a ZIP", async () => {
    const broken = writeZip64([
      { name: "manifest.json", data: strToU8("{ this is not json"), method: ZIP_DEFLATE, level: 3 },
      { name: "database/characters.ndjson", data: strToU8("{}\n"), method: ZIP_DEFLATE, level: 3 },
    ]);
    expect((await detect(broken)).isLumiverseArchive).toBe(false);
    expect((await detect(new Uint8Array(64).fill(0x41))).isLumiverseArchive).toBe(false);
  });

  test("a manifest whose schemaVersion is not an integer", async () => {
    const bytes = assembleLvbak({
      manifest: lvbakManifest({ schemaVersion: "1" }),
      tables: { characters: [characterRow()] },
      stats: null,
    });
    expect((await detect(bytes)).isLumiverseArchive).toBe(false);
  });
});
