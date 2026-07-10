import { describe, expect, test } from "bun:test";
import { emptyLorebookBody } from "../../../../core/lore";
import {
  addEntry,
  closeEntryPanel,
  deleteEntry,
  duplicateEntry,
  focusEntryPanel,
  focusedEntry,
  MAX_OPEN_PANELS,
  normalizeSession,
  openEntries,
  openEntryBeside,
  reconcileLoreAfterSave,
  selectEntry,
  sessionDirty,
  updateBook,
  updateEntry,
} from "./session";

describe("lore session", () => {
  test("normalize opens the first entry in one focused panel", () => {
    const s = normalizeSession(emptyLorebookBody("A"));
    expect(s.openIds).toEqual([s.body.entries[0]!.id]);
    expect(s.focusedId).toBe(s.body.entries[0]!.id);
  });

  test("selectEntry replaces the focused panel, never opens a second one", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    const first = s.body.entries[0]!.id;
    s = addEntry(s); // adds + selects the new entry into the focused slot
    const second = s.focusedId!;
    expect(second).not.toBe(first);
    expect(s.openIds).toEqual([second]);
    s = selectEntry(s, first);
    expect(s.openIds).toEqual([first]);
    expect(s.focusedId).toBe(first);
  });

  test("openEntryBeside opens a second panel and caps at MAX_OPEN_PANELS", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    const first = s.body.entries[0]!.id;
    s = addEntry(s);
    const second = s.focusedId!;
    s = selectEntry(s, first);
    s = openEntryBeside(s, second);
    expect(s.openIds).toEqual([first, second]);
    expect(s.focusedId).toBe(second);
    expect(s.openIds.length).toBeLessThanOrEqual(MAX_OPEN_PANELS);
    // a third entry replaces the non-focused panel, not a third pane
    s = addEntry(s); // adds + selects into the focused slot (replaces `second`)
    const third = s.focusedId!;
    expect(s.openIds).toEqual([first, third]);
    s = focusEntryPanel(s, first);
    s = openEntryBeside(s, second);
    expect(s.openIds.length).toBe(MAX_OPEN_PANELS);
    expect(s.openIds).toContain(first);
    expect(s.openIds).toContain(second);
  });

  test("openEntryBeside on an already-open entry just moves focus", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    const first = s.body.entries[0]!.id;
    s = openEntryBeside(s, first);
    expect(s.openIds).toEqual([first]);
    expect(s.focusedId).toBe(first);
  });

  test("closeEntryPanel keeps the entry, drops the panel, refocuses the survivor", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    const first = s.body.entries[0]!.id;
    s = addEntry(s);
    const second = s.focusedId!;
    s = selectEntry(s, first);
    s = openEntryBeside(s, second);
    s = closeEntryPanel(s, second);
    expect(s.openIds).toEqual([first]);
    expect(s.focusedId).toBe(first);
    expect(s.body.entries.some((e) => e.id === second)).toBe(true);
  });

  test("focusedEntry and openEntries resolve panels in pane order", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    const first = s.body.entries[0]!.id;
    s = addEntry(s);
    const second = s.focusedId!;
    s = selectEntry(s, first);
    s = openEntryBeside(s, second);
    expect(openEntries(s).map((e) => e.id)).toEqual([first, second]);
    expect(focusedEntry(s)!.id).toBe(second);
  });

  test("deleteEntry prunes its panel; a cleared desk reopens on the first remaining entry", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    const first = s.body.entries[0]!.id;
    s = addEntry(s);
    const second = s.focusedId!;
    s = selectEntry(s, first);
    s = openEntryBeside(s, second);
    s = deleteEntry(s, second);
    expect(s.openIds).toEqual([first]);
    expect(s.focusedId).toBe(first);
    s = deleteEntry(s, first);
    // one entry may remain from the empty-book factory; the desk must not be blank while entries exist
    if (s.body.entries.length > 0) {
      expect(s.openIds).toEqual([s.body.entries[0]!.id]);
    } else {
      expect(s.openIds).toEqual([]);
      expect(s.focusedId).toBeNull();
    }
  });

  test("duplicate selects the copy into the focused slot", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    const first = s.body.entries[0]!.id;
    s = duplicateEntry(s, first);
    expect(s.body.entries).toHaveLength(2);
    expect(s.focusedId).not.toBe(first);
    expect(s.openIds).toEqual([s.focusedId!]);
  });

  test("update entry and book", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    const id = s.focusedId!;
    s = updateEntry(s, id, { title: "Dragon", content: "A large reptile" });
    expect(s.body.entries[0]!.title).toBe("Dragon");
    s = updateBook(s, { name: "Aetheria" });
    expect(s.body.name).toBe("Aetheria");
  });

  test("dirty and reconcile", () => {
    const baseline = emptyLorebookBody("A");
    let s = normalizeSession(structuredClone(baseline));
    expect(sessionDirty(s, baseline)).toBe(false);
    s = updateBook(s, { name: "B" });
    expect(sessionDirty(s, baseline)).toBe(true);
    const submitted = structuredClone(s.body);
    const concurrent = { ...s.body, name: "C" };
    const r = reconcileLoreAfterSave({ live: concurrent, submitted });
    expect(r.dirty).toBe(true);
    expect(r.current.name).toBe("C");
    const clean = reconcileLoreAfterSave({ live: submitted, submitted });
    expect(clean.dirty).toBe(false);
  });

  test("selectEntry and openEntryBeside ignore unknown ids", () => {
    const s = normalizeSession(emptyLorebookBody("A"));
    expect(selectEntry(s, "nope")).toBe(s);
    expect(openEntryBeside(s, "nope")).toBe(s);
  });
});
