/**
 * mediaExportSummary chips.
 */
import { describe, expect, test } from "bun:test";
import { mediaExportSummary } from "./summary";

describe("mediaExportSummary", () => {
  test("empty body: no chips", () => {
    const s = mediaExportSummary({});
    expect(s.emotions).toBe(0);
    expect(s.named).toBe(0);
    expect(s.hasPortrait).toBe(false);
    expect(s.chips).toEqual([]);
  });

  test("portrait + emotions", () => {
    const s = mediaExportSummary({
      media: {
        portrait: { role: "portrait", ref: "data:image/png;base64,xx", primary: true },
        assets: [
          { role: "emotion", label: "happy", ref: "h" },
          { role: "emotion", label: "sad", ref: "s" },
        ],
      },
    });
    expect(s.hasPortrait).toBe(true);
    expect(s.emotions).toBe(2);
    expect(s.chips).toEqual(["portrait", "2 emotions"]);
  });

  test("named from risu original", () => {
    const s = mediaExportSummary(
      { media: { assets: [{ role: "emotion", label: "a", ref: "1" }] } },
      {
        risu: {
          raw: {
            data: {
              additionalAssets: [["bgm", "data:audio/mp3;base64,aa", "mp3"]],
            },
          },
        },
      },
    );
    expect(s.emotions).toBe(1);
    expect(s.named).toBe(1);
    expect(s.chips).toContain("1 emotion");
    expect(s.chips).toContain("1 named");
  });
});
