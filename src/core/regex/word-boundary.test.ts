/**
 * Unicode-aware word boundary router (word-boundary.ts): the three routes, the u-flag merge, and the
 * unwrap inverse. The Korean route is asserted THROUGH THE ENGINE (match AND reject), the load-bearing
 * property of the whole R3 gap-closer.
 */
import { describe, expect, test } from "bun:test";
import { mergeUnicodeFlag, unwrapWordBoundary, wrapWordBoundary } from "./word-boundary";

describe("wrapWordBoundary routing", () => {
  test("ASCII words take the \\b route, no u flag", () => {
    expect(wrapWordBoundary("(cat|dog)", ["cat", "dog"])).toEqual({
      pattern: "\\b(cat|dog)\\b",
      needsU: false,
      wholeWordDropped: false,
    });
  });

  test("Korean/Cyrillic words take the lookaround route and need u", () => {
    const kr = wrapWordBoundary("한글", ["한글"]);
    expect(kr.needsU).toBe(true);
    expect(kr.wholeWordDropped).toBe(false);
    expect(kr.pattern).toBe("(?<![\\p{L}\\p{N}_])한글(?![\\p{L}\\p{N}_])");
    expect(wrapWordBoundary("Привет", ["Привет"]).needsU).toBe(true);
  });

  test("space-less scripts (Han, Katakana, Thai) drop the wrap honestly", () => {
    for (const w of ["猫", "ネコ", "แมว"]) {
      const wrap = wrapWordBoundary(w, [w]);
      expect(wrap.wholeWordDropped).toBe(true);
      expect(wrap.pattern).toBe(w);
      expect(wrap.needsU).toBe(false);
    }
  });
});

describe("Korean boundary through the engine", () => {
  test("matches standalone/spaced, rejects glued", () => {
    const wrap = wrapWordBoundary("(강아지|고양이)", ["강아지", "고양이"]);
    const re = new RegExp(wrap.pattern, mergeUnicodeFlag("i", wrap.needsU));
    expect(re.test("강아지")).toBe(true);
    expect(re.test("나는 강아지 좋아")).toBe(true);
    expect(re.test("고양이")).toBe(true);
    expect(re.test("강아지들")).toBe(false); // glued suffix -> boundary fails
    expect(re.test("검둥강아지")).toBe(false); // glued prefix -> boundary fails
  });
});

describe("mergeUnicodeFlag", () => {
  test("adds u only when needed and idempotent", () => {
    expect(mergeUnicodeFlag("i", true)).toBe("iu");
    expect(mergeUnicodeFlag("iu", true)).toBe("iu");
    expect(mergeUnicodeFlag("i", false)).toBe("i");
  });
});

describe("unwrapWordBoundary inverse", () => {
  test("strips the ASCII wrap", () => {
    expect(unwrapWordBoundary("\\b(cat|dog)\\b")).toEqual({ core: "(cat|dog)", wholeWord: true });
  });
  test("strips the unicode lookaround wrap", () => {
    const wrap = wrapWordBoundary("한글", ["한글"]);
    expect(unwrapWordBoundary(wrap.pattern)).toEqual({ core: "한글", wholeWord: true });
  });
  test("reports no boundary when none present", () => {
    expect(unwrapWordBoundary("cat")).toEqual({ core: "cat", wholeWord: false });
  });
});
