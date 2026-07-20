/** Regression coverage for the store-core.test behavior owned beside this file. */
import { describe, expect, test } from "bun:test";
import {
  besideKeys,
  bumpRecents,
  focusKeys,
  keyOf,
  paneKey,
  paneKeyOf,
  parseRecents,
  removeKeys,
  stagePressBatch,
  unstagePressPiece,
} from "./store-core";

test("keyOf composes kind:id", () => {
  expect(keyOf("abc", "character")).toBe("character:abc");
});

test("parseRecents drops malformed input closed", () => {
  expect(parseRecents(null)).toEqual({});
  expect(parseRecents(undefined)).toEqual({});
  expect(parseRecents([1, 2, 3])).toEqual({});
  expect(parseRecents("nope")).toEqual({});
});

test("parseRecents keeps only finite-number values", () => {
  expect(parseRecents({ a: 1, b: "x", c: NaN, d: Infinity, e: 2 })).toEqual({ a: 1, e: 2 });
});

test("bumpRecents stamps the given keys at now and keeps prior entries", () => {
  const out = bumpRecents({ "character:a": 1 }, ["character:b"], 100, 10);
  expect(out).toEqual({ "character:a": 1, "character:b": 100 });
});

test("bumpRecents overwrites an existing key's timestamp", () => {
  const out = bumpRecents({ "character:a": 1 }, ["character:a"], 200, 10);
  expect(out).toEqual({ "character:a": 200 });
});

test("bumpRecents caps at the newest `cap` entries", () => {
  const existing = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`k${i}`, i]));
  const out = bumpRecents(existing, [], 999, 3);
  expect(Object.keys(out).sort()).toEqual(["k2", "k3", "k4"]);
});

test("bumpRecents no-ops cleanly on an empty key list", () => {
  expect(bumpRecents({ a: 1 }, [], 5, 10)).toEqual({ a: 1 });
});

// -- split-pane key rules ----------------------------------------------------------------------------

test("focusKeys: focusing the active piece changes nothing", () => {
  expect(focusKeys({ activeKey: "a", splitKey: "b" }, "a")).toEqual({ activeKey: "a", splitKey: "b" });
});

test("focusKeys: focusing the split piece swaps the panes (both stay visible)", () => {
  expect(focusKeys({ activeKey: "a", splitKey: "b" }, "b")).toEqual({ activeKey: "b", splitKey: "a" });
});

test("focusKeys: focusing a third piece takes the primary pane, split stays pinned", () => {
  expect(focusKeys({ activeKey: "a", splitKey: "b" }, "c")).toEqual({ activeKey: "c", splitKey: "b" });
});

test("focusKeys: without a split, focus just moves the primary", () => {
  expect(focusKeys({ activeKey: "a", splitKey: "" }, "c")).toEqual({ activeKey: "c", splitKey: "" });
});

test("removeKeys: closing the split piece empties the split slot", () => {
  expect(removeKeys({ activeKey: "a", splitKey: "b" }, "b", "a")).toEqual({ activeKey: "a", splitKey: "" });
});

test("removeKeys: closing the primary promotes the split piece", () => {
  expect(removeKeys({ activeKey: "a", splitKey: "b" }, "a", "b")).toEqual({ activeKey: "b", splitKey: "" });
});

test("removeKeys: closing the primary with no split falls back to the first remaining", () => {
  expect(removeKeys({ activeKey: "a", splitKey: "" }, "a", "z")).toEqual({ activeKey: "z", splitKey: "" });
  expect(removeKeys({ activeKey: "a", splitKey: "" }, "a", "")).toEqual({ activeKey: "", splitKey: "" });
});

test("removeKeys: closing an uninvolved piece changes nothing", () => {
  expect(removeKeys({ activeKey: "a", splitKey: "b" }, "c", "a")).toEqual({ activeKey: "a", splitKey: "b" });
});

test("besideKeys: pinning a piece beside the primary sets the split slot", () => {
  expect(besideKeys({ activeKey: "a", splitKey: "" }, "b")).toEqual({ activeKey: "a", splitKey: "b" });
});

test("besideKeys: pinning replaces an existing split", () => {
  expect(besideKeys({ activeKey: "a", splitKey: "b" }, "c")).toEqual({ activeKey: "a", splitKey: "c" });
});

test("besideKeys: a piece cannot sit beside itself", () => {
  expect(besideKeys({ activeKey: "a", splitKey: "b" }, "a")).toEqual({ activeKey: "a", splitKey: "b" });
});

test("besideKeys: with nothing active the piece becomes the primary, not a lone split", () => {
  expect(besideKeys({ activeKey: "", splitKey: "" }, "b")).toEqual({ activeKey: "b", splitKey: "" });
});

test("paneKey: focusEntry distinguishes two views of the same entity", () => {
  expect(paneKey("b1", "lorebook")).toBe("lorebook:b1");
  expect(paneKey("b1", "lorebook", "e2")).toBe("lorebook:b1@e2");
  expect(paneKeyOf({ id: "b1", kind: "lorebook", params: { focusEntry: "e2" } })).toBe(
    "lorebook:b1@e2",
  );
  // same entity, different focus entries can sit beside each other
  expect(
    besideKeys(
      { activeKey: paneKey("b1", "lorebook", "e1"), splitKey: "" },
      paneKey("b1", "lorebook", "e2"),
    ),
  ).toEqual({
    activeKey: "lorebook:b1@e1",
    splitKey: "lorebook:b1@e2",
  });
});

describe("press queue ops", () => {
  const p = (id: string, kind = "character") => ({ id, kind, name: id });

  test("staging dedupes by kind:id and preserves order", () => {
    const q = stagePressBatch([p("a")], [p("b"), p("a"), p("b")]);
    expect(q.map((x) => x.id)).toEqual(["a", "b"]);
  });

  test("same id under different kinds are different pieces", () => {
    const q = stagePressBatch([], [p("x", "character"), p("x", "lorebook")]);
    expect(q).toHaveLength(2);
  });

  test("unstaging drops exactly the named piece", () => {
    const q = unstagePressPiece([p("a"), p("b")], "a", "character");
    expect(q.map((x) => x.id)).toEqual(["b"]);
  });
});
