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

describe("sampleMatchEntries and_any needs a real secondary hit", () => {
  test("primary alone does not satisfy and_any when secondaries exist", async () => {
    const { sampleMatchEntries } = await import("./sample-match");
    const entry = {
      id: "e1", title: "Gate", enabled: true, constant: false, selectiveLogic: "and_any",
      triggers: [{ keyword: "gate", isRegex: false }],
      secondaryTriggers: [{ keyword: "key", isRegex: false }],
    } as never;
    expect(sampleMatchEntries("the gate stands alone", [entry])[0]!.matched).toBe("none");
    expect(sampleMatchEntries("the gate needs a key", [entry])[0]!.matched).toBe("primary");
  });
});

describe("untrusted regex keys are vetted (the ReDoS firewall)", () => {
  const opts = { wholeWords: false, caseSensitive: false };

  test("a catastrophic-backtracking key never matches and never hangs", () => {
    const bomb = { keyword: "(a+)+$", isRegex: true } as never;
    const started = performance.now();
    const r = keywordMatches(bomb, "a".repeat(64) + "b", opts);
    expect(r.hit).toBe(false); // fail closed: refused before compile, not hung in re.test
    expect(performance.now() - started).toBeLessThan(200);
  });

  test("the inline /pattern/flags home is vetted the same way", () => {
    const bomb = { keyword: "/(x+)+$/i", isRegex: false } as never;
    const started = performance.now();
    expect(keywordMatches(bomb, "x".repeat(64) + "y", opts).hit).toBe(false);
    expect(performance.now() - started).toBeLessThan(200);
  });

  test("honest regex keys still match", () => {
    expect(keywordMatches({ keyword: "dra(gon|ke)", isRegex: true } as never, "a drake appears", opts).hit).toBe(true);
    expect(keywordMatches({ keyword: "/skyport/i", isRegex: false } as never, "The SKYPORT docks", opts).hit).toBe(true);
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
