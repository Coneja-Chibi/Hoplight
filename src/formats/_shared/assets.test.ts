/**
 * CCv3 assets <-> media inverse: role/dialect mapping, residue, private-ref honesty.
 */
import { describe, expect, test } from "bun:test";
import {
  assetsToMedia,
  extFromMimeOrRef,
  isPrivateArchiveRef,
  mergeMediaIntoCcv3Assets,
  type Ccv3AssetRow,
} from "./assets";
import type { Media } from "../../entities/character/schema";

describe("extFromMimeOrRef", () => {
  test("from mime", () => {
    expect(extFromMimeOrRef("image/png")).toBe("png");
    expect(extFromMimeOrRef("image/jpeg")).toBe("jpg");
    expect(extFromMimeOrRef("image/webp")).toBe("webp");
  });

  test("from data URI", () => {
    expect(extFromMimeOrRef(undefined, "data:image/png;base64,AA")).toBe("png");
    expect(extFromMimeOrRef(undefined, "data:image/webp;base64,AA")).toBe("webp");
  });

  test("from path/url extension", () => {
    expect(extFromMimeOrRef(undefined, "https://cdn/x.webp")).toBe("webp");
    expect(extFromMimeOrRef(undefined, "assets/main.jpeg")).toBe("jpg");
  });

  test("unknown payload does not invent png", () => {
    expect(extFromMimeOrRef(undefined, "data:application/octet-stream;base64,AA")).toBeUndefined();
    expect(extFromMimeOrRef("application/octet-stream", "blob:xyz")).toBeUndefined();
    expect(extFromMimeOrRef(undefined, "noext")).toBeUndefined();
  });
});

describe("isPrivateArchiveRef", () => {
  test("portable refs", () => {
    expect(isPrivateArchiveRef("data:image/png;base64,AA")).toBe(false);
    expect(isPrivateArchiveRef("https://cdn/x.png")).toBe(false);
    expect(isPrivateArchiveRef("http://cdn/x.png")).toBe(false);
    expect(isPrivateArchiveRef("ccdefault:")).toBe(false);
  });

  test("private refs", () => {
    expect(isPrivateArchiveRef("embeded://assets/main.png")).toBe(true);
    expect(isPrivateArchiveRef("embedded://assets/main.png")).toBe(true);
    expect(isPrivateArchiveRef("assets/main.png")).toBe(true);
    expect(isPrivateArchiveRef("blob:http://x/1")).toBe(true);
  });
});

