import { describe, expect, test } from "bun:test";
import { initNewBelow, newBelowLabel, readScroll, trackNewBelow } from "./scroll-seam";

describe("readScroll", () => {
  test("content that fits is not scrollable and reads as at-bottom", () => {
    const m = readScroll({ scrollTop: 0, scrollHeight: 10, viewportHeight: 20 });
    expect(m.scrollable).toBe(false);
    expect(m.atBottom).toBe(true);
    expect(m.maxScrollTop).toBe(0);
    expect(m.distanceRows).toBe(0);
  });

  test("scrollable only when maxScrollTop exceeds 1 (mirrors the renderer threshold)", () => {
    expect(readScroll({ scrollTop: 0, scrollHeight: 21, viewportHeight: 20 }).scrollable).toBe(false);
    expect(readScroll({ scrollTop: 0, scrollHeight: 22, viewportHeight: 20 }).scrollable).toBe(true);
  });

  test("at-bottom exactly when scrollTop reaches maxScrollTop; distance counts the rows below", () => {
    const up = readScroll({ scrollTop: 5, scrollHeight: 100, viewportHeight: 20 });
    expect(up.maxScrollTop).toBe(80);
    expect(up.atBottom).toBe(false);
    expect(up.distanceRows).toBe(75);
    const down = readScroll({ scrollTop: 80, scrollHeight: 100, viewportHeight: 20 });
    expect(down.atBottom).toBe(true);
    expect(down.distanceRows).toBe(0);
  });
});

describe("trackNewBelow", () => {
  test("appended lines accumulate into unseen while scrolled up", () => {
    let state = initNewBelow(10);
    state = trackNewBelow(state, { atBottom: false, lineCount: 12 });
    expect(state.unseen).toBe(2);
    expect(state.show).toBe(true);
    state = trackNewBelow(state, { atBottom: false, lineCount: 15 });
    expect(state.unseen).toBe(5); // 2 + 3, measured against the moving lastCount
  });

  test("returning to the bottom resets unseen to zero and hides the pill", () => {
    let state = trackNewBelow(initNewBelow(10), { atBottom: false, lineCount: 13 });
    expect(state.show).toBe(true);
    state = trackNewBelow(state, { atBottom: true, lineCount: 13 });
    expect(state.unseen).toBe(0);
    expect(state.show).toBe(false);
  });

  test("the pill stays hidden when nothing new arrives while scrolled up", () => {
    const state = trackNewBelow(initNewBelow(10), { atBottom: false, lineCount: 10 });
    expect(state.unseen).toBe(0);
    expect(state.show).toBe(false);
  });

  test("a shrinking line count never drives unseen negative", () => {
    const state = trackNewBelow(initNewBelow(10), { atBottom: false, lineCount: 4 });
    expect(state.unseen).toBe(0);
  });
});

describe("newBelowLabel", () => {
  test("shows the count, capped at 99+ so it stays one short line", () => {
    expect(newBelowLabel(3)).toBe("3 new below · End to jump");
    expect(newBelowLabel(250)).toBe("99+ new below · End to jump");
  });
});
