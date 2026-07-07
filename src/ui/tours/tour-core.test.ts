/**
 * tour-core tests - the pure sequencing logic, pinned directly (no DOM, no prefs). Covers the
 * clamping/tolerance the shell relies on: out-of-range indices, empty tours, and the seen predicate.
 */
import { describe, expect, test } from "bun:test";
import type { Tour } from "./tour-contract";
import { hasSeenTour, isRunnable, nextIndex, positionAt, prevIndex, seenTourKeys, tourSeenKey } from "./tour-core";

const tour = (n: number): Tour => ({
  manifest: { appId: "workbench", title: "Getting started" },
  steps: Array.from({ length: n }, (_, i) => ({ id: `s${i}`, title: `Step ${i}`, body: "..." })),
});

describe("tourSeenKey / hasSeenTour", () => {
  test("key is namespaced by app", () => {
    expect(tourSeenKey("workbench")).toBe("tour.workbench.seen");
    expect(tourSeenKey("library")).toBe("tour.library.seen");
  });
  test("only literal true counts as seen (tolerant of unset/stale)", () => {
    expect(hasSeenTour(true)).toBe(true);
    expect(hasSeenTour(false)).toBe(false);
    expect(hasSeenTour(undefined)).toBe(false);
    expect(hasSeenTour("true")).toBe(false);
    expect(hasSeenTour(1)).toBe(false);
  });
});

describe("seenTourKeys", () => {
  test("finds every tour-seen key and ignores the rest", () => {
    const settings = {
      "tour.workbench.seen": true,
      "tour.library.seen": false,
      "editor.layout": "bento",
      "theme": "dark",
      "tour.press.seen": true,
    };
    expect(seenTourKeys(settings).sort()).toEqual(["tour.library.seen", "tour.press.seen", "tour.workbench.seen"]);
  });
  test("empty when there are no tours", () => {
    expect(seenTourKeys({ theme: "dark" })).toEqual([]);
  });
});

describe("positionAt", () => {
  test("empty tour yields a null step, marked first and last", () => {
    const p = positionAt(tour(0), 0);
    expect(p.step).toBeNull();
    expect(p.total).toBe(0);
    expect(p.human).toBe(0);
    expect(p.isFirst).toBe(true);
    expect(p.isLast).toBe(true);
  });
  test("mid-tour position reports human 1-based and neither bound", () => {
    const p = positionAt(tour(5), 2);
    expect(p.step?.id).toBe("s2");
    expect(p.index).toBe(2);
    expect(p.human).toBe(3);
    expect(p.isFirst).toBe(false);
    expect(p.isLast).toBe(false);
  });
  test("out-of-range indices clamp instead of throwing", () => {
    expect(positionAt(tour(3), -5).index).toBe(0);
    expect(positionAt(tour(3), 99).index).toBe(2);
    expect(positionAt(tour(3), 99).isLast).toBe(true);
    expect(positionAt(tour(3), 2.7).index).toBe(2);
  });
});

describe("nextIndex / prevIndex", () => {
  test("advance clamps at the last step", () => {
    const t = tour(3);
    expect(nextIndex(t, 0)).toBe(1);
    expect(nextIndex(t, 2)).toBe(2);
    expect(nextIndex(t, 99)).toBe(2);
  });
  test("retreat clamps at the first step", () => {
    expect(prevIndex(0)).toBe(0);
    expect(prevIndex(2)).toBe(1);
    expect(prevIndex(-4)).toBe(0);
  });
});

describe("isRunnable", () => {
  test("a tour needs at least one step", () => {
    expect(isRunnable(tour(1))).toBe(true);
    expect(isRunnable(tour(0))).toBe(false);
    expect(isRunnable(null)).toBe(false);
    expect(isRunnable(undefined)).toBe(false);
  });
});
