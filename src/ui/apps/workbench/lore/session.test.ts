import { describe, expect, test } from "bun:test";
import { emptyLorebookBody } from "../../../../core/lore";
import {
  addEntry,
  deleteEntry,
  duplicateEntry,
  focusedEntry,
  normalizeSession,
  reconcileLoreAfterSave,
  reorderEntry,
  selectEntry,
  sessionDirty,
  updateBook,
  updateEntry,
} from "./session";

describe("lore session (the binder: one focused entry)", () => {
  test("normalize focuses the first entry", () => {
    const s = normalizeSession(emptyLorebookBody("A"));
    expect(s.focusedId).toBe(s.body.entries[0]!.id);
    expect(s.openIds).toEqual([s.body.entries[0]!.id]);
  });

  test("selectEntry moves the page; unknown ids are ignored", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    const first = s.body.entries[0]!.id;
    s = addEntry(s); // adds + focuses the new entry
    const second = s.focusedId!;
    expect(second).not.toBe(first);
    s = selectEntry(s, first);
    expect(s.focusedId).toBe(first);
    expect(s.openIds).toEqual([first]);
    expect(selectEntry(s, "nope")).toBe(s);
  });

  test("focusedEntry resolves the page's entry", () => {
    const s = normalizeSession(emptyLorebookBody("A"));
    expect(focusedEntry(s)!.id).toBe(s.focusedId!);
  });

  test("delete refocuses a surviving entry; duplicate focuses the copy", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    const first = s.body.entries[0]!.id;
    s = duplicateEntry(s, first);
    const copy = s.focusedId!;
    expect(copy).not.toBe(first);
    s = deleteEntry(s, copy);
    expect(s.body.entries.some((e) => e.id === copy)).toBe(false);
    expect(s.focusedId).toBe(first);
  });

  test("reorderEntry moves within the array; displayIndex untouched when unused", () => {
    let s = normalizeSession(emptyLorebookBody("A"));
    s = addEntry(s);
    const [a, b] = s.body.entries.map((e) => e.id);
    s = reorderEntry(s, b!, 0);
    expect(s.body.entries[0]!.id).toBe(b!);
    expect(s.body.entries.every((e) => e.displayIndex === undefined)).toBe(true);
    expect(s.body.entries.some((e) => e.id === a)).toBe(true);
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
});
