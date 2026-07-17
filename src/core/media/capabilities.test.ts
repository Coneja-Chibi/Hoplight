import { describe, expect, test } from "bun:test";
import { mediaCapabilities } from "./capabilities";

describe("mediaCapabilities", () => {
  test("full card with risu twin shows named + sprites", () => {
    const c = mediaCapabilities({ original: { risu: { raw: {} } }, targets: [] });
    expect(c.face).toBe(true);
    expect(c.sprites).toBe(true);
    expect(c.namedAssets).toBe(true);
  });

  test("lumi only lens: sprites yes, named no without risu twin", () => {
    const c = mediaCapabilities({
      original: {
        sillytavern: { raw: { data: { extensions: { expressions: { enabled: true } } } } },
      },
      targets: ["lumiverse"],
    });
    expect(c.sprites).toBe(true);
    expect(c.spriteGroups).toBe(true);
    expect(c.namedAssets).toBe(false);
  });

  test("risu lens shows named", () => {
    const c = mediaCapabilities({ original: {}, targets: ["risu"] });
    expect(c.namedAssets).toBe(true);
    expect(c.sprites).toBe(true);
  });

  test("agnai only hides sprites pack stamp", () => {
    const c = mediaCapabilities({ original: {}, targets: ["agnai"] });
    expect(c.sprites).toBe(false);
    expect(c.namedAssets).toBe(false);
  });

  test("chub/mari do not get named without risu", () => {
    const c = mediaCapabilities({ original: {}, targets: ["chub", "marinara"] });
    expect(c.namedAssets).toBe(false);
    expect(c.sprites).toBe(true);
  });
});
