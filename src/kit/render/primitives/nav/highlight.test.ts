import { describe, expect, test } from "bun:test";
import { segments } from "./highlight";

describe("segments", () => {
  test("empty ranges yield a single plain segment covering the whole string", () => {
    expect(segments("hello", [])).toEqual([{ text: "hello", hit: false, active: false }]);
  });

  test("a single hit splits into plain / hit / plain", () => {
    expect(segments("abcde", [[1, 3]])).toEqual([
      { text: "a", hit: false, active: false },
      { text: "bc", hit: true, active: false },
      { text: "de", hit: false, active: false },
    ]);
  });

  test("a hit at the start and end drops the empty plain edges", () => {
    expect(segments("abcd", [[0, 4]])).toEqual([{ text: "abcd", hit: true, active: false }]);
  });

  test("a range past the string end is clamped, never overruns", () => {
    expect(segments("abc", [[1, 99]])).toEqual([
      { text: "a", hit: false, active: false },
      { text: "bc", hit: true, active: false },
    ]);
  });

  test("overlapping ranges merge into one hit run", () => {
    expect(segments("abcdef", [[0, 3], [2, 5]])).toEqual([
      { text: "abcde", hit: true, active: false },
      { text: "f", hit: false, active: false },
    ]);
  });

  test("touching ranges stay separate so repeats keep their identity", () => {
    expect(segments("aabb", [[0, 2], [2, 4]])).toEqual([
      { text: "aa", hit: true, active: false },
      { text: "bb", hit: true, active: false },
    ]);
  });

  test("activeRange marks exactly the matching hit run", () => {
    const out = segments("aXbXc", [[1, 2], [3, 4]], [3, 4]);
    expect(out.filter((s) => s.hit).map((s) => s.active)).toEqual([false, true]);
  });

  test("a fully out-of-bounds range collapses to a single plain segment", () => {
    expect(segments("abc", [[10, 20]])).toEqual([{ text: "abc", hit: false, active: false }]);
  });
});
