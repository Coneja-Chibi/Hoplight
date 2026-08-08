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

/**
 * A real preset's name, escaped rather than typed: the repo's prose gate refuses literal emoji in
 * source, and the decoration is exactly what this test is about.
 */
const MIRROR = "\u{1FA9E}✧˖°";
const decorated = [
  { id: "the-h-t-files-paramnesia-v-4", kind: "preset", name: `${MIRROR}. The H.T. Files - Paramnesia V.4 .${MIRROR}` },
  { id: "hawthorne-roulette-v4", kind: "preset", name: "HawThorne_Roulette_v4" },
];

test("PUNCTUATION IN A NAME DOES NOT HIDE THE PIECE", () => {
  /**
   * Found in a real studio. Typing `@v4` offered every other v4 preset and silently hid the one
   * called "Paramnesia V.4", because "v.4" does not contain "v4". The piece was indexed and on
   * screen in the Library, and unreachable from the composer - which reads as the file missing.
   */
  expect(matchingPieces(decorated, "@v4").map((p) => p.id))
    .toContain("the-h-t-files-paramnesia-v-4");
});

test("nor does the decoration people put around their own names", () => {
  // Nobody is going to type a mirror to reach their own preset.
  expect(matchingPieces(decorated, "@paramnesiav4").map((p) => p.id))
    .toEqual(["the-h-t-files-paramnesia-v-4"]);
  expect(matchingPieces(decorated, "@htfiles")).toHaveLength(1);
});

test("THE FORGIVING PASS IS ADDED, NOT SUBSTITUTED", () => {
  // Everything that matched before still matches, exactly as it did.
  expect(matchingPieces(pieces, "@ba")).toEqual([pieces[0]!]);
  expect(matchingPieces(decorated, "@v4").map((p) => p.id)).toContain("hawthorne-roulette-v4");
});

test("A QUERY OF PURE PUNCTUATION MATCHES NOTHING EXTRA", () => {
  // Stripped to nothing, "includes" would be true of every piece in the studio.
  expect(matchingPieces(decorated, "@...")).toEqual([]);
});
