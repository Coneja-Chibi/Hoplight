/**
 * Recursion, wake graph, and golden workshop fixture cases for scanBook.
 */
import { describe, expect, test } from "bun:test";
import type { LorebookBody } from "../../entities/lorebook/schema";
import { bookWakeGraph, scanBook } from "./activation";
import { bookOf, entry, line } from "./_test-helpers";
import workshopBook from "./fixtures/workshop-export.book.json";

const firedIds = (body: LorebookBody, lines: ReturnType<typeof line>[]) =>
  scanBook(body, lines, { chanceMode: "always" }).fired.map((v) => v.entryId).sort();

describe("scanBook: recursion", () => {
  test("two-hop chain reports wokeBy", () => {
    const b = bookOf(
      [
        entry("a", {
          title: "A",
          content: "contains the word bravo for the next hop",
          triggers: [{ keyword: "alpha", isRegex: false }],
          preventRecursion: false,
        }),
        entry("b", {
          title: "B",
          content: "end",
          triggers: [{ keyword: "bravo", isRegex: false }],
          preventRecursion: false,
        }),
      ],
      { globalRecursion: true },
    );
    const r = scanBook(b, [line("alpha")], { chanceMode: "always", maxRecursionLoops: 3 });
    expect(r.fired.map((f) => f.entryId).sort()).toEqual(["a", "b"]);
    const bVerdict = r.verdicts.find((v) => v.entryId === "b");
    expect(bVerdict?.reason).toMatchObject({ kind: "recursion", wokeBy: "a", keyword: "bravo" });
  });

  test("preventRecursion: content does not wake others", () => {
    const b = bookOf(
      [
        entry("a", {
          content: "bravo token",
          triggers: [{ keyword: "alpha", isRegex: false }],
          preventRecursion: true,
        }),
        entry("b", {
          triggers: [{ keyword: "bravo", isRegex: false }],
        }),
      ],
      { globalRecursion: true },
    );
    expect(firedIds(b, [line("alpha")])).toEqual(["a"]);
  });

  test("excludeRecursion: cannot be woken by recursion", () => {
    const b = bookOf(
      [
        entry("a", {
          content: "bravo token",
          triggers: [{ keyword: "alpha", isRegex: false }],
        }),
        entry("b", {
          triggers: [{ keyword: "bravo", isRegex: false }],
          excludeRecursion: true,
        }),
      ],
      { globalRecursion: true },
    );
    expect(firedIds(b, [line("alpha")])).toEqual(["a"]);
  });

  test("delayUntilRecursion only fires on later loops", () => {
    const b = bookOf(
      [
        entry("a", {
          content: "bravo",
          triggers: [{ keyword: "alpha", isRegex: false }],
        }),
        entry("b", {
          triggers: [{ keyword: "bravo", isRegex: false }],
          delayUntilRecursion: 1,
        }),
      ],
      { globalRecursion: true },
    );
    const r = scanBook(b, [line("alpha")], { chanceMode: "always" });
    expect(r.fired.map((f) => f.entryId).sort()).toEqual(["a", "b"]);
    expect(r.verdicts.find((v) => v.entryId === "b")?.loop).toBeGreaterThanOrEqual(1);
  });

  test("self-wake does not loop forever", () => {
    const b = bookOf(
      [
        entry("a", {
          content: "alpha keeps appearing",
          triggers: [{ keyword: "alpha", isRegex: false }],
        }),
      ],
      { globalRecursion: true },
    );
    const r = scanBook(b, [line("alpha")], { chanceMode: "always", maxRecursionLoops: 10 });
    expect(r.fired).toHaveLength(1);
    expect(r.loops).toBeLessThanOrEqual(10);
  });

  test("globalRecursion false stops after first pass", () => {
    const b = bookOf(
      [
        entry("a", {
          content: "bravo",
          triggers: [{ keyword: "alpha", isRegex: false }],
        }),
        entry("b", {
          triggers: [{ keyword: "bravo", isRegex: false }],
        }),
      ],
      { globalRecursion: false },
    );
    expect(firedIds(b, [line("alpha")])).toEqual(["a"]);
  });
});

