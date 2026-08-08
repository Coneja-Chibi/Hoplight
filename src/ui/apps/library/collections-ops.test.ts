/**
 * The Library's collections logic, without a browser.
 *
 * The renderers hold no decisions worth testing; these three do. The status lines are tested as
 * carefully as the data because they are the only report somebody gets that an edit landed, and a
 * cheerful line that overstates what happened is the kind of lie you only catch by counting.
 */
import { describe, expect, test } from "bun:test";
import {
  attachCollections,
  collectionQuery,
  collectionsBarProps,
  membershipIndex,
  type CollectionsRoom,
} from "./collections-ops";
import type { Collection, CollectionEdit } from "../../../studio/collections-shape";

const cast: Collection = {
  id: "the-cast",
  name: "The Cast",
  members: [{ kind: "character", id: "basil" }, { kind: "character", id: "levi" }],
};
const act: Collection = {
  id: "act-ii",
  name: "Act II",
  members: [{ kind: "character", id: "basil" }, { kind: "preset", id: "clean" }],
};

describe("membershipIndex", () => {
  test("a piece in two groups is listed under both", () => {
    const index = membershipIndex({ collections: [cast, act] });
    expect(index.get("character:basil")).toEqual(["the-cast", "act-ii"]);
    expect(index.get("preset:clean")).toEqual(["act-ii"]);
  });

  test("KIND IS PART OF THE KEY", () => {
    // A preset and a character may share an id; keying on id alone would put one in the other's
    // groups and there is no way to see that on screen.
    const index = membershipIndex({
      collections: [{ id: "c", name: "C", members: [{ kind: "preset", id: "basil" }] }],
    });
    expect(index.get("preset:basil")).toEqual(["c"]);
    expect(index.get("character:basil")).toBeUndefined();
  });
});

describe("attachCollections", () => {
  const pieces = [
    { kind: "character", id: "basil", name: "Basil" },
    { kind: "preset", id: "lonely", name: "Lonely" },
  ];

  test("a piece learns which groups hold it", () => {
    const got = attachCollections(pieces, membershipIndex({ collections: [cast] }));
    expect(got[0]?.collections).toEqual(["the-cast"]);
  });

  test("A PIECE IN NO GROUP IS LEFT EXACTLY AS IT WAS", () => {
    /**
     * Absent rather than empty, and the identity check is the point: search runs on every render
     * over the whole studio, and handing back a fresh object per piece per keystroke would defeat
     * every memo downstream of it.
     */
    const got = attachCollections(pieces, membershipIndex({ collections: [cast] }));
    expect(got[1]).toBe(pieces[1]!);
    expect(got[1]?.collections).toBeUndefined();
  });
});

describe("collectionQuery", () => {
  test("the one spelling the bar writes and the search core reads", () => {
    expect(collectionQuery("the-cast")).toBe("collection:the-cast");
  });
});

/** A room that records what it was asked to do and answers like the server would. */
function fakeRoom(start: Collection[]) {
  const edits: CollectionEdit[] = [];
  let all = start;
  const room: CollectionsRoom = {
    get all() { return all; },
    index: membershipIndex({ collections: start }),
    holding: () => [],
    edit: async (edit) => {
      edits.push(edit);
      if (edit.action === "create") {
        const made = { id: "new-group", name: edit.name, members: [] };
        all = [...all, made];
        return made;
      }
      if (edit.action === "delete") { all = all.filter((c) => c.id !== edit.id); return null; }
      return all.find((c) => c.id === edit.id) ?? null;
    },
  };
  return { room, edits };
}

const build = (over: Partial<Parameters<typeof collectionsBarProps>[0]> = {}) => {
  const said: string[] = [];
  const queries: string[] = [];
  const { room, edits } = fakeRoom([cast]);
  const props = collectionsBarProps({
    room,
    query: "",
    setQuery: (q) => queries.push(q),
    staged: [],
    say: (t) => said.push(t),
    ...over,
  });
  return { props, said, queries, edits };
};

describe("making a collection", () => {
  test("staged pieces go in, and the shelf shows the new group", async () => {
    const staged = [{ kind: "character", id: "basil" }, { kind: "preset", id: "clean" }];
    const { props, said, queries, edits } = build({ staged });
    props.onCreate("Act II");
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    expect(edits[0]).toEqual({ action: "create", name: "Act II" });
    expect(edits.slice(1)).toEqual([
      { action: "add", id: "new-group", ref: staged[0]! },
      { action: "add", id: "new-group", ref: staged[1]! },
    ]);
    expect(queries).toEqual(["collection:new-group"]);
    expect(said[0]).toContain("2 pieces");
  });

  test("AN EMPTY GROUP DOES NOT HIJACK THE SHELF", () => {
    /**
     * Making a group with nothing staged and then being shown an empty shelf reads as the studio
     * having emptied. There is nothing to look at yet, so nothing is filtered.
     */
    const { props, queries } = build({ staged: [] });
    props.onCreate("Later");
    expect(queries).toEqual([]);
  });
});

describe("adding staged pieces to a group", () => {
  test("IT REPORTS WHAT CHANGED, NOT WHAT WAS SENT", async () => {
    /**
     * Adding is idempotent. Three staged pieces against a group already holding two of them is one
     * new member, and "added 3" is a small lie somebody can check by counting the chip.
     */
    const { props, said } = build({
      staged: [{ kind: "character", id: "basil" }, { kind: "character", id: "levi" }, { kind: "preset", id: "clean" }],
    });
    props.onAddStaged("the-cast");
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(said[0]).toContain("added 1 piece");
  });

  test("nothing new says so rather than claiming a change", async () => {
    const { props, said } = build({ staged: [{ kind: "character", id: "basil" }] });
    props.onAddStaged("the-cast");
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(said[0]).toContain("already had it");
  });
});

describe("removing a group", () => {
  test("THE PIECES ARE SAID TO STAY, because that is the question being asked", async () => {
    // A delete button on a thing holding somebody's characters has to answer "what happens to them"
    // before it is pressed, and again after.
    const { props, said } = build();
    props.onDelete(cast);
    await Promise.resolve(); await Promise.resolve();
    expect(said[0]).toContain("2 pieces stayed");
  });

  test("BROWSING THE GROUP THAT JUST WENT CLEARS THE FILTER", async () => {
    /**
     * Otherwise the shelf stays filtered by an id nothing carries, which draws the empty-studio
     * picture over a studio that lost nothing at all.
     */
    const { props, queries } = build({ query: "collection:the-cast" });
    props.onDelete(cast);
    await Promise.resolve(); await Promise.resolve();
    expect(queries).toEqual([""]);
  });

  test("deleting a group somebody is not looking at leaves the query alone", async () => {
    const { props, queries } = build({ query: "kind:preset" });
    props.onDelete(cast);
    await Promise.resolve(); await Promise.resolve();
    expect(queries).toEqual([]);
  });
});
