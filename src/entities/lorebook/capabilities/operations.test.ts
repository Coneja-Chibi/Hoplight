/** Equivalence tests for lorebook body operations shared by every editor surface. */
import { describe, expect, test } from "bun:test";
import { emptyLorebookBody } from "../../../core/lore";
import {
  removeLorebookEntries,
  reorderLorebookEntry,
  setLorebookEntriesEnabled,
  updateLorebookEntry,
  updateLorebookSettings,
} from "./operations";

describe("lorebook capability operations", () => {
  test("updates settings without replacing entries or unrelated fields", () => {
    const body = emptyLorebookBody("World");
    const next = updateLorebookSettings(body, { name: "Aetheria", tokenBudget: 900 });

    expect(next.name).toBe("Aetheria");
    expect(next.tokenBudget).toBe(900);
    expect(next.entries).toBe(body.entries);
    expect(body.name).toBe("World");
  });

  test("updates one entry while preserving its id", () => {
    const body = emptyLorebookBody("World");
    const id = body.entries[0]!.id;
    const next = updateLorebookEntry(body, id, {
      id: "replacement-is-forbidden",
      title: "Dragon",
      content: "A large reptile",
    });

    expect(next.entries[0]).toMatchObject({ id, title: "Dragon", content: "A large reptile" });
    expect(body.entries[0]!.title).not.toBe("Dragon");
  });

  test("unknown entry ids are no-ops", () => {
    const body = emptyLorebookBody("World");
    expect(updateLorebookEntry(body, "missing", { title: "Nope" })).toBe(body);
    expect(reorderLorebookEntry(body, "missing", 0)).toBe(body);
  });

  test("reorders, enables, and removes selected entries without touching survivors", () => {
    const body = emptyLorebookBody("World");
    const first = body.entries[0]!;
    const second = { ...structuredClone(first), id: "second", title: "Second" };
    const third = { ...structuredClone(first), id: "third", title: "Third" };
    const expanded = { ...body, entries: [first, second, third] };

    const reordered = reorderLorebookEntry(expanded, "third", 0);
    expect(reordered.entries.map((entry) => entry.id)).toEqual(["third", first.id, "second"]);

    const disabled = setLorebookEntriesEnabled(reordered, [first.id, "third"], false);
    expect(disabled.entries.filter((entry) => !entry.enabled).map((entry) => entry.id))
      .toEqual(["third", first.id]);

    const removed = removeLorebookEntries(disabled, [first.id, "missing"]);
    expect(removed.entries.map((entry) => entry.id)).toEqual(["third", "second"]);
    expect(removed.entries[1]).toBe(disabled.entries[2]);
  });

  test("empty bulk selections keep referential identity", () => {
    const body = emptyLorebookBody("World");
    expect(setLorebookEntriesEnabled(body, [], false)).toBe(body);
    expect(removeLorebookEntries(body, [])).toBe(body);
  });
});
