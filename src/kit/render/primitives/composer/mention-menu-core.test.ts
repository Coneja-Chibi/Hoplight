/** Verifies composer mention discovery, filtering, and stable marker insertion. */
import { expect, test } from "bun:test";
import { applyMention, matchingPieces, mentionDraft, mentionRows } from "./mention-menu-core";

const pieces = [
  { id: "basil-1", kind: "character", name: "Basil" },
  { id: "half-moon", kind: "lorebook", name: "Half-Moon" },
];

test("finds the trailing mention query and filters by piece name", () => {
  expect(mentionDraft("please ask @ba")).toBe("@ba");
  expect(matchingPieces(pieces, "@ba")).toEqual([pieces[0]!]);
});

test("inserts the canonical marker without disturbing earlier prose", () => {
  expect(applyMention("please ask @ba", pieces[0]!)).toBe(
    "please ask @character:basil-1 ",
  );
});

test("closed markers and ordinary at signs do not open the menu", () => {
  expect(mentionDraft("mail a@b.com")).toBe("");
  expect(matchingPieces(pieces, "@character:basil-1")).toEqual([]);
});

const groups = [{ id: "the-cast", kind: "collection", name: "The Cast" }];

test("mentionRows offers the person's groups ahead of their pieces", () => {
  expect(mentionRows(pieces, groups)).toEqual([groups[0]!, ...pieces]);
});

test("A STUDIO WITH NO GROUPS HANDS BACK THE PIECES UNTOUCHED", () => {
  // Identity, not a copy: this runs on every keystroke the composer sees.
  expect(mentionRows(pieces, [])).toBe(pieces);
});

test("a group is matched and marked like any other row", () => {
  expect(matchingPieces(mentionRows(pieces, groups), "@cas")).toEqual([groups[0]!]);
  expect(applyMention("look at @cas", groups[0]!)).toBe("look at @collection:the-cast ");
});
