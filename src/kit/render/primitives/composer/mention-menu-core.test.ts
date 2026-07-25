/** Verifies composer mention discovery, filtering, and stable marker insertion. */
import { expect, test } from "bun:test";
import { applyMention, matchingPieces, mentionDraft } from "./mention-menu-core";

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
