/**
 * scanBook algorithm steps: window, keys, selective, constant/vectorized, timed, chance, budget.
 */
import { describe, expect, test } from "bun:test";
import type { LorebookBody, SelectiveLogic } from "../../entities/lorebook/schema";
import { scanBook, type TimedState } from "./activation";
import { bookOf, entry, line } from "./_test-helpers";
import panoramaBook from "./fixtures/panorama.book.json";

const firedIds = (body: LorebookBody, lines: ReturnType<typeof line>[], opts?: Parameters<typeof scanBook>[2]) =>
  scanBook(body, lines, opts ?? { chanceMode: "always" }).fired.map((v) => v.entryId).sort();

const verdictOf = (
  body: LorebookBody,
  id: string,
  lines: ReturnType<typeof line>[],
  opts?: Parameters<typeof scanBook>[2],
) => scanBook(body, lines, opts ?? { chanceMode: "always" }).verdicts.find((v) => v.entryId === id);

describe("scanBook: window (scanDepth)", () => {
  test("depth 1 only sees the last line", () => {
    const e = entry("e1", {
      triggers: [{ keyword: "alpha", isRegex: false }],
      scanDepth: 1,
    });
    const b = bookOf([e]);
    expect(firedIds(b, [line("alpha"), line("beta")])).toEqual([]);
    expect(firedIds(b, [line("beta"), line("alpha")])).toEqual(["e1"]);
  });

  test("depth 0 yields empty chat window (no key match from chat)", () => {
    const e = entry("e1", {
      triggers: [{ keyword: "alpha", isRegex: false }],
      scanDepth: 0,
    });
    expect(firedIds(bookOf([e]), [line("alpha")])).toEqual([]);
  });

  test("null scanDepth inherits book globalScanDepth", () => {
    const e = entry("e1", {
      triggers: [{ keyword: "old", isRegex: false }],
      scanDepth: null,
    });
    const b = bookOf([e], { globalScanDepth: 1 });
    expect(firedIds(b, [line("old"), line("new")])).toEqual([]);
  });
});

describe("scanBook: primary keys", () => {
  test("fires on primary key hit", () => {
    const e = entry("e1", {
      title: "A",
      triggers: [{ keyword: "powers", isRegex: false }],
    });
    const r = scanBook(bookOf([e]), [line("I use my powers")], { chanceMode: "always" });
    expect(r.fired).toHaveLength(1);
    expect(r.fired[0]?.reason).toMatchObject({ kind: "key", keyword: "powers" });
  });

  test("no-key-match when missing", () => {
    const e = entry("e1", { triggers: [{ keyword: "powers", isRegex: false }] });
    expect(verdictOf(bookOf([e]), "e1", [line("hello")])?.reason).toEqual({ kind: "no-key-match" });
  });
});

describe("scanBook: selectiveLogic", () => {
  const base = (logic: SelectiveLogic) =>
    bookOf([
      entry("e1", {
        triggers: [{ keyword: "dock", isRegex: false }],
        secondaryTriggers: [
          { keyword: "harbor", isRegex: false },
          { keyword: "pier", isRegex: false },
        ],
        selectiveLogic: logic,
      }),
    ]);

  test("and_any: primary + one secondary", () => {
    expect(firedIds(base("and_any"), [line("dock near harbor")])).toEqual(["e1"]);
    expect(firedIds(base("and_any"), [line("dock alone")])).toEqual([]);
  });

  test("and_all: needs every secondary", () => {
    expect(firedIds(base("and_all"), [line("dock harbor pier")])).toEqual(["e1"]);
    expect(firedIds(base("and_all"), [line("dock harbor")])).toEqual([]);
  });

  test("not_any: primary and zero secondaries", () => {
    expect(firedIds(base("not_any"), [line("dock alone")])).toEqual(["e1"]);
    expect(firedIds(base("not_any"), [line("dock harbor")])).toEqual([]);
  });

  test("not_all: primary and not-all secondaries", () => {
    expect(firedIds(base("not_all"), [line("dock harbor")])).toEqual(["e1"]);
    expect(firedIds(base("not_all"), [line("dock harbor pier")])).toEqual([]);
  });

  test("empty secondaries: primary alone fires (logic ignored)", () => {
    const b = bookOf([
      entry("e1", {
        triggers: [{ keyword: "dock", isRegex: false }],
        secondaryTriggers: [],
        selectiveLogic: "and_all",
      }),
    ]);
    expect(firedIds(b, [line("dock")])).toEqual(["e1"]);
  });
});

