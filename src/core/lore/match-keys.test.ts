/**
 * keywordMatches + secondaryLogicOk unit cases.
 */
import { describe, expect, test } from "bun:test";
import type { SelectiveLogic } from "../../entities/lorebook/schema";
import { keywordMatches, secondaryLogicOk } from "./match-keys";

describe("keywordMatches", () => {
  test("plain substring when wholeWords off", () => {
    expect(keywordMatches(
      { keyword: "cat", isRegex: false },
      "caterpillar",
      { wholeWords: false, caseSensitive: false },
    ).hit).toBe(true);
  });

  // ST world-info.js matchKeys ~L349-L360
  test("whole-word: cat hits 'a cat.' and misses caterpillar", () => {
    const opts = { wholeWords: true, caseSensitive: false };
    expect(keywordMatches({ keyword: "cat", isRegex: false }, "a cat.", opts).hit).toBe(true);
    expect(keywordMatches({ keyword: "cat", isRegex: false }, "caterpillar", opts).hit).toBe(false);
    expect(keywordMatches({ keyword: "cat", isRegex: false }, "the cat!", opts).hit).toBe(true);
  });

  test("whole-word multi-word key uses includes (ST ~L352)", () => {
    const opts = { wholeWords: true, caseSensitive: false };
    expect(keywordMatches(
      { keyword: "sky port", isRegex: false },
      "the sky port is open",
      opts,
    ).hit).toBe(true);
  });

  test("caseSensitive matrix", () => {
    expect(keywordMatches(
      { keyword: "Moon", isRegex: false },
      "moon",
      { wholeWords: false, caseSensitive: false },
    ).hit).toBe(true);
    expect(keywordMatches(
      { keyword: "Moon", isRegex: false },
      "moon",
      { wholeWords: false, caseSensitive: true },
    ).hit).toBe(false);
    expect(keywordMatches(
      { keyword: "Moon", isRegex: false },
      "Moon",
      { wholeWords: false, caseSensitive: true },
    ).hit).toBe(true);
  });

  test("regex keys with flags; invalid regex is a miss not a throw", () => {
    expect(keywordMatches(
      { keyword: "moon(s)?", isRegex: true, flags: "i" },
      "Moons rise",
      { wholeWords: true, caseSensitive: true },
    ).hit).toBe(true);
    expect(keywordMatches(
      { keyword: "(unclosed", isRegex: true },
      "text",
      { wholeWords: false, caseSensitive: false },
    ).hit).toBe(false);
  });

  test("inline /pattern/flags on a plain keyword string", () => {
    expect(keywordMatches(
      { keyword: "/foo|bar/i", isRegex: false },
      "BAR",
      { wholeWords: true, caseSensitive: true },
    ).hit).toBe(true);
  });

  test("empty keyword never hits", () => {
    expect(keywordMatches(
      { keyword: "", isRegex: false },
      "anything",
      { wholeWords: false, caseSensitive: false },
    ).hit).toBe(false);
  });
});

describe("secondaryLogicOk truth table", () => {
  const logics: SelectiveLogic[] = ["and_any", "and_all", "not_any", "not_all"];
  const cases: Array<{ any: boolean; all: boolean; expect: Record<SelectiveLogic, boolean> }> = [
    { any: true, all: true, expect: { and_any: true, and_all: true, not_any: false, not_all: false } },
    { any: true, all: false, expect: { and_any: true, and_all: false, not_any: false, not_all: true } },
    { any: false, all: false, expect: { and_any: false, and_all: false, not_any: true, not_all: true } },
  ];
  for (const c of cases) {
    for (const logic of logics) {
      test(`${logic} any=${c.any} all=${c.all} -> ${c.expect[logic]}`, () => {
        expect(secondaryLogicOk(logic, c.any, c.all)).toBe(c.expect[logic]);
      });
    }
  }
});
