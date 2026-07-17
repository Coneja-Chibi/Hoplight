/**
 * faceOnlyFromPack: promote one face, clear pack.
 */
import { describe, expect, test } from "bun:test";
import { faceOnlyFromPack } from "./face-only";
import { normalizePack } from "./pack";

describe("faceOnlyFromPack", () => {
  test("promotes default face and clears emotions", () => {
    const pack = normalizePack({
      defaultLabel: "happy",
      items: [
        { id: "1", label: "angry", ref: "data:image/png;base64,aa" },
        { id: "2", label: "happy", ref: "data:image/png;base64,bb" },
      ],
    });
    const { media, pack: next, faceLabel } = faceOnlyFromPack(
      {
        portrait: { role: "portrait", ref: "old", primary: true },
        assets: [
          { role: "emotion", label: "happy", ref: "h" },
          { role: "background", label: "bg", ref: "bg-ref" },
        ],
      },
      pack,
    );
    expect(faceLabel).toBe("happy");
    expect(media.portrait?.ref).toContain("bb");
    expect(next.items).toEqual([]);
    expect(media.assets?.some((a) => a.role === "emotion")).toBe(false);
    expect(media.assets?.some((a) => a.role === "background")).toBe(true);
  });

  test("empty pack leaves media mostly intact", () => {
    const { faceLabel, pack } = faceOnlyFromPack({ portrait: { role: "portrait", ref: "p", primary: true } }, {
      items: [],
    });
    expect(faceLabel).toBe(null);
    expect(pack.items).toEqual([]);
  });
});