describe("mergeMediaIntoCcv3Assets", () => {
  const existing: Ccv3AssetRow[] = [
    { type: "icon", name: "main", uri: "https://cdn/main.png", ext: "png", extra: 1 },
    { type: "emotion", name: "happy", uri: "https://cdn/happy.png", ext: "png", residue: true },
    { type: "background", name: "bg", uri: "https://cdn/bg.png", ext: "png" },
    { type: "x-risu-asset", name: "pack", uri: "https://cdn/pack.bin", ext: "bin", keep: "me" },
  ];

  test("untouched media returns original array reference", () => {
    const media = assetsToMedia(existing);
    const result = mergeMediaIntoCcv3Assets(existing, media, "sillytavern");
    expect(result.unchanged).toBe(true);
    expect(result.assets).toBe(existing);
    expect(result.skipped).toEqual([]);
  });

  test("portrait + emotion + background + outfit + pose map correctly", () => {
    const media: Media = {
      portrait: {
        role: "portrait",
        label: "main",
        ref: "data:image/png;base64,AA",
        mime: "image/png",
        primary: true,
      },
      assets: [
        { role: "emotion", label: "sad", ref: "https://cdn/sad.webp", mime: "image/webp" },
        { role: "outfit", label: "armor", ref: "https://cdn/armor.png", mime: "image/png" },
        { role: "pose", label: "sit", ref: "https://cdn/sit.png", mime: "image/png" },
        { role: "background", label: "cave", ref: "https://cdn/cave.jpg", mime: "image/jpeg" },
      ],
    };
    const result = mergeMediaIntoCcv3Assets([], media, "sillytavern");
    expect(result.unchanged).toBe(false);
    const rows = result.assets as Ccv3AssetRow[];
    expect(rows).toContainEqual({
      type: "icon",
      name: "main",
      uri: "data:image/png;base64,AA",
      ext: "png",
    });
    expect(rows.find((r) => r.name === "sad")).toEqual({
      type: "emotion",
      name: "sad",
      uri: "https://cdn/sad.webp",
      ext: "webp",
    });
    expect(rows.find((r) => r.name === "armor")?.type).toBe("outfit");
    expect(rows.find((r) => r.name === "sit")?.type).toBe("pose");
    expect(rows.find((r) => r.name === "cave")).toEqual({
      type: "background",
      name: "cave",
      uri: "https://cdn/cave.jpg",
      ext: "jpg",
    });
  });

  test("RoleCall dialect emits expression; others emit emotion", () => {
    const media: Media = {
      assets: [{ role: "emotion", label: "joy", ref: "https://cdn/j.png", mime: "image/png" }],
    };
    expect(
      (mergeMediaIntoCcv3Assets([], media, "rolecall").assets as Ccv3AssetRow[])[0]?.type,
    ).toBe("expression");
    for (const d of ["sillytavern", "risu", "lumiverse"] as const) {
      expect(
        (mergeMediaIntoCcv3Assets([], media, d).assets as Ccv3AssetRow[])[0]?.type,
      ).toBe("emotion");
    }
  });

  test("overlay preserves unknown keys on matched rows", () => {
    const media: Media = {
      portrait: {
        role: "portrait",
        label: "main",
        ref: "https://cdn/main2.png",
        mime: "image/png",
        primary: true,
      },
      assets: [
        { role: "emotion", label: "happy", ref: "https://cdn/happy2.png", mime: "image/png" },
      ],
    };
    const result = mergeMediaIntoCcv3Assets(existing, media, "sillytavern");
    const rows = result.assets as Ccv3AssetRow[];
    const main = rows.find((r) => r.name === "main")!;
    expect(main.extra).toBe(1);
    expect(main.uri).toBe("https://cdn/main2.png");
    const happy = rows.find((r) => r.name === "happy")!;
    expect(happy.residue).toBe(true);
    expect(happy.uri).toBe("https://cdn/happy2.png");
  });

  test("removed mapped assets do not delete unrelated custom rows", () => {
    const media: Media = {
      portrait: {
        role: "portrait",
        label: "main",
        ref: "https://cdn/main.png",
        mime: "image/png",
        primary: true,
      },
      // drop happy + bg; keep custom x-risu-asset via assets other? it was role other
      assets: [
        {
          role: "other",
          label: "pack",
          ref: "https://cdn/pack.bin",
          mime: undefined,
        },
      ],
    };
    // Wait - assetsToMedia maps x-risu-asset to other with label pack. If we include it, it stays.
    // Test removal of emotion/background while custom remains because media still lists other.
    const result = mergeMediaIntoCcv3Assets(existing, media, "risu");
    const rows = result.assets as Ccv3AssetRow[];
    expect(rows.find((r) => r.name === "happy")).toBeUndefined();
    expect(rows.find((r) => r.name === "bg")).toBeUndefined();
    const pack = rows.find((r) => r.name === "pack")!;
    expect(pack.type).toBe("x-risu-asset");
    expect(pack.keep).toBe("me");
  });

  test("custom other without existing type uses portable other", () => {
    const media: Media = {
      assets: [{ role: "other", label: "misc", ref: "https://cdn/m.png", mime: "image/png" }],
    };
    const rows = mergeMediaIntoCcv3Assets([], media, "sillytavern").assets as Ccv3AssetRow[];
    expect(rows[0]).toEqual({
      type: "other",
      name: "misc",
      uri: "https://cdn/m.png",
      ext: "png",
    });
  });

  test("empty ref is rejected", () => {
    const media: Media = {
      portrait: { role: "portrait", label: "main", ref: "  ", primary: true },
    };
    const result = mergeMediaIntoCcv3Assets([], media, "sillytavern");
    expect(result.assets).toEqual([]);
    expect(result.skipped).toEqual([
      { reason: "empty-ref", asset: media.portrait! },
    ]);
  });

  test("unresolved private ref is skipped, data URI and URL round-trip", () => {
    const media: Media = {
      portrait: {
        role: "portrait",
        label: "main",
        ref: "data:image/png;base64,QQ",
        mime: "image/png",
        primary: true,
      },
      assets: [
        { role: "emotion", label: "happy", ref: "https://cdn/h.png", mime: "image/png" },
        { role: "emotion", label: "secret", ref: "embeded://assets/secret.png", mime: "image/png" },
      ],
    };
    const result = mergeMediaIntoCcv3Assets([], media, "sillytavern");
    const rows = result.assets as Ccv3AssetRow[];
    expect(rows.map((r) => r.name).sort()).toEqual(["happy", "main"]);
    expect(result.skipped).toEqual([
      {
        reason: "private-ref",
        asset: media.assets![1]!,
      },
    ]);
  });

  test("private ref preserved when existing row already has the same uri", () => {
    const existingPrivate: Ccv3AssetRow[] = [
      { type: "icon", name: "main", uri: "embeded://assets/main.png", ext: "png" },
    ];
    const media: Media = {
      portrait: {
        role: "portrait",
        label: "main",
        ref: "embeded://assets/main.png",
        mime: "image/png",
        primary: true,
      },
      assets: [{ role: "emotion", label: "x", ref: "data:image/png;base64,AA", mime: "image/png" }],
    };
    const result = mergeMediaIntoCcv3Assets(existingPrivate, media, "risu");
    const rows = result.assets as Ccv3AssetRow[];
    expect(rows.find((r) => r.name === "main")?.uri).toBe("embeded://assets/main.png");
    expect(rows.find((r) => r.name === "x")?.uri).toBe("data:image/png;base64,AA");
    expect(result.skipped).toEqual([]);
  });

  test("same-format fixture with unknown keys deep-equals when untouched", () => {
    const media = assetsToMedia(existing);
    const result = mergeMediaIntoCcv3Assets(existing, media, "rolecall");
    expect(result.unchanged).toBe(true);
    expect(result.assets).toEqual(existing);
  });
});
