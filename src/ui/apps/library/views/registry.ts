/**
 * Deck-view registry - the ONE seam for drop-in views. A browser bundle cannot glob the
 * filesystem, so adding a view = one file in this folder + one import line here (order comes
 * from the view itself; nothing else is edited anywhere).
 */
import type { DeckView } from "../view-contract";
import grid from "./grid";
import showcase from "./showcase";
import list from "./list";

const VIEWS: DeckView[] = [grid, showcase, list];

export const deckViews = (): DeckView[] => [...VIEWS].sort((a, b) => a.order - b.order);

export const deckView = (id: unknown): DeckView =>
  VIEWS.find((v) => v.id === id) ?? deckViews()[0]!;
