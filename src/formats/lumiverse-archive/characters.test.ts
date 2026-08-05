/**
 * The character slice: a row with lumiverse_modules dispatches through the codec's zip path and its
 * sprites come back as real data: URIs, the portrait resolves through the same avatar_path/image_id/
 * avatar_crop_image_id waterfall the persona slice uses, a broken extensions column loses only itself
 * (edge case 7), an embedded character_book extracts into its own linked lorebook exactly as a
 * single-file import would, and character_gallery rows join onto body.media.assets in sort_order.
 */
import { describe, expect, test } from "bun:test";
import {
  GALLERY_MISSING_IMAGE_FILENAME,
  GALLERY_RESOLVABLE_IMAGE_FILENAME,
  INDIRECT_MISSING_IMAGE_FILENAME,
  PNG_1X1,
  assembleLvbak,
  buildBadRowsLvbak,
  buildCharacterGalleryLvbak,
  buildIndirectBinaryLvbak,
  buildMinimalLvbak,
  buildMissingBinariesLvbak,
  lvbakManifest,
  lvbakStats,
} from "../_fixtures/lumiverse-archive/build-lvbak";
import {
  CHARACTER_AVATAR,
  IMAGE_FILENAME,
  characterRow,
  galleryRow,
  imageRow,
} from "../_fixtures/lumiverse-archive/rows";
import { createBinaries, indexImages } from "./binaries";
import { importCharacters, type ImportCharactersOptions } from "./characters";
import { createLinkMap, type LinkMap } from "./links";
import { ndjsonLineCeiling } from "./ndjson";
import { createLvbakReport, type LvbakImportReport } from "./report";
import { zipEntrySource } from "./zip-source";

const V1_CEILING = ndjsonLineCeiling(1);
const noFailures = () => expect.unreachable();

interface Rig {
  options: ImportCharactersOptions;
  report: LvbakImportReport;
  links: LinkMap;
}

/** One archive's worth of import machinery: a fresh report/links plus the binaries and images maps
 * importCharacters needs, all built off the same source the way a real orchestrator would. */
async function rig(bytes: Uint8Array): Promise<Rig> {
  const source = zipEntrySource(bytes);
  const report = createLvbakReport();
  const links = createLinkMap();
  const binaries = createBinaries(source, await source.list(), report);
  const images = await indexImages(source, { lineCeiling: V1_CEILING, onFailure: noFailures });
  return { report, links, options: { lineCeiling: V1_CEILING, report, links, binaries, images } };
}

describe("zip-wire sprites", () => {
  test("a lumiverse_modules character dispatches through the zip path and sprites resolve to data URIs", async () => {
    const { options, report } = await rig(buildMinimalLvbak());
    const source = zipEntrySource(buildMinimalLvbak());
    const entities = await importCharacters(source, options);

    const character = entities.find((e) => e.kind === "character");
    if (!character || character.kind !== "character") throw new Error("no character in the result");

    // fromZip proves the zip path actually ran, not just that the result looks plausible
    const lumi = character.original!.lumiverse!.raw as { fromZip: boolean };
    expect(lumi.fromZip).toBe(true);

    const emotionAssets = character.body.media.assets?.filter((a) => a.role === "emotion") ?? [];
    expect(emotionAssets).toHaveLength(2);
    for (const asset of emotionAssets) expect(asset.ref.startsWith("data:image/png;base64,")).toBe(true);
    expect(report.missingBinaries).toEqual([]);

    // the fixture's foreign "chub" key survives both escrow surfaces: the codec's own twin (it was
    // never lifted out, only lumiverse_modules was) and the archive's raw-row twin (verbatim always)
    const twin = character.original!.sillytavern!.raw as { data: { extensions: Record<string, unknown> } };
    expect(twin.data.extensions.chub).toEqual({ preset: "fixture-escrow-only" });
    const archived = character.original!["lumiverse-archive"]!.raw as { extensions: string };
    expect(archived.extensions).toContain('"chub"');
  });

  test("a character with no lumiverse_modules dispatches the plain JSON path, no zip ceremony", async () => {
    const tables = {
      characters: [characterRow({ extensions: JSON.stringify({ chub: { preset: "no-modules-test" } }) })],
    };
    const bytes = assembleLvbak({ manifest: lvbakManifest(), tables, stats: lvbakStats(tables) });
    const { options } = await rig(bytes);
    const source = zipEntrySource(bytes);

    const entities = await importCharacters(source, options);
    const character = entities.find((e) => e.kind === "character");
    if (!character || character.kind !== "character") throw new Error("no character in the result");
    const lumi = character.original!.lumiverse!.raw as { fromZip: boolean };
    expect(lumi.fromZip).toBe(false);
  });
});

