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

/** Art size is a continuous user dial (rem), not fixed steps. The workbench publishes the choice
 * as --card-w on the stage; views build their layout from that var so dragging resizes live. */
export const SIZE_RANGE = { min: 4, max: 36, fallback: 8.5 } as const;

/** Clamp any stored/incoming value into the legal size range (fail-closed to the fallback). */
export function clampSize(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : SIZE_RANGE.fallback;
  return Math.min(SIZE_RANGE.max, Math.max(SIZE_RANGE.min, n));
}

/** What a piece says about itself when a view looks closer (showcase); fields absent when unset. */
export interface PiecePeek {
  tagline?: string;
  description?: string;
}

export interface DeckViewContext {
  /** the active deck's pieces, already filtered by kind */
  entities: StudioEntitySummary[];
  deck: DeckMeta;
  /** "kind:id" keys of pieces currently threaded on the bench (render them cast/marked) */
  threaded: Set<string>;
  /** tap a piece: the workbench threads/unthreads it */
  onPiece(e: StudioEntitySummary): void;
  /** the piece's art url, or null when it carries none (render the initial instead) */
  portraitUrl(e: StudioEntitySummary): string | null;
  /** the card-type chip: platform when detected, "Default" for generic cards, plus version
   * ("RoleCall · V3", "Default · V2"); null when the piece has no source (made from scratch) */
  sourceLabel(e: StudioEntitySummary): string | null;
  /** fetch the piece's own words (tagline/description) for close-up views; null on any failure */
  peek(e: StudioEntitySummary): Promise<PiecePeek | null>;
  /** ask the workbench to re-render (a view changed its own internal state, e.g. showcase focus) */
  refresh(): void;
  /** mark an element as the piece's right-click target (the shell renders the menu) */
  menu(el: HTMLElement, e: StudioEntitySummary): void;
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
