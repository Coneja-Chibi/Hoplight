/** Asset routing differs only where static hosting cannot expose the installed docs API. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { assetUrl, docAssetUrl, isBrowserStudio } from "./asset-url";

const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
  url: "https://coneja-chibi.github.io/Hoplight/",
});

beforeAll(() => { Object.assign(globalThis, { document: dom.window.document }); });
afterAll(() => dom.window.close());

describe("asset URLs", () => {
  test("preserves a static project path", () => {
    expect(assetUrl("docs/media/example.png")).toBe(
      "https://coneja-chibi.github.io/Hoplight/docs/media/example.png",
    );
  });

  test("uses the installed allowlist route unless marked as browser Studio", () => {
    expect(isBrowserStudio()).toBe(false);
    expect(docAssetUrl("docs/media/example.png")).toBe(
      "/api/docs/asset?path=docs%2Fmedia%2Fexample.png",
    );
    const meta = dom.window.document.createElement("meta");
    meta.name = "hoplight-runtime";
    meta.content = "browser";
    dom.window.document.head.append(meta);
    expect(docAssetUrl("docs/media/example.png")).toBe(
      "https://coneja-chibi.github.io/Hoplight/docs/media/example.png",
    );
    meta.remove();
  });
});
