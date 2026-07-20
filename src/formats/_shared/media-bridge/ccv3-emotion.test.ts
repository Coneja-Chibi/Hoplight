/** Regression coverage for the ccv3-emotion.test behavior owned beside this file. */
import { describe, expect, test } from "bun:test";
import { mergePackIntoCcv3Assets, packFromCcv3Assets } from "./ccv3-emotion";

describe("ccv3-emotion bridge", () => {
  test("packFromCcv3Assets reads emotion and expression, skips main icon", () => {
    const pack = packFromCcv3Assets([
      { type: "icon", name: "main", uri: "face", ext: "png" },
      { type: "emotion", name: "happy", uri: "h", ext: "png" },
      { type: "expression", name: "smile", uri: "s", ext: "png" },
      { type: "background", name: "bg", uri: "b", ext: "png" },
    ]);
    expect(pack.items.map((i) => i.label).sort()).toEqual(["happy", "smile"]);
  });

  test("mergePackIntoCcv3Assets replaces emotions keeps others", () => {
    const next = mergePackIntoCcv3Assets(
      [
        { type: "icon", name: "main", uri: "face", ext: "png" },
        { type: "emotion", name: "old", uri: "o", ext: "png" },
        { type: "background", name: "bg", uri: "b", ext: "png" },
      ],
      { items: [{ id: "1", label: "sad", ref: "data:image/png;base64,AA" }] },
      "emotion",
    );
    expect(next.find((a) => a.name === "main")).toBeDefined();
    expect(next.find((a) => a.name === "bg")).toBeDefined();
    expect(next.filter((a) => a.type === "emotion")).toEqual([
      { type: "emotion", uri: "data:image/png;base64,AA", name: "sad", ext: "png" },
    ]);
  });

  test("RC wire type expression", () => {
    const next = mergePackIntoCcv3Assets([], {
      items: [{ id: "1", label: "joy", ref: "https://cdn/j.png" }],
    }, "expression");
    expect(next[0]?.type).toBe("expression");
  });
});
