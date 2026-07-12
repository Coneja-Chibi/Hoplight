/**
 * Deck-view registry - the ONE seam for drop-in views. A browser bundle cannot glob the
 * filesystem, so adding a view = one file in this folder + one import line here (order comes
 * from the view itself; nothing else is edited anywhere).
 *
 * A view may declare `kinds` to scope itself to certain decks (the regex shelf is regex-only);
 * `deckViews(kind)` filters the toolbar to what applies, and `deckView(id, kind)` falls back to
 * the first applicable view when the stored pref does not apply to the active deck.
 */
import type { DeckView } from "../view-contract";
import grid from "./grid";
import showcase from "./showcase";
import list from "./list";
import shelf from "./shelf";
import regexShelf from "./regex-shelf";

const VIEWS: DeckView[] = [grid, showcase, list, shelf, regexShelf];

const applies = (v: DeckView, kind?: string): boolean =>
  !v.kinds || kind === undefined || v.kinds.includes(kind);

/** Views for a deck kind (absent kind = every view), in toolbar order. */
export const deckViews = (kind?: string): DeckView[] =>
  VIEWS.filter((v) => applies(v, kind)).sort((a, b) => a.order - b.order);

/** The stored view when it applies to this deck, else the first applicable view. */
export const deckView = (id: unknown, kind?: string): DeckView => {
  const found = VIEWS.find((v) => v.id === id);
  if (found && applies(found, kind)) return found;
  return deckViews(kind)[0]!;
};