describe("portrait resolution", () => {
  test("avatar_path and image_id both absent from the archive: no portrait, both misses recorded, still imports", async () => {
    const { options, report } = await rig(buildMissingBinariesLvbak());
    const source = zipEntrySource(buildMissingBinariesLvbak());

    const entities = await importCharacters(source, options);
    const character = entities.find((e) => e.kind === "character");
    if (!character || character.kind !== "character") throw new Error("no character in the result");
    expect(character.body.media.portrait).toBeUndefined();
    expect(report.missingBinaries).toContain(`files/avatars/${CHARACTER_AVATAR}`);
    expect(report.missingBinaries).toContain(`files/images/${IMAGE_FILENAME}`);
  });

  test("image_id joins to a present file when avatar_path is absent", async () => {
    const { options } = await rig(buildIndirectBinaryLvbak());
    const source = zipEntrySource(buildIndirectBinaryLvbak());

    const entities = await importCharacters(source, options);
    const alpha = entities.find((e) => e.kind === "character" && e.body.identity.name === "Test Character Alpha");
    if (!alpha || alpha.kind !== "character") throw new Error("Test Character Alpha missing from the result");
    expect(alpha.body.media.portrait?.ref.startsWith("data:image/png;base64,")).toBe(true);
    expect(alpha.body.media.portrait?.primary).toBe(true);
  });

  test("avatar_crop_image_id joins to an absent file: no portrait, the miss is recorded, still imports", async () => {
    const { options, report } = await rig(buildIndirectBinaryLvbak());
    const source = zipEntrySource(buildIndirectBinaryLvbak());

    const entities = await importCharacters(source, options);
    const beta = entities.find((e) => e.kind === "character" && e.body.identity.name === "Test Character Beta");
    if (!beta || beta.kind !== "character") throw new Error("Test Character Beta missing from the result");
    expect(beta.body.media.portrait).toBeUndefined();
    expect(report.missingBinaries).toContain(`files/images/${INDIRECT_MISSING_IMAGE_FILENAME}`);
  });
});

describe("edge case 7: extensions fails to parse", () => {
  test("the row imports from flat columns, warns by name, and the raw string survives in escrow", async () => {
    const { options, report } = await rig(buildBadRowsLvbak());
    const source = zipEntrySource(buildBadRowsLvbak());

    const entities = await importCharacters(source, options);
    const broken = entities.find((e) => e.kind === "character" && e.body.identity.name === "Test Character Broken");
    if (!broken || broken.kind !== "character") throw new Error("Test Character Broken missing from the result");

    // no modules could be lifted from a string that never parsed, so this is the plain path
    const lumi = broken.original!.lumiverse!.raw as { fromZip: boolean };
    expect(lumi.fromZip).toBe(false);
    expect(broken.body.media.assets ?? []).toEqual([]);

    // tags and alternate_greetings are separate columns and parsed fine; they still ride the card
    expect(broken.body.discovery.tags).toEqual(["fixture", "synthetic"]);
    expect(broken.body.greetings.alternateGreetings?.[0]?.text).toBe("A second synthetic greeting.");

    // the raw, unparseable string survives verbatim regardless of what dispatch did with it
    const archived = broken.original!["lumiverse-archive"]!.raw as { extensions: string };
    expect(archived.extensions).toBe('{"lumiverse_modules": {"expressions":');

    expect(report.warnings.some((w) => w.includes("Test Character Broken"))).toBe(true);
    expect(report.failed.some((f) => f.table === "characters")).toBe(false);
  });

  test("its sibling row, whose extensions parsed fine, is unaffected", async () => {
    const { options, report } = await rig(buildBadRowsLvbak());
    const source = zipEntrySource(buildBadRowsLvbak());

    const entities = await importCharacters(source, options);
    const alpha = entities.find((e) => e.kind === "character" && e.body.identity.name === "Test Character Alpha");
    if (!alpha || alpha.kind !== "character") throw new Error("Test Character Alpha missing from the result");
    expect((alpha.original!.lumiverse!.raw as { fromZip: boolean }).fromZip).toBe(true);
    expect(report.warnings.some((w) => w.includes("Test Character Alpha\""))).toBe(false);
  });
});

