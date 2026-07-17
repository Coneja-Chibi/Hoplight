import { describe, expect, test } from "bun:test";
import { isPreviewablePortraitRef, portraitFromRef } from "./portrait";

describe("portrait", () => {
  test("portraitFromRef builds primary asset", () => {
    const p = portraitFromRef("data:image/png;base64,AA");
    expect(p).toEqual({
      role: "portrait",
      ref: "data:image/png;base64,AA",
      primary: true,
      mime: "image/png",
    });
    expect(portraitFromRef("")).toBeNull();
  });

  test("isPreviewablePortraitRef", () => {
    expect(isPreviewablePortraitRef("data:image/png;base64,x")).toBe(true);
    expect(isPreviewablePortraitRef("https://x/a.png")).toBe(true);
    expect(isPreviewablePortraitRef("embeded://x")).toBe(false);
  });
});