describe("scanBook: constant, vectorized, disabled", () => {
  test("constant fires with no keys", () => {
    const b = bookOf([entry("c", { constant: true, triggers: [] })]);
    const v = verdictOf(b, "c", [line("anything")]);
    expect(v?.fired).toBe(true);
    expect(v?.reason).toEqual({ kind: "constant" });
  });

  test("vectorized is excluded from key scan", () => {
    const b = bookOf([
      entry("v", {
        vectorized: true,
        triggers: [{ keyword: "powers", isRegex: false }],
      }),
    ]);
    expect(verdictOf(b, "v", [line("powers")])?.reason).toEqual({ kind: "vectorized" });
  });

  test("disabled never fires even on key hit", () => {
    const b = bookOf([
      entry("d", {
        enabled: false,
        triggers: [{ keyword: "powers", isRegex: false }],
      }),
    ]);
    expect(verdictOf(b, "d", [line("powers")])?.reason).toEqual({ kind: "disabled" });
  });
});

describe("scanBook: timed effects", () => {
  test("delay blocks until chat has enough lines", () => {
    const b = bookOf([
      entry("e", {
        delay: 3,
        triggers: [{ keyword: "go", isRegex: false }],
      }),
    ]);
    expect(verdictOf(b, "e", [line("go"), line("go")])?.reason).toMatchObject({
      kind: "delay",
      needs: 3,
      have: 2,
    });
    expect(verdictOf(b, "e", [line("x"), line("y"), line("go")])?.fired).toBe(true);
  });

  test("sticky carries across turns via turnState", () => {
    const b = bookOf([
      entry("e", {
        sticky: 2,
        triggers: [{ keyword: "spark", isRegex: false }],
      }),
    ]);
    const t0 = scanBook(b, [line("spark")], { chanceMode: "always" });
    expect(t0.fired.map((f) => f.entryId)).toEqual(["e"]);
    expect(t0.nextTurnState.stickyLeft["e"]).toBe(2);

    const t1 = scanBook(b, [line("silence")], {
      chanceMode: "always",
      turnState: t0.nextTurnState,
    });
    expect(t1.fired[0]?.reason).toMatchObject({ kind: "sticky", remaining: 2 });
    expect(t1.nextTurnState.stickyLeft["e"]).toBe(1);

    const t2 = scanBook(b, [line("silence")], {
      chanceMode: "always",
      turnState: t1.nextTurnState,
    });
    expect(t2.fired[0]?.reason).toMatchObject({ kind: "sticky", remaining: 1 });
    expect(t2.nextTurnState.stickyLeft["e"]).toBeUndefined();

    const t3 = scanBook(b, [line("silence")], {
      chanceMode: "always",
      turnState: t2.nextTurnState,
    });
    expect(t3.fired).toHaveLength(0);
  });

  test("cooldown decrements and blocks re-fire", () => {
    const b = bookOf([
      entry("e", {
        cooldown: 2,
        triggers: [{ keyword: "spark", isRegex: false }],
      }),
    ]);
    const t0 = scanBook(b, [line("spark")], { chanceMode: "always" });
    expect(t0.nextTurnState.cooldownLeft["e"]).toBe(2);

    const t1 = scanBook(b, [line("spark again")], {
      chanceMode: "always",
      turnState: t0.nextTurnState,
    });
    expect(t1.fired).toHaveLength(0);
    expect(t1.verdicts.find((v) => v.entryId === "e")?.reason).toMatchObject({
      kind: "cooldown",
      remaining: 2,
    });
    expect(t1.nextTurnState.cooldownLeft["e"]).toBe(1);

    const t2 = scanBook(b, [line("spark again")], {
      chanceMode: "always",
      turnState: t1.nextTurnState,
    });
    expect(t2.fired).toHaveLength(0);
    expect(t2.nextTurnState.cooldownLeft["e"]).toBeUndefined();
  });
});

