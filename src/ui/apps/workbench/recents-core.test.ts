/** Regression coverage for the recents-core.test behavior owned beside this file. */
import { expect, test } from "bun:test";
import { rankRecents } from "./recents-core";
import type { StudioEntitySummary } from "../../app-contract";

const piece = (id: string, importedAt?: string): StudioEntitySummary => ({ id, kind: "character", name: id, importedAt });

test("orders by importedAt, newest first", () => {
  const out = rankRecents(
    [piece("a", "2026-01-01T00:00:00Z"), piece("b", "2026-03-01T00:00:00Z"), piece("c", "2026-02-01T00:00:00Z")],
    {},
    new Set(),
    10,
  );
  expect(out.map((e) => e.id)).toEqual(["b", "c", "a"]);
});

test("last-opened wins when later than importedAt", () => {
  const b = piece("b", "2026-03-01T00:00:00Z");
  const a = piece("a", "2026-01-01T00:00:00Z");
  // a was opened just now, long after b was imported
  const out = rankRecents([a, b], { "character:a": Date.parse("2026-06-01T00:00:00Z") }, new Set(), 10);
  expect(out.map((e) => e.id)).toEqual(["a", "b"]);
});

test("excludes pieces already open on the Workbench", () => {
  const out = rankRecents(
    [piece("a", "2026-01-01T00:00:00Z"), piece("b", "2026-02-01T00:00:00Z")],
    {},
    new Set(["character:b"]),
    10,
  );
  expect(out.map((e) => e.id)).toEqual(["a"]);
});

test("caps at the limit", () => {
  const many = Array.from({ length: 20 }, (_, i) => piece(`p${i}`, `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`));
  expect(rankRecents(many, {}, new Set(), 5)).toHaveLength(5);
});

test("missing/garbage importedAt reads as oldest, never throws", () => {
  const out = rankRecents([piece("dated", "2026-01-01T00:00:00Z"), piece("none"), piece("bad", "not-a-date")], {}, new Set(), 10);
  expect(out[0]!.id).toBe("dated");
  expect(out).toHaveLength(3);
});
