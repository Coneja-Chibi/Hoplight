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

/**
 * split/merge built their results by enumerating fields over an empty body, so every LorebookBody
 * field not on the list silently vanished: categories (leaving entries' categoryId dangling),
 * lorebookType, genre, fandom, enabled. Pinned here so a new body field cannot repeat the bug.
 */
describe("book-ops: split/merge carry the whole body, not an enumerated subset", () => {
  const richBook = () => {
    const b = bookWith("World", ["A", "B", "C"]);
    b.categories = [
      { id: "c1", name: "Places", sortOrder: 0 },
      { id: "c2", name: "People", sortOrder: 10 },
    ];
    b.entries[0]!.categoryId = "c1";
    b.entries[1]!.categoryId = "c2";
    b.lorebookType = "world";
    b.genre = "noir";
    b.fandom = "original";
    b.enabled = true;
    return b;
  };

  test("split: both halves keep categories and the moved entry's categoryId resolves", () => {
    const { remainder, split } = splitBook(richBook(), ["e1"], "Harbor");
    const splitCatIds = new Set((split.categories ?? []).map((c) => c.id));
    const moved = split.entries[0]!;
    expect(moved.categoryId).toBe("c2");
    expect(splitCatIds.has("c2")).toBe(true);
    expect((remainder.categories ?? []).map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  test("split: descriptor fields survive onto the split half", () => {
    const { split } = splitBook(richBook(), ["e1"], "Harbor");
    expect(split.lorebookType).toBe("world");
    expect(split.genre).toBe("noir");
    expect(split.fandom).toBe("original");
    expect(split.enabled).toBe(true);
  });

  test("merge: categories from both books survive, colliding ids remapped, refs follow", () => {
    const a = richBook();
    const b = bookWith("Other", ["X"]);
    b.categories = [{ id: "c1", name: "Villains", sortOrder: 0 }]; // id collides with a's c1
    b.entries[0]!.categoryId = "c1";
    const merged = mergeBooks(a, b, "Both");
    const cats = merged.categories ?? [];
    expect(cats.map((c) => c.name).sort()).toEqual(["People", "Places", "Villains"]);
    const byName = new Map(cats.map((c) => [c.name, c.id]));
    const entryFor = (title: string) => merged.entries.find((e) => e.title === title)!;
    expect(entryFor("A").categoryId).toBe(byName.get("Places")!);
    expect(entryFor("B").categoryId).toBe(byName.get("People")!);
    expect(entryFor("X").categoryId).toBe(byName.get("Villains")!);
    expect(new Set(cats.map((c) => c.id)).size).toBe(3); // no collision survived
  });

  test("merge: a book pair without categories yields no categories key", () => {
    const merged = mergeBooks(bookWith("A", ["One"]), bookWith("B", ["Two"]));
    expect("categories" in merged).toBe(false);
  });
});