describe("scanBook: chance", () => {
  test("probability 100 always fires under roll mode", () => {
    const b = bookOf([
      entry("e", {
        probability: 100,
        triggers: [{ keyword: "x", isRegex: false }],
      }),
    ]);
    expect(firedIds(b, [line("x")], { chanceMode: "roll", rng: () => 0.99 })).toEqual(["e"]);
  });

  test("probability 0 never fires under roll mode", () => {
    const b = bookOf([
      entry("e", {
        probability: 0,
        triggers: [{ keyword: "x", isRegex: false }],
      }),
    ]);
    expect(firedIds(b, [line("x")], { chanceMode: "roll", rng: () => 0 })).toEqual([]);
  });

  // ST ~L5034: rollValue = Math.random()*100; pass if rollValue <= probability
  test("stub rng: roll 30 with need 25 fails; roll 20 passes", () => {
    const b = bookOf([
      entry("e", {
        probability: 25,
        triggers: [{ keyword: "x", isRegex: false }],
      }),
    ]);
    expect(firedIds(b, [line("x")], { chanceMode: "roll", rng: () => 0.3 })).toEqual([]);
    expect(firedIds(b, [line("x")], { chanceMode: "roll", rng: () => 0.2 })).toEqual(["e"]);
  });

  test("chanceMode always bypasses low probability; never blocks non-100", () => {
    const b = bookOf([
      entry("e", {
        probability: 1,
        triggers: [{ keyword: "x", isRegex: false }],
      }),
    ]);
    expect(firedIds(b, [line("x")], { chanceMode: "always" })).toEqual(["e"]);
    expect(firedIds(b, [line("x")], { chanceMode: "never" })).toEqual([]);
  });
});

describe("scanBook: budget", () => {
  test("cuts later sortOrder entries when over budget", () => {
    const big = "xxxx".repeat(20);
    const b = bookOf([
      entry("first", { title: "A", content: big, sortOrder: 1, priority: 100, constant: true }),
      entry("second", { title: "B", content: big, sortOrder: 2, priority: 100, constant: true }),
    ]);
    const cost = Math.ceil(("A".length + big.length) / 4);
    const r = scanBook(b, [line("x")], { chanceMode: "always", tokenBudget: cost });
    expect(r.fired.map((f) => f.entryId)).toEqual(["first"]);
    expect(r.budget.cuts.map((c) => c.entryId)).toEqual(["second"]);
    expect(r.budget.cuts[0]?.reason).toMatchObject({ kind: "budget-cut" });
  });

  test("ignoreBudget (always-keep) survives when over budget", () => {
    const big = "xxxx".repeat(20);
    const b = bookOf([
      entry("kept", {
        title: "K",
        content: big,
        constant: true,
        sortOrder: 99,
        ignoreBudget: true,
      }),
      entry("early", {
        title: "E",
        content: big,
        constant: true,
        sortOrder: 1,
        ignoreBudget: false,
      }),
    ]);
    const cost = Math.ceil(("E".length + big.length) / 4);
    const r = scanBook(b, [line("x")], { chanceMode: "always", tokenBudget: cost });
    expect(r.fired.map((f) => f.entryId).sort()).toEqual(["early", "kept"]);
  });

  test("priority tiebreak when sortOrder equal: higher priority first", () => {
    const big = "yyyy".repeat(20);
    const b = bookOf([
      entry("low", {
        title: "L",
        content: big,
        constant: true,
        sortOrder: 5,
        priority: 10,
      }),
      entry("high", {
        title: "H",
        content: big,
        constant: true,
        sortOrder: 5,
        priority: 90,
      }),
    ]);
    const cost = Math.ceil(("H".length + big.length) / 4);
    const r = scanBook(b, [line("x")], { chanceMode: "always", tokenBudget: cost });
    expect(r.fired.map((f) => f.entryId)).toEqual(["high"]);
  });
});

describe("scanBook: verdict completeness", () => {
  test("every entry has exactly one verdict", () => {
    const body = panoramaBook as unknown as LorebookBody;
    const r = scanBook(body, [line("powers near the dock and harbor under moons")], {
      chanceMode: "always",
    });
    expect(r.verdicts).toHaveLength(body.entries.length);
    const ids = r.verdicts.map((v) => v.entryId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of body.entries) {
      expect(ids).toContain(e.id);
    }
  });
});

describe("timed state shape", () => {
  test("empty turnState is safe", () => {
    const state: TimedState = { stickyLeft: {}, cooldownLeft: {}, turn: 0 };
    const b = bookOf([entry("e", { constant: true })]);
    const r = scanBook(b, [], { chanceMode: "always", turnState: state });
    expect(r.nextTurnState.turn).toBe(1);
  });
});