describe("embedded character_book", () => {
  test("extracts into a standalone linked lorebook, escrowed only through the character's own row", async () => {
    const { options, report } = await rig(buildMinimalLvbak());
    const source = zipEntrySource(buildMinimalLvbak());

    const entities = await importCharacters(source, options);
    const character = entities.find((e) => e.kind === "character");
    const book = entities.find((e) => e.kind === "lorebook");
    if (!character || character.kind !== "character") throw new Error("no character in the result");
    if (!book || book.kind !== "lorebook") throw new Error("no lorebook in the result");

    expect(character.body.knowledgeRefs).toEqual([book.id]);
    expect(book.body.name).toBe("Test Character Alpha Embedded Book");
    expect(report.imported.lorebook).toEqual([{ id: book.id, name: book.body.name }]);

    // derived from the card, not its own row: no archive escrow bucket of its own
    expect(book.original!["lumiverse-archive"]).toBeUndefined();
    // the underlying data is still escrowed, through the character's own row
    expect(character.original!["lumiverse-archive"]).toBeDefined();
  });
});

describe("character_gallery", () => {
  test("gallery images join onto media.assets in sort_order, not table order; a missing file appends nothing", async () => {
    const { options, report } = await rig(buildCharacterGalleryLvbak());
    const source = zipEntrySource(buildCharacterGalleryLvbak());

    const entities = await importCharacters(source, options);
    const character = entities.find((e) => e.kind === "character");
    if (!character || character.kind !== "character") throw new Error("no character in the result");

    const otherAssets = character.body.media.assets?.filter((a) => a.role === "other") ?? [];
    // the missing-file row contributes nothing; only the resolvable one lands
    expect(otherAssets).toHaveLength(1);
    expect(otherAssets[0]!.ref.startsWith("data:image/png;base64,")).toBe(true);
    expect(otherAssets[0]!.label).toBe(GALLERY_RESOLVABLE_IMAGE_FILENAME);

    expect(report.missingBinaries).toContain(`files/images/${GALLERY_MISSING_IMAGE_FILENAME}`);
    // the character itself still imported cleanly despite the gallery miss
    expect(report.imported.character).toHaveLength(1);
  });

  test("ordering: two resolvable rows land sorted by sort_order, not the order the table wrote them in", async () => {
    const tables = {
      characters: [characterRow({ extensions: JSON.stringify({}) })],
      images: [
        imageRow({ id: "lv-gallery-image-a", filename: "gallery-a.png" }),
        imageRow({ id: "lv-gallery-image-b", filename: "gallery-b.png" }),
      ],
      character_gallery: [
        // written second-then-first: image b (sort_order 0) is written AFTER image a (sort_order 1)
        galleryRow({ id: "lv-gallery-000000000011", image_id: "lv-gallery-image-a", sort_order: 1 }),
        galleryRow({ id: "lv-gallery-000000000010", image_id: "lv-gallery-image-b", sort_order: 0 }),
      ],
    };
    const bytes = assembleLvbak({
      manifest: lvbakManifest(),
      tables,
      files: {
        [`files/avatars/${CHARACTER_AVATAR}`]: PNG_1X1,
        "files/images/gallery-a.png": PNG_1X1,
        "files/images/gallery-b.png": PNG_1X1,
      },
      stats: lvbakStats(tables),
    });
    const { options } = await rig(bytes);
    const source = zipEntrySource(bytes);

    const entities = await importCharacters(source, options);
    const character = entities.find((e) => e.kind === "character");
    if (!character || character.kind !== "character") throw new Error("no character in the result");

    const otherAssets = character.body.media.assets?.filter((a) => a.role === "other") ?? [];
    expect(otherAssets.map((a) => a.label)).toEqual(["gallery-b.png", "gallery-a.png"]);
  });
});
