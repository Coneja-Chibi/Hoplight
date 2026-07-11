/**
 * split/merge/duplicate pure book ops.
 */
import { describe, expect, test } from "bun:test";
import {
  duplicateBook,
  filterEnabledBooks,
  mergeBooks,
  renumberEntries,
  splitBook,
} from "./book-ops";
import { emptyLoreEntry, emptyLorebookBody } from "./empty-book";

const bookWith = (name: string, titles: string[]) => {
  const body = emptyLorebookBody(name);
  body.entries = titles.map((title, i) => ({
    ...emptyLoreEntry(`e${i}`),
    title,
    content: `content for ${title} long enough`,
    sortOrder: i * 10,
  }));
  return body;
};

describe("book-ops", () => {
  test("split moves ids and renumbers both sides", () => {
    const b = bookWith("World", ["A", "B", "C"]);
    const { remainder, split } = splitBook(b, ["e1"], "Harbor");
    expect(split.name).toBe("Harbor");
    expect(split.entries.map((e) => e.title)).toEqual(["B"]);
    expect(remainder.entries.map((e) => e.title)).toEqual(["A", "C"]);
    expect(remainder.entries.map((e) => e.sortOrder)).toEqual([0, 10]);
  });

  test("split rejects empty move list", () => {
    expect(() => splitBook(bookWith("W", ["A"]), [], "X")).toThrow(/at least one/);
  });

  test("mergeBooks round-trip restores content set (ids differ)", () => {
    const a = bookWith("A", ["One", "Two"]);
    const b = bookWith("B", ["Three"]);
    const m = mergeBooks(a, b, "All");
    expect(m.name).toBe("All");
    const titles = m.entries.map((e) => e.title).sort();
    expect(titles).toEqual(["One", "Three", "Two"]);
    expect(new Set(m.entries.map((e) => e.id)).size).toBe(3);
    expect(m.entries.map((e) => e.sortOrder)).toEqual([0, 10, 20]);
  });

  test("merge name defaults to a + b", () => {
    const m = mergeBooks(bookWith("Alpha", ["x"]), bookWith("Beta", ["y"]));
    expect(m.name).toBe("Alpha + Beta");
  });

  test("duplicateBook refreshes ids and renumbers", () => {
    const b = bookWith("Src", ["A", "B"]);
    const d = duplicateBook(b, "Copy");
    expect(d.name).toBe("Copy");
    expect(d.entries.map((e) => e.title)).toEqual(["A", "B"]);
    expect(d.entries.every((e, i) => e.id !== b.entries[i]!.id)).toBe(true);
  });

  test("renumberEntries is sequential", () => {
    const b = bookWith("R", ["A", "B"]);
    b.entries[0]!.sortOrder = 99;
    b.entries[1]!.sortOrder = 5;
    const r = renumberEntries(b);
    expect(r.entries.map((e) => e.title)).toEqual(["B", "A"]);
    expect(r.entries.map((e) => e.sortOrder)).toEqual([0, 10]);
  });

  test("split+merge content set equals original (ids may differ)", () => {
    const b = bookWith("World", ["A", "B", "C"]);
    const { remainder, split } = splitBook(b, ["e0", "e2"], "Part");
    const back = mergeBooks(remainder, split, "World");
    const contents = (x: typeof b) =>
      x.entries.map((e) => e.content).sort();
    // remainder has B; split has A,C; merge has all three contents
    expect(contents(back).sort()).toEqual(contents(b).sort());
  });

  test("filterEnabledBooks drops explicit off books", () => {
    const a = { body: { enabled: true } };
    const b = { body: { enabled: false } };
    const c = { body: {} };
    expect(filterEnabledBooks([a, b, c])).toEqual([a, c]);
  });
});
