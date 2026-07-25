/** Pure studio-shape to empty-composer suggestion mapping. */
import type { DeckCount, EntitySummary } from "../../../bridge";
import { truncateGraphemes } from "../../../_shared/graphemes";

const cleanName = (name: string): string =>
  truncateGraphemes(name.replace(/\s+/g, " ").trim(), 28);

const countOf = (decks: readonly DeckCount[], kind: DeckCount["kind"]): number =>
  decks.find((deck) => deck.kind === kind)?.count ?? 0;

export function draftSuggestion(
  decks: readonly DeckCount[],
  pieces: readonly EntitySummary[],
): string {
  if (countOf(decks, "lorebook") > 0) return "try: which lorebook entries never fire?";
  if (countOf(decks, "regex") > 0) return "try: which regex scripts overlap?";

  const characters = pieces
    .filter((piece) => piece.kind === "character")
    .map((piece) => cleanName(piece.name))
    .filter(Boolean);
  if (characters.length > 1) return `try: compare ${characters[0]} and ${characters[1]}`;
  if (characters.length === 1) return `try: what should I improve about ${characters[0]}?`;

  if (countOf(decks, "persona") > 0) return "try: check my personas for gaps";
  if (countOf(decks, "preset") > 0) return "try: compare my model presets";
  if (countOf(decks, "pack") > 0) return "try: what is inside my packs?";

  const first = pieces.map((piece) => cleanName(piece.name)).find(Boolean);
  return first ? `try: inspect ${first} for gaps` : "talk to your studio";
}
