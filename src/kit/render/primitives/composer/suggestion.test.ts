/** Proves the empty-composer suggestion reflects the studio without becoming user text. */
import { expect, test } from "bun:test";
import type { DeckCount, EntitySummary } from "../../../bridge";
import { draftSuggestion } from "./suggestion";

const deck = (kind: DeckCount["kind"], count: number): DeckCount => ({
  kind,
  count,
  label: kind,
});

test("keeps the neutral invitation for an empty studio", () => {
  expect(draftSuggestion([], [])).toBe("talk to your studio");
});

test("suggests a relevant audit when the studio has lorebooks", () => {
  expect(draftSuggestion([deck("lorebook", 2)], [])).toBe(
    "try: which lorebook entries never fire?",
  );
});

test("uses character names for a concrete comparison", () => {
  const pieces: EntitySummary[] = [
    { id: "basil", kind: "character", name: "Basil" },
    { id: "cedric", kind: "character", name: "Cedric" },
  ];
  expect(draftSuggestion([deck("character", 2)], pieces)).toBe(
    "try: compare Basil and Cedric",
  );
});
