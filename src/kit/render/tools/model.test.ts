/**
 * Capability browser navigation coverage for populated and empty studios.
 */
import { expect, test } from "bun:test";
import type { ContentCapability } from "../../../entities/capabilities";
import { initialToolsState, reduceTools, toolsActions, toolsAreas } from "./model";

const pieces = [
  { id: "book", kind: "lorebook", name: "Book", importedAt: "" },
  { id: "card", kind: "character", name: "Card", importedAt: "" },
];
const capabilities = [
  { id: "lorebook.entries.update", kind: "lorebook", area: "entries", action: "update" },
  { id: "lorebook.settings.update", kind: "lorebook", area: "settings", action: "update" },
] as unknown as ContentCapability[];

test("derives areas and actions from the selected target kind", () => {
  const state = initialToolsState();
  expect(toolsAreas(state, pieces, capabilities)).toEqual(["entries", "settings"]);
  expect(toolsActions(state, pieces, capabilities).map((item) => item.id))
    .toEqual(["lorebook.entries.update"]);
});

test("target changes reset narrower selections and empty kinds stay empty", () => {
  const moved = reduceTools(initialToolsState(), "down", pieces, capabilities).state;
  expect(moved).toMatchObject({ target: 1, area: 0, action: 0 });
  expect(toolsAreas(moved, pieces, capabilities)).toEqual([]);
});

test("escape closes and arrows move between panes", () => {
  const right = reduceTools(initialToolsState(), "right", pieces, capabilities).state;
  expect(right.pane).toBe(1);
  expect(reduceTools(right, "escape", pieces, capabilities).close).toBe(true);
});
