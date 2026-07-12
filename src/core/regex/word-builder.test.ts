/**
 * "Match these words" builder (word-builder.ts): the tune-grid grammar, and the build/decompile
 * inverse that makes the editor's "words -> pattern -> words" mode switch lossless. The Korean case
 * proves the unicode boundary survives a full build -> decompile -> rebuild round trip.
 */
import { describe, expect, test } from "bun:test";
import { buildWordsPattern, decompileWordsState, EMPTY_WORDS_STATE } from "./word-builder";

const state = (patch: Partial<typeof EMPTY_WORDS_STATE>) => ({ ...EMPTY_WORDS_STATE, ...patch });

describe("buildWordsPattern", () => {
  test("empty input builds nothing", () => {
    expect(buildWordsPattern(EMPTY_WORDS_STATE)).toMatchObject({ pattern: "", flags: "" });
  });

  test("single word, whole-word + case-insensitive by default", () => {
    const built = buildWordsPattern(state({ wordsInput: "cat" }));
    expect(built.pattern).toBe("\\bcat\\b");
    expect(built.flags).toBe("i");
    expect(built.description.length).toBeGreaterThan(0);
  });

  test("the full tune grid assembles in the RC order", () => {
    const built = buildWordsPattern(
      state({
        wordsInput: "dash, dashes, dashing, sprinted",
        excludeWords: "dashboard",
        mustNotBeFollowedBy: "cam",
      }),
    );
    const re = new RegExp(built.pattern, built.flags);
    expect(re.test("she dashes off")).toBe(true);
    expect(re.test("the dashboard lit up")).toBe(false); // excluded
    expect(built.familyWarning).toBeTruthy();
    expect(built.optimizedWords.length).toBeGreaterThan(0);
  });

  test("allowNumbers wraps each word in \\d*", () => {
    const built = buildWordsPattern(state({ wordsInput: "hp", allowNumbers: true }));
    const re = new RegExp(built.pattern, built.flags);
    expect(re.test("hp5")).toBe(true);
    expect(re.test("3hp")).toBe(true);
  });

  test("Korean words route to lookaround boundaries + u flag", () => {
    const built = buildWordsPattern(state({ wordsInput: "강아지, 고양이" }));
    expect(built.flags).toContain("u");
    expect(built.wholeWordDropped).toBe(false);
    const re = new RegExp(built.pattern, built.flags);
    expect(re.test("나는 강아지 좋아")).toBe(true);
    expect(re.test("강아지들")).toBe(false);
  });
});

describe("decompileWordsState inverse", () => {
  test("round-trips the full tune grid to the same pattern", () => {
    const s = state({
      wordsInput: "cat, dog",
      excludeWords: "catalog",
      optionalSuffixes: "s, es",
      mustBeFollowedBy: "runs",
      caseSensitive: true,
    });
    const built = buildWordsPattern(s);
    const back = decompileWordsState(built.pattern, built.flags);
    expect(back).not.toBeNull();
    expect(buildWordsPattern(back!).pattern).toBe(built.pattern);
    expect(buildWordsPattern(back!).flags).toBe(built.flags);
  });

  test("Korean words rule decompiles (not null) and rebuilds identically", () => {
    const built = buildWordsPattern(state({ wordsInput: "강아지, 고양이" }));
    const back = decompileWordsState(built.pattern, built.flags);
    expect(back).not.toBeNull();
    expect(back!.wholeWordsOnly).toBe(true);
    expect(buildWordsPattern(back!).pattern).toBe(built.pattern);
  });

  test("returns null for a pattern outside the grammar", () => {
    expect(decompileWordsState("^\\d{4}$", "")).toBeNull();
    expect(decompileWordsState("\\bcat\\b", "gm")).toBeNull(); // foreign flags
  });
});

describe("lossless mode switch: words -> pattern edit -> back", () => {
  test("a pattern edit is reflected when words mode re-seeds from find/flags", () => {
    // 1. author in words mode
    const built = buildWordsPattern(state({ wordsInput: "cat, dog" }));
    expect(built.pattern).toBe("\\b(cat|dog)\\b");

    // 2. switch to Pattern mode and edit the find directly (add a third word)
    const editedFind = "\\b(cat|dog|fox)\\b";
    const editedFlags = built.flags;

    // 3. switch back to words mode: it re-seeds from the CURRENT find/flags (mode is a view)
    const reseeded = decompileWordsState(editedFind, editedFlags);
    expect(reseeded).not.toBeNull();
    expect(reseeded!.wordsInput).toBe("cat, dog, fox"); // the edit survived
    // and rebuilding the re-seeded state reproduces the edited pattern exactly (lossless)
    expect(buildWordsPattern(reseeded!).pattern).toBe(editedFind);
  });
});
