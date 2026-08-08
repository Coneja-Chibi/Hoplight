/**
 * What a collection promises about somebody's grouping.
 *
 * The load-bearing tests here are about REFERENCES ROTTING and IDS STAYING PUT, because those are
 * the two ways a grouping feature loses somebody's work quietly: a piece disappears from a list with
 * no explanation, or a rename silently unhooks every mention already written down.
 */
import { describe, expect, test } from "bun:test";
import {
  addToCollection,
  collectionsHolding,
  createCollection,
  deleteCollection,
  EMPTY_COLLECTIONS,
  parseCollections,
  removeFromCollection,
  renameCollection,
  resolveCollection,
  slugFor,
} from "./collections-shape";

const withOne = (name = "The Cast") => createCollection(EMPTY_COLLECTIONS, name);

describe("slugFor", () => {
  test("a typed name becomes a marker-safe id", () => {
    expect(slugFor("The Cast")).toBe("the-cast");
    expect(slugFor("Ludovic & Levi")).toBe("ludovic-levi");
  });

  test("NO SPACES OR COLONS SURVIVE, because the id goes inside `@collection:<id>`", () => {
    /**
     * A space would end the mention early and a colon would split it in the wrong place, so the
     * marker would point at something other than what was picked. The same family of bug as the
     * `ludovic-&-levi.json` file that could not be opened.
     */
    const slug = slugFor("Act II: the long night");
    expect(slug).not.toContain(" ");
    expect(slug).not.toContain(":");
    expect(slug).toBe("act-ii-the-long-night");
  });

  test("a name this alphabet cannot spell still gets a collection", () => {
    // A refusal or an empty id here would mean "you may not name it that", which is not the app's
    // call to make about somebody's own grouping.
    expect(slugFor("???")).toBe("collection");
    expect(slugFor("キャスト")).toBe("collection");
  });

  test("TWO COLLECTIONS MAY SHARE A NAME BUT NEVER AN ID", () => {
    // People name things "new" twice. A duplicate id would make `@collection:new` ambiguous.
    expect(slugFor("The Cast", ["the-cast"])).toBe("the-cast-2");
    expect(slugFor("The Cast", ["the-cast", "the-cast-2"])).toBe("the-cast-3");
  });
});

describe("editing a collection", () => {
  test("adding a piece stores a reference, not the piece", () => {
    const { file, created } = withOne();
    const next = addToCollection(file, created.id, { kind: "character", id: "basil-1" });
    expect(next.collections[0]?.members).toEqual([{ kind: "character", id: "basil-1" }]);
  });

  test("ADDING THE SAME PIECE TWICE IS ONE MEMBERSHIP", () => {
    // Something people do by accident; a collection listing a character twice is a bug that looks
    // like data.
    const { file, created } = withOne();
    const ref = { kind: "character", id: "basil-1" };
    const next = addToCollection(addToCollection(file, created.id, ref), created.id, ref);
    expect(next.collections[0]?.members).toHaveLength(1);
  });

  test("kind is part of the identity: same id in two decks is two pieces", () => {
    const { file, created } = withOne();
    const one = addToCollection(file, created.id, { kind: "character", id: "basil" });
    const two = addToCollection(one, created.id, { kind: "preset", id: "basil" });
    expect(two.collections[0]?.members).toHaveLength(2);
  });

  test("a piece belongs to as many collections as somebody puts it in", () => {
    const first = createCollection(EMPTY_COLLECTIONS, "Cast");
    const second = createCollection(first.file, "Act II");
    const ref = { kind: "character", id: "basil-1" };
    let file = addToCollection(second.file, first.created.id, ref);
    file = addToCollection(file, second.created.id, ref);
    expect(collectionsHolding(file, ref).map((c) => c.name)).toEqual(["Cast", "Act II"]);
  });

  test("removing touches one collection and leaves the other holding it", () => {
    const first = createCollection(EMPTY_COLLECTIONS, "Cast");
    const second = createCollection(first.file, "Act II");
    const ref = { kind: "character", id: "basil-1" };
    let file = addToCollection(second.file, first.created.id, ref);
    file = addToCollection(file, second.created.id, ref);
    file = removeFromCollection(file, first.created.id, ref);
    expect(collectionsHolding(file, ref).map((c) => c.name)).toEqual(["Act II"]);
  });

  test("A RENAME NEVER CHANGES THE ID", () => {
    /**
     * Every `@collection:<id>` already written into a transcript keeps pointing here. If the id
     * tracked the name, renaming "Cast" to "Act II" would silently unhook every mention of it - the
     * feature would look like it worked and the references would all be dead.
     */
    const { file, created } = withOne("Cast");
    const next = renameCollection(file, created.id, "Act II");
    expect(next.collections[0]?.id).toBe(created.id);
    expect(next.collections[0]?.name).toBe("Act II");
  });

  test("an empty rename is refused rather than stored", () => {
    const { file, created } = withOne("Cast");
    expect(renameCollection(file, created.id, "").collections[0]?.name).toBe("Cast");
  });

  test("editing an unknown collection is a no-op, not a throw", () => {
    const { file } = withOne();
    expect(addToCollection(file, "nope", { kind: "character", id: "x" })).toEqual(file);
    expect(renameCollection(file, "nope", "x")).toEqual(file);
    expect(deleteCollection(file, "nope")).toEqual(file);
  });

  test("DELETING A COLLECTION DELETES NO PIECES", () => {
    // The whole point of holding references: a grouping is a view of the studio, and throwing away
    // the view must never throw away what it was a view of.
    const { file, created } = withOne();
    const held = addToCollection(file, created.id, { kind: "character", id: "basil-1" });
    expect(deleteCollection(held, created.id).collections).toHaveLength(0);
  });
});

