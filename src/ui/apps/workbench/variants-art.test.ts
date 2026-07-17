/**
 * variant own-art resolution (override only).
 */
import { describe, expect, test } from "bun:test";
import { variantArtUrls, variantOwnPortraitRef } from "./variants-art";

describe("variant art", () => {
  test("no override -> null (inherits base; strip shows label only)", () => {
    expect(variantOwnPortraitRef({ id: "v1", label: "Alt", overrides: {} })).toBe(null);
  });

  test("override portrait wins", () => {
    const ref = variantOwnPortraitRef({
      id: "v1",
      label: "Dark",
      overrides: {
        media: {
          portrait: { role: "portrait", ref: "data:image/png;base64,DARK", primary: true },
        },
      },
    });
    expect(ref).toBe("data:image/png;base64,DARK");
  });

  test("variantArtUrls maps ids", () => {
    const map = variantArtUrls([
      { id: "v0", overrides: {} },
      {
        id: "v1",
        overrides: {
          media: {
            portrait: { role: "portrait", ref: "data:image/png;base64,X", primary: true },
          },
        },
      },
    ]);
    expect(map.v0).toBe(null);
    expect(map.v1).toContain("X");
  });
});
