/**
 * That a collection can be `@`-mentioned WITHOUT a second mention grammar.
 *
 * The whole design of the feature on this side rests on one claim: Kit's matcher and marker builder
 * work in terms of a kind and an id, so a collection offered as `{kind: "collection", id, name}`
 * needs nothing taught to them. If that claim is wrong, the honest fix is a change inside
 * mention-menu-core with both composers behind it - never a second matcher living here, which is how
 * the terminal and the window would start disagreeing about what a given `@` meant.
 *
 * So these tests drive KIT'S CORE directly with a collection row. They fail the moment the claim
 * stops holding, which is the only warning that matters.
 */
import { describe, expect, test } from "bun:test";
import {
  applyMention,
  matchingPieces,
} from "../../kit/render/primitives/composer/mention-menu-core";
import { COLLECTION_KIND } from "../../studio/collections-shape";
import type { EntitySummary } from "../../kit/bridge";

const CAST: EntitySummary = { kind: COLLECTION_KIND, id: "the-cast", name: "The Cast" };
const ROWS: EntitySummary[] = [
  CAST,
  { kind: "character", id: "basil-1", name: "Basil" },
  { kind: "preset", id: "clean", name: "Clean" },
];

describe("collections in the mention picker", () => {
  test("a collection matches on its name like any other row", () => {
    expect(matchingPieces(ROWS, "@cast").map((r) => r.id)).toEqual(["the-cast"]);
  });

  test("TYPING THE WORD OFFERS EVERY COLLECTION", () => {
    // `@collection` is how somebody who does not remember a name finds the list. The core already
    // matches on kind prefix, which is exactly this.
    expect(matchingPieces(ROWS, "@collection").map((r) => r.id)).toEqual(["the-cast"]);
  });

  test("PICKING ONE WRITES THE MARKER THE AGENT IS TOLD ABOUT", () => {
    /**
     * `@collection:the-cast` is the string the system prompt explains and studio_collections takes
     * as its id. If this drifted, the marker would be written in one spelling and read in another
     * and the agent would answer about nothing.
     */
    expect(applyMention("look at @cas", CAST)).toBe("look at @collection:the-cast ");
  });

  test("a finished marker closes the menu rather than matching again", () => {
    // Same rule as pieces: once the colon is there the mention is done being typed.
    expect(matchingPieces(ROWS, "@collection:the-cast")).toEqual([]);
  });

  test("pieces and collections share one list without shadowing each other", () => {
    const both = matchingPieces([...ROWS, { kind: COLLECTION_KIND, id: "basil-group", name: "Basil" }], "@basil");
    expect(both.map((r) => `${r.kind}:${r.id}`).sort())
      .toEqual(["character:basil-1", "collection:basil-group"]);
  });
});
