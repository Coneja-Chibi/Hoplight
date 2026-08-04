/**
 * The crossing ledger.
 *
 * The fixtures are the real shape a RoleCall preset produced crossing to SillyTavern: overwhelmingly
 * rewrites, a couple of removals, no dead macros. A builder tuned for the loss report we assumed
 * would pass a made-up fixture and mislead on the real one, so the counts here are the measured ones.
 */
import { describe, expect, test } from "bun:test";
import { crossingIsLossy, reviewCrossing, summarizeCrossing } from "./crossing";
import type { MacroChange } from "../../core/preset/macros/translate";

const change = (over: Partial<MacroChange>): MacroChange => ({
  kind: "rewrite", from: "{{random::a::b}}", to: "{{random:a,b}}", where: "prompts[X].content",
  why: "", ...over,
});

const many = (n: number, over: Partial<MacroChange>): MacroChange[] =>
  Array.from({ length: n }, () => change(over));

/** What the real run reported: 133 rewrites across four families, 2 removals, 0 dead. */
const REAL: MacroChange[] = [
  ...many(48, { from: "{{random::a::b}}" }),
  ...many(43, { from: "{{getvarkey::a::b}}" }),
  ...many(40, { from: "{{setvarkey::a::b}}" }),
  ...many(2, { from: "{{roll::1d20}}" }),
  change({ kind: "absent", from: "{{choice::language_selector}}", to: null, where: "prompts[Language Selector].content" }),
  change({ kind: "absent", from: "{{upper::x}}", to: null, where: "prompts[Director Resolve].content" }),
];

const target = { kind: "preset" as const, id: "paramnesia-vi-rc" };

describe("reviewCrossing", () => {
  const review = reviewCrossing({
    target, to: "sillytavern", changes: REAL,
    carried: [{ label: "blocks", count: 150 }, { label: "setting groups", count: 7 }],
    escrowDropped: true, warningCount: 1,
  });

  test("removals lead, one row each, each naming its block", () => {
    // Never grouped: every removal is a thing somebody has to decide about.
    const removed = review.rows.filter((r) => r.severity === "removed");
    expect(removed).toHaveLength(2);
    expect(removed[0]!.from).toBe("{{choice::language_selector}}");
    expect(removed[0]!.where).toBe("Language Selector");
    expect(removed[0]!.to).toContain("no such macro");
    expect(review.rows[0]!.severity).toBe("removed");
  });

  test("rewrites collapse by family, biggest first", () => {
    // 133 individually-listed rewrites is a wall that says what four rows say.
    const rewritten = review.rows.filter((r) => r.severity === "rewritten");
    expect(rewritten.map((r) => [r.from, r.count])).toEqual([
      ["{{random}}", 48],
      ["{{getvarkey}}", 43],
      ["{{setvarkey}}", 40],
      ["{{roll}}", 2],
    ]);
  });

  test("carried rows come last and keep their counts", () => {
    const carried = review.rows.filter((r) => r.severity === "carried");
    expect(carried.map((r) => r.from)).toEqual(["150 blocks", "7 setting groups"]);
    expect(carried.every((r) => r.count === undefined)).toBe(true);
  });

  test("the summary line names the two things that happened, in order", () => {
    expect(summarizeCrossing(review)).toBe(
      "preset/paramnesia-vi-rc → sillytavern: 2 removed, 133 rewritten",
    );
  });

  test("it is lossy, because something was removed", () => {
    expect(crossingIsLossy(review)).toBe(true);
  });
});

describe("what it refuses to show", () => {
  test("an unchanged macro is not an event and produces no row", () => {
    // Showing `same` would bury the two rows that matter under a hundred that do not.
    const review = reviewCrossing({
      target, to: "sillytavern",
      changes: many(80, { kind: "same", from: "{{user}}", to: "{{user}}" }),
    });
    expect(review.rows).toHaveLength(0);
    expect(crossingIsLossy(review)).toBe(false);
  });

  test("a clean crossing says so rather than showing empty categories", () => {
    const review = reviewCrossing({ target, to: "sillytavern", changes: [] });
    expect(summarizeCrossing(review)).toBe(
      "preset/paramnesia-vi-rc crosses to sillytavern unchanged",
    );
  });

  test("rewrites alone are not lossy, so a rewrite-only crossing does not read as danger", () => {
    const review = reviewCrossing({ target, to: "sillytavern", changes: many(133, {}) });
    expect(crossingIsLossy(review)).toBe(false);
    expect(summarizeCrossing(review)).toContain("133 rewritten");
  });
});

describe("bounds", () => {
  test("a flood of removals is capped, and the overflow names the true total", () => {
    // Silently truncating would read as "only six problems" on a crossing with twenty.
    const review = reviewCrossing({
      target, to: "sillytavern",
      changes: Array.from({ length: 20 }, (_, i) =>
        change({ kind: "absent", from: `{{gone${i}}}`, to: null })),
    });
    const removed = review.rows.filter((r) => r.severity === "removed");
    expect(removed).toHaveLength(7);
    expect(removed[6]!.from).toBe("14 more");
  });

  test("a collision is a removal that says it needs review, not that it vanished", () => {
    const review = reviewCrossing({
      target, to: "sillytavern",
      changes: [change({ kind: "collision", from: "{{ambiguous}}", to: "{{ambiguous}}" })],
    });
    expect(review.rows[0]!.to).toContain("needs review");
    expect(crossingIsLossy(review)).toBe(true);
  });

  test("a flatten is a rewrite that says what it did", () => {
    const review = reviewCrossing({
      target, to: "sillytavern",
      changes: [change({ kind: "flatten", from: "{{#if x}}" })],
    });
    expect(review.rows[0]!.severity).toBe("rewritten");
    expect(review.rows[0]!.to).toBe("expanded inline");
  });
});
