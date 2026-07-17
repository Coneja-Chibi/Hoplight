import { describe, expect, test } from "bun:test";
import { bodyWithFaceOnly, bodyWithPack, originalWithPack, packFromBodyDraft } from "./session";

describe("media session", () => {
  test("packFromBodyDraft / bodyWithPack", () => {
    const body = {
      media: {
        portrait: { role: "portrait", ref: "face", primary: true },
        assets: [{ role: "emotion", label: "happy", ref: "h" }],
      },
    };
    const pack = packFromBodyDraft(body);
    expect(pack.items.map((i) => i.label)).toEqual(["happy"]);
    const next = bodyWithPack(body, {
      items: [{ id: "1", label: "sad", ref: "s" }],
    });
    const media = next.media as { assets: { label: string }[] };
    expect(media.assets.some((a) => a.label === "sad")).toBe(true);
    expect(media.assets.some((a) => a.label === "happy")).toBe(false);
  });

  test("originalWithPack merges sillytavern assets and lumi maps", () => {
    const original = {
      sillytavern: {
        raw: {
          data: {
            assets: [
              { type: "icon", name: "main", uri: "face", ext: "png" },
              { type: "emotion", name: "old", uri: "o", ext: "png" },
            ],
            extensions: {},
          },
        },
      },
    };
    const next = originalWithPack(original, {
      items: [{ id: "1", label: "joy", ref: "data:image/png;base64,AA" }],
    });
    const data = (next as {
      sillytavern: {
        raw: {
          data: {
            assets: { name: string; type: string }[];
            extensions: { expressions?: { mappings?: Record<string, string> } };
          };
        };
      };
    }).sillytavern.raw.data;
    expect(data.assets.find((a) => a.name === "main")).toBeDefined();
    expect(data.assets.filter((a) => a.type === "emotion").map((a) => a.name)).toEqual(["joy"]);
    expect(data.extensions.expressions?.mappings?.joy).toBe("data:image/png;base64,AA");
  });

  test("bodyWithFaceOnly promotes face and clears pack emotions", () => {
    const body = {
      media: {
        portrait: { role: "portrait", ref: "old", primary: true },
        assets: [
          { role: "emotion", label: "happy", ref: "data:image/png;base64,hh" },
          { role: "background", label: "bg", ref: "bg" },
        ],
      },
    };
    const pack = packFromBodyDraft(body);
    const { body: next, pack: empty, faceLabel } = bodyWithFaceOnly(body, pack, "happy");
    expect(faceLabel).toBe("happy");
    expect(empty.items).toEqual([]);
    const media = next.media as {
      portrait?: { ref: string };
      assets?: { role: string }[];
      faceLabel?: string;
    };
    expect(media.portrait?.ref).toContain("hh");
    expect(media.faceLabel).toBe("happy");
    expect(media.assets?.some((a) => a.role === "emotion")).toBe(false);
    expect(media.assets?.some((a) => a.role === "background")).toBe(true);
  });
});