describe("resolveCollection", () => {
  const live = [
    { kind: "character", id: "basil-1", name: "Basil" },
    { kind: "preset", id: "clean", name: "Clean" },
  ];

  test("members come back in the order they were added", () => {
    /**
     * Sorting by name would throw away the one thing a hand-built collection carries that a search
     * result does not: the order somebody chose.
     */
    const { file, created } = withOne();
    let held = addToCollection(file, created.id, { kind: "preset", id: "clean" });
    held = addToCollection(held, created.id, { kind: "character", id: "basil-1" });
    const got = resolveCollection(held.collections[0]!, live);
    expect(got.present.map((p) => p.id)).toEqual(["clean", "basil-1"]);
  });

  test("A DELETED PIECE IS REPORTED MISSING, NOT SILENTLY DROPPED", () => {
    /**
     * The failure this feature was always going to have: pieces are deleted and renamed by tools
     * that know nothing about collections. A list that quietly shrinks by one looks like the app
     * lost something, and only the person knows whether that piece went on purpose.
     */
    const { file, created } = withOne();
    let held = addToCollection(file, created.id, { kind: "character", id: "basil-1" });
    held = addToCollection(held, created.id, { kind: "character", id: "gone-forever" });
    const got = resolveCollection(held.collections[0]!, live);
    expect(got.present.map((p) => p.id)).toEqual(["basil-1"]);
    expect(got.missing).toEqual([{ kind: "character", id: "gone-forever" }]);
  });
});

describe("parseCollections", () => {
  test("a missing or nonsense file reads as no collections", () => {
    expect(parseCollections(null)).toEqual(EMPTY_COLLECTIONS);
    expect(parseCollections("nope")).toEqual(EMPTY_COLLECTIONS);
    expect(parseCollections({})).toEqual(EMPTY_COLLECTIONS);
  });

  test("ONE BAD COLLECTION DOES NOT TAKE THE OTHERS DOWN", () => {
    // Fail-closed per entry, the same rule parseSettings follows. A file hand-edited into nonsense
    // in one place must not cost somebody the other eleven groupings.
    const got = parseCollections({
      collections: [
        { id: "good", name: "Good", members: [] },
        { id: "", name: "No id", members: [] },
        { name: "No id field" },
        { id: "also-good", name: "Also Good", members: [] },
      ],
    });
    expect(got.collections.map((c) => c.id)).toEqual(["good", "also-good"]);
  });

  test("a malformed member is dropped and the rest of the collection survives", () => {
    const got = parseCollections({
      collections: [{
        id: "c", name: "C",
        members: [{ kind: "character", id: "a" }, { kind: "character" }, null, { kind: "preset", id: "b" }],
      }],
    });
    expect(got.collections[0]?.members).toEqual([
      { kind: "character", id: "a" },
      { kind: "preset", id: "b" },
    ]);
  });

  test("A DUPLICATE ID IS RESOLVED, NOT KEPT", () => {
    // Two collections with one id makes `@collection:x` ambiguous forever after.
    const got = parseCollections({
      collections: [
        { id: "x", name: "First", members: [] },
        { id: "x", name: "Second", members: [] },
      ],
    });
    expect(got.collections).toHaveLength(1);
    expect(got.collections[0]?.name).toBe("First");
  });

  test("a duplicate member survives parsing exactly once", () => {
    const got = parseCollections({
      collections: [{
        id: "c", name: "C",
        members: [{ kind: "character", id: "a" }, { kind: "character", id: "a" }],
      }],
    });
    expect(got.collections[0]?.members).toHaveLength(1);
  });
});
