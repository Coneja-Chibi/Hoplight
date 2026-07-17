import { describe, expect, test } from "bun:test";
import {
  applyPackToMedia,
  emotionAssetsFromPack,
  labelFromFilename,
  normalizeLabel,
  normalizePack,
  packFromMedia,
  resolvePackFace,
} from "./pack";

describe("pack", () => {
  test("normalizeLabel strips ext and expr_ prefix", () => {
    expect(normalizeLabel("Happy.PNG")).toBe("happy");
    expect(normalizeLabel("expr_angry")).toBe("angry");
    expect(normalizeLabel("full_idle")).toBe("idle");
  });

  test("labelFromFilename keeps stem", () => {
    expect(labelFromFilename("path/to/Neutral.png")).toBe("Neutral");
    expect(labelFromFilename("expr_joy.webp")).toBe("joy");
  });

  test("normalizePack drops empty and dedupes labels", () => {
    const p = normalizePack({
      items: [
        { id: "1", label: "happy", ref: "data:a" },
        { id: "2", label: "Happy", ref: "data:b" },
        { id: "3", label: "", ref: "data:c" },
        { id: "4", label: "sad", ref: "" },
      ],
    });
    expect(p.items).toHaveLength(1);
    expect(p.items[0]!.ref).toBe("data:b");
  });

  test("packFromMedia / emotionAssetsFromPack round-trip emotions", () => {
    const pack = packFromMedia({
      portrait: { role: "portrait", ref: "face", primary: true },
      assets: [
        { role: "emotion", label: "happy", ref: "h" },
        { role: "background", label: "bg", ref: "b" },
      ],
    });
    expect(pack.items.map((i) => i.label)).toEqual(["happy"]);
    const emotions = emotionAssetsFromPack(pack);
    expect(emotions).toEqual([{ role: "emotion", label: "happy", ref: "h" }]);
    const next = applyPackToMedia(
      {
        portrait: { role: "portrait", ref: "face", primary: true },
        assets: [
          { role: "emotion", label: "old", ref: "o" },
          { role: "background", label: "bg", ref: "b" },
        ],
      },
      { items: [{ id: "1", label: "sad", ref: "s" }] },
    );
    expect(next.portrait?.ref).toBe("face");
    expect(next.assets?.filter((a) => a.role === "emotion")).toEqual([
      { role: "emotion", label: "sad", ref: "s" },
    ]);
    expect(next.assets?.some((a) => a.role === "background")).toBe(true);
  });

  test("reorderPackItems by id", () => {
    const { reorderPackItems } = require("./pack") as typeof import("./pack");
    const pack = normalizePack({
      items: [
        { id: "a", label: "a", ref: "1" },
        { id: "b", label: "b", ref: "2" },
        { id: "c", label: "c", ref: "3" },
      ],
    });
    const next = reorderPackItems(pack, ["c", "a", "b"]);
    expect(next.items.map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  test("resolvePackFace fallback chain", () => {
    const pack = normalizePack({
      defaultLabel: "happy",
      items: [
        { id: "1", label: "angry", ref: "a" },
        { id: "2", label: "happy", ref: "h" },
        { id: "3", label: "neutral", ref: "n" },
      ],
    });
    expect(resolvePackFace(pack, "angry")?.ref).toBe("a");
    expect(resolvePackFace(pack, null)?.ref).toBe("h");
    const noDef = normalizePack({
      items: [
        { id: "1", label: "angry", ref: "a" },
        { id: "2", label: "neutral", ref: "n" },
      ],
    });
    expect(resolvePackFace(noDef, "missing")?.ref).toBe("n");
  });
});
