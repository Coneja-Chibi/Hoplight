/**
 * files/ resolution (spec Behavior step 4): a present avatar or image comes back as a data: URI, an
 * absent one comes back as null plus one deduped report entry, and never a throw either way. The
 * third case, joining through the images table instead of a direct avatar_path, is the one a plain
 * path lookup never exercises, so it gets its own fixture.
 */
import { describe, expect, test } from "bun:test";
import {
  PNG_1X1,
  buildIndirectBinaryLvbak,
  buildMinimalLvbak,
  buildMissingBinariesLvbak,
} from "../_fixtures/lumiverse-archive/build-lvbak";
import { CHARACTER_AVATAR, IMAGE_ID } from "../_fixtures/lumiverse-archive/rows";
import { createBinaries, indexImages } from "./binaries";
import { ndjsonLineCeiling } from "./ndjson";
import { createLvbakReport } from "./report";
import { zipEntrySource } from "./zip-source";

const V1_CEILING = ndjsonLineCeiling(1);
const PNG_DATA_URI = `data:image/png;base64,${Buffer.from(PNG_1X1).toString("base64")}`;

describe("createBinaries: hit path", () => {
  test("a present avatar decodes back to the exact bytes it was built from", async () => {
    const source = zipEntrySource(buildMinimalLvbak());
    const report = createLvbakReport();
    const binaries = createBinaries(source, await source.list(), report);

    expect(binaries.has(`files/avatars/${CHARACTER_AVATAR}`)).toBe(true);
    expect(await binaries.bytes(`files/avatars/${CHARACTER_AVATAR}`)).toEqual(PNG_1X1);
    expect(await binaries.avatarDataUri(CHARACTER_AVATAR)).toBe(PNG_DATA_URI);
    expect(report.missingBinaries).toEqual([]);
  });
});

describe("createBinaries: miss path", () => {
  test("an absent avatar is null, not a throw, and lands once on the report", async () => {
    const source = zipEntrySource(buildMissingBinariesLvbak());
    const report = createLvbakReport();
    const binaries = createBinaries(source, await source.list(), report);

    expect(binaries.has(`files/avatars/${CHARACTER_AVATAR}`)).toBe(false);
    expect(await binaries.avatarDataUri(CHARACTER_AVATAR)).toBeNull();
    // asking a second time (as a persona and a character both would) must not duplicate the warning
    expect(await binaries.avatarDataUri(CHARACTER_AVATAR)).toBeNull();
    expect(report.missingBinaries).toEqual([`files/avatars/${CHARACTER_AVATAR}`]);
  });
});

describe("createBinaries + indexImages: join path", () => {
  test("imageDataUri resolves through an images-table row, hit and miss alike", async () => {
    const source = zipEntrySource(buildIndirectBinaryLvbak());
    const report = createLvbakReport();
    const binaries = createBinaries(source, await source.list(), report);
    const images = await indexImages(source, {
      lineCeiling: V1_CEILING,
      onFailure: () => expect.unreachable(),
    });

    const hit = images.get(IMAGE_ID);
    expect(hit).toBeDefined();
    expect(await binaries.imageDataUri(hit!.row)).toBe(PNG_DATA_URI);

    const miss = images.get("lv-image-000000000002");
    expect(miss).toBeDefined();
    expect(await binaries.imageDataUri(miss!.row)).toBeNull();
    expect(report.missingBinaries).toEqual(["files/images/test-image-beta.png"]);
  });
});
