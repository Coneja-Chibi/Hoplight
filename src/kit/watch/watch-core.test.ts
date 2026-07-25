/** Proves studio snapshots become one bounded, coalesced outside-change notice. */
import { expect, test } from "bun:test";
import type { EntitySummary } from "../bridge";
import { diffStudio, watchSummary } from "./watch-core";

const piece = (id: string, name: string): EntitySummary => ({
  id,
  kind: "character",
  name,
});

test("classifies added, removed, and updated pieces without mutating snapshots", () => {
  const before = [piece("basil", "Basil"), piece("mira", "Mira")];
  const after = [piece("basil", "Basil v2"), piece("cedric", "Cedric")];
  const change = diffStudio(before, after);
  if (!change) throw new Error("expected a studio change");
  expect(change.added.map((item) => item.id)).toEqual(["cedric"]);
  expect(change.removed.map((item) => item.id)).toEqual(["mira"]);
  expect(change.updated.map((item) => item.id)).toEqual(["basil"]);
  expect(before.map((item) => item.name)).toEqual(["Basil", "Mira"]);
});

test("a single import offers one concrete next move", () => {
  const change = diffStudio([], [piece("basil-v2", "Basil v2")]);
  if (!change) throw new Error("expected a studio change");
  expect(watchSummary(change)).toBe(
    "new character spotted · Basil v2 · ask me to compare it",
  );
});

test("an unchanged snapshot produces no notice", () => {
  const snapshot = [piece("basil", "Basil")];
  expect(diffStudio(snapshot, snapshot)).toBeNull();
});