describe("bookWakeGraph", () => {
  test("edge when a's content matches b's key", () => {
    const b = bookOf([
      entry("a", {
        content: "the word bravo appears here",
        triggers: [{ keyword: "alpha", isRegex: false }],
      }),
      entry("b", {
        content: "end",
        triggers: [{ keyword: "bravo", isRegex: false }],
      }),
    ]);
    const { edges } = bookWakeGraph(b);
    expect(edges).toContainEqual({ from: "a", to: "b", keyword: "bravo" });
  });

  test("preventRecursion removes outbound; excludeRecursion removes inbound", () => {
    const b = bookOf([
      entry("a", {
        content: "bravo token here",
        preventRecursion: true,
        triggers: [{ keyword: "alpha", isRegex: false }],
      }),
      entry("b", {
        content: "unrelated filler text",
        excludeRecursion: true,
        triggers: [{ keyword: "bravo", isRegex: false }],
      }),
    ]);
    expect(bookWakeGraph(b).edges).toEqual([]);

    const open = bookOf([
      entry("a", {
        content: "bravo token here",
        triggers: [{ keyword: "alpha", isRegex: false }],
      }),
      entry("b", {
        content: "unrelated",
        triggers: [{ keyword: "bravo", isRegex: false }],
      }),
    ]);
    expect(bookWakeGraph(open).edges).toContainEqual({ from: "a", to: "b", keyword: "bravo" });
  });
});

describe("golden: workshop-export + powers line", () => {
  const body = workshopBook as unknown as LorebookBody;

  test("powers line fires Revival System (prototype ChatSimulator parity)", () => {
    const r = scanBook(body, [line("I reach for my powers at dawn.")], { chanceMode: "always" });
    expect(r.fired.map((f) => f.entryId)).toContain("revival-system");
    const v = r.verdicts.find((x) => x.entryId === "revival-system");
    expect(v?.reason).toMatchObject({ kind: "key", keyword: "powers" });
  });

  test("caterpillar does not fire cat (whole-word)", () => {
    const r = scanBook(body, [line("A caterpillar crawls past; no feline.")], {
      chanceMode: "always",
    });
    expect(r.fired.map((f) => f.entryId)).not.toContain("cat-key");
  });

  test("cat as whole word fires cat-key", () => {
    const r = scanBook(body, [line("a cat sat")], { chanceMode: "always" });
    expect(r.fired.map((f) => f.entryId)).toContain("cat-key");
  });

  test("recursion: powers wakes revival which can wake embers", () => {
    const r = scanBook(body, [line("powers")], {
      chanceMode: "always",
      maxRecursionLoops: 3,
    });
    expect(r.fired.map((f) => f.entryId).sort()).toEqual(["ember-echo", "revival-system"]);
  });
});

/**
 * A non-finite recursion budget used to make maxLoops NaN, which made `loop <= maxLoops` false on
 * the first check: the scan loop never ran, and every entry fell through to the no-key-match
 * default. The verdict was the damaging part, since it blamed the book's keywords for an engine
 * that never looked at them.
 */
describe("recursion budget clamping", () => {
  const book = bookOf([entry("a", { triggers: [{ keyword: "hello", isRegex: false }] })]);
  const chat = [line("hello there")];

  test("a non-finite budget falls back to the default instead of disabling the scan", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const r = scanBook(book, chat, { chanceMode: "always", maxRecursionLoops: bad });
      expect(r.fired.map((f) => f.entryId)).toEqual(["a"]);
    }
  });

  test("a fractional budget truncates rather than poisoning the comparison", () => {
    const r = scanBook(book, chat, { chanceMode: "always", maxRecursionLoops: 2.7 });
    expect(r.fired.map((f) => f.entryId)).toEqual(["a"]);
  });

  test("zero still means no recursion, and the first pass still runs", () => {
    const r = scanBook(book, chat, { chanceMode: "always", maxRecursionLoops: 0 });
    expect(r.fired.map((f) => f.entryId)).toEqual(["a"]);
    expect(r.loops).toBe(0);
  });

  test("an over-large budget is capped, not rejected", () => {
    const r = scanBook(book, chat, { chanceMode: "always", maxRecursionLoops: 9999 });
    expect(r.fired.map((f) => f.entryId)).toEqual(["a"]);
  });
});
