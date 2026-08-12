/**
 * Fullscreen, and the answer when there is none.
 *
 * The failure this guards is a button that does nothing: an engine without the API, or one that
 * refuses the request, must come back saying "overlay" so the caller covers the app instead. A
 * throw here would surface as an unhandled rejection and no fullscreen at all.
 */
import { describe, expect, test } from "bun:test";
import { exitFullscreen, fullscreenElement, requestFullscreen } from "./fullscreen";

const elementWith = (impl: Record<string, unknown>): Element => impl as unknown as Element;
const docWith = (impl: Record<string, unknown>): Document => impl as unknown as Document;

describe("requestFullscreen", () => {
  test("uses the standard call and reports the native path", async () => {
    let asked = 0;
    const el = elementWith({ requestFullscreen: async () => { asked += 1; } });
    expect(await requestFullscreen(el)).toBe("native");
    expect(asked).toBe(1);
  });

  test("falls back to the overlay when the engine has no such method", async () => {
    // The packaged shell is not a browser tab; a missing API is an ordinary answer here.
    expect(await requestFullscreen(elementWith({}))).toBe("overlay");
  });

  test("falls back to the overlay when the request is refused, rather than throwing", async () => {
    const el = elementWith({ requestFullscreen: async () => { throw new Error("not allowed"); } });
    expect(await requestFullscreen(el)).toBe("overlay");
  });

  test("takes the webkit spelling when that is the only one", async () => {
    let asked = 0;
    const el = elementWith({ webkitRequestFullscreen: () => { asked += 1; } });
    expect(await requestFullscreen(el)).toBe("native");
    expect(asked).toBe(1);
  });

  test("a missing element is the overlay, not a crash", async () => {
    expect(await requestFullscreen(null)).toBe("overlay");
  });
});

describe("exitFullscreen", () => {
  test("does nothing when nothing is fullscreen", async () => {
    let left = 0;
    await exitFullscreen(docWith({
      fullscreenElement: null,
      exitFullscreen: async () => { left += 1; },
    }));
    expect(left).toBe(0);
  });

  test("leaves when something is", async () => {
    let left = 0;
    await exitFullscreen(docWith({
      fullscreenElement: {},
      exitFullscreen: async () => { left += 1; },
    }));
    expect(left).toBe(1);
  });

  test("a refusal on the way out is not an error either", async () => {
    await exitFullscreen(docWith({
      fullscreenElement: {},
      exitFullscreen: async () => { throw new Error("nope"); },
    }));
    expect(true).toBe(true); // reaching here is the assertion: it did not throw
  });
});

describe("fullscreenElement", () => {
  test("reads either spelling, and null when neither is set", () => {
    expect(fullscreenElement(docWith({ fullscreenElement: null }))).toBeNull();
    const el = elementWith({});
    expect(fullscreenElement(docWith({ fullscreenElement: el }))).toBe(el);
    expect(fullscreenElement(docWith({ fullscreenElement: null, webkitFullscreenElement: el }))).toBe(el);
  });
});
