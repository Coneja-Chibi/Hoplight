/**
 * The deck-view contract - how the Workbench presents a deck is a DROP-IN MODULE (Chi's
 * modularity policy, 2026-07-05: "grid vs carousel vs list", user-sized art). A view is one file
 * in views/ default-exporting a DeckView; views/registry.ts lists them (one import line per view -
 * the single seam, because a browser bundle cannot glob the filesystem at runtime). The view
 * toolbar, the size control, and persistence all derive from this contract; the workbench names
 * no view.
 */
import type { StudioEntitySummary } from "../../app-contract";
import type { DeckMeta } from "../../_shared/decks";

/** User-pickable art sizes; views map cardW onto their own layout. */
export interface DeckSize {
  id: string;
  label: string;
  /** base card width the view scales from */
  cardW: string;
}

export const DECK_SIZES: DeckSize[] = [
  { id: "s", label: "S", cardW: "5.5rem" },
  { id: "m", label: "M", cardW: "8.5rem" },
  { id: "l", label: "L", cardW: "12rem" },
];

export interface DeckViewContext {
  /** the active deck's pieces, already filtered by kind */
  entities: StudioEntitySummary[];
  deck: DeckMeta;
  size: DeckSize;
  /** "kind:id" keys of pieces currently threaded on the bench (render them cast/marked) */
  threaded: Set<string>;
  /** tap a piece: the workbench threads/unthreads it */
  onPiece(e: StudioEntitySummary): void;
  /** the piece's art url, or null when it carries none (render the initial instead) */
  portraitUrl(e: StudioEntitySummary): string | null;
}

export interface DeckView {
  id: string;
  /** toolbar label ("Grid") */
  label: string;
  /** static first-party icon SVG markup for the toolbar button */
  iconSvg: string;
  /** toolbar ordering */
  order: number;
  /** the view's own css, injected once by the workbench */
  css: string;
  /** render the deck into a fresh element (called on every state change) */
  render(ctx: DeckViewContext): HTMLElement;
}

/** tiny DOM helper shared by views */
export const h = (tag: string, cls?: string, text?: string): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

export const pieceKey = (e: StudioEntitySummary): string => `${e.kind}:${e.id}`;
