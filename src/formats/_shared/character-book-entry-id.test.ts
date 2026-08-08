/**
 * The id an embedded character_book entry goes out with.
 *
 * REPORTED FROM THE FIELD (GeBo, 2026-08-07): SillyTavern could not import a card with an embedded
 * lorebook, "turns out on export it used a guid for the lorebook entry ID rather than an integer.
 * I edited the json and then it imported clean."
 *
 * The canonical id is a STRING by design - it has to hold ids from every format, and several of
 * them are not numbers. The embedded character_book dialect is not one of those: SillyTavern reads
 * `entry.id` as an integer, so anything else makes the card unimportable at the far end. Converting
 * belongs at the wire boundary, which is what these pin.
 */
import { describe, expect, test } from "bun:test";
import { characterBookToLorebook, lorebookToCharacterBook } from "./character-book";
import type { LorebookBody } from "../../entities/lorebook/schema";

/**
 * A canonical book with the given entry ids.
 *
 * Built by decoding a real character_book and then restating the ids, rather than hand-writing a
 * LorebookEntry: the canonical entry has thirty-odd fields and a literal here would be a second,
 * drifting description of the schema.
 */
const bookWith = (ids: readonly string[]): LorebookBody => {
  const decoded = characterBookToLorebook({
    name: "Field Notes",
    entries: ids.map((_id, index) => ({ keys: ["key"], content: "something", insertion_order: index })),
  });
  return { ...decoded, entries: decoded.entries.map((e, i) => ({ ...e, id: ids[i] ?? e.id })) };
};

const idsOf = (book: { entries: readonly { id?: number | string }[] }): (number | string | undefined)[] =>
  book.entries.map((e) => e.id);

describe("an embedded entry's id on the wire", () => {
  test("A GUID NEVER REACHES THE CARD", () => {
    /**
     * The exact failure. A lorebook that came from anywhere except a SillyTavern worldbook carries
     * ids that are not numbers, and the cross-format path wrote the canonical string straight
     * through - producing a card SillyTavern refuses, with nothing in Hoplight reporting a problem
     * because from here the export succeeded.
     */
    const book = lorebookToCharacterBook(bookWith([
      "3f2a8c1e-9b4d-4a77-8e21-0b5c6d7e8f90",
      "b17c4d2f-1a3e-4c88-9f02-1d2e3f4a5b6c",
    ]));

    for (const id of idsOf(book)) {
      expect(typeof id).toBe("number");
      expect(Number.isInteger(id)).toBe(true);
    }
  });

  test("numeric ids keep their own value rather than being renumbered", () => {
    // A book that came from SillyTavern already has integer uids, and entries reference each other
    // by them. Renumbering on the way out would silently rewrite those references.
    const book = lorebookToCharacterBook(bookWith(["7", "3", "11"]));
    expect(idsOf(book)).toEqual([7, 3, 11]);
  });

  test("a non-numeric id falls back to the entry's position, which is what ST assumes anyway", () => {
    const book = lorebookToCharacterBook(bookWith(["alpha", "beta", "gamma"]));
    expect(idsOf(book)).toEqual([0, 1, 2]);
  });

  test("A MIXED BOOK STILL COMES OUT WITH UNIQUE IDS", () => {
    /**
     * The nasty case: one entry numbered 1 beside one called "beta" that falls back to its index,
     * which is also 1. Two entries sharing an id is how a book silently loses one on import, which
     * is worse than the failure being reported - it is the same failure with no message.
     */
    const book = lorebookToCharacterBook(bookWith(["1", "beta", "1"]));
    const ids = idsOf(book);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(Number.isInteger(id)).toBe(true);
  });

  test("a huge or negative id is still an integer", () => {
    // Numbers arrive from other people's files; the contract is "an integer", not "a small one".
    const book = lorebookToCharacterBook(bookWith(["-4", "9007199254740993", "2.5"]));
    for (const id of idsOf(book)) {
      expect(Number.isInteger(id)).toBe(true);
    }
  });
});
