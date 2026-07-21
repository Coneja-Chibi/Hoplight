/**
 * tour-core tests - the pure sequencing logic, pinned directly (no DOM, no prefs). Covers the
 * clamping/tolerance the shell relies on: out-of-range indices, empty tours, and the seen predicate.
 */
import { describe, expect, test } from "bun:test";
import type { Tour } from "./tour-contract";
import { hasSeenTour, isRunnable, nextIndex, planOpenAct, positionAt, prevIndex, seenTourKeys, stepBody, tourIdCandidates, tourSeenKey } from "./tour-core";

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

describe("tourIdCandidates: the ? serves the active piece's kind on the bench", () => {
  test("bench + lorebook open tries the kind tour, then the base workbench tour", () => {
    expect(tourIdCandidates("workbench", "workbench", "lorebook")).toEqual([
      "workbench-lorebook",
      "workbench",
    ]);
  });

  test("bench + character collapses to the base tour (the character editor IS that tour)", () => {
    expect(tourIdCandidates("workbench", "workbench", "character")).toEqual(["workbench"]);
  });

  test("bench with nothing open serves the base tour", () => {
    expect(tourIdCandidates("workbench", "workbench", null)).toEqual(["workbench"]);
  });

  test("other apps serve their own id regardless of open pieces", () => {
    expect(tourIdCandidates("library", "workbench", "lorebook")).toEqual(["library"]);
    expect(tourIdCandidates("press", undefined, null)).toEqual(["press"]);
  });

  test("no active app yields nothing", () => {
    expect(tourIdCandidates("", "workbench", "lorebook")).toEqual([]);
  });
});

describe("planOpenAct truth table (the fresh-studio lie, pinned)", () => {
  test("a piece on the bench wins", () => {
    expect(planOpenAct(2, 5)).toBe("focused");
    expect(planOpenAct(1, 0)).toBe("focused");
  });
  test("a library character opens when the bench is clear", () => {
    expect(planOpenAct(0, 3)).toBe("opened");
  });
  test("an empty studio CREATES instead of narrating an open that never happened", () => {
    expect(planOpenAct(0, 0)).toBe("created");
  });
});

describe("stepBody speaks the outcome variant, never a lie", () => {
  const step = {
    id: "open",
    title: "t",
    body: "base",
    bodyBy: { opened: "I opened one of yours.", created: "I started a blank card." },
  } as never;
  test("known outcome with a variant uses it", () => {
    expect(stepBody(step, "opened")).toBe("I opened one of yours.");
    expect(stepBody(step, "created")).toBe("I started a blank card.");
  });
  test("missing variant and unknown outcome fall back to the base body", () => {
    expect(stepBody(step, "focused")).toBe("base");
    expect(stepBody(step, null)).toBe("base");
    expect(stepBody({ id: "x", title: "t", body: "plain" } as never, "opened")).toBe("plain");
  });
});
