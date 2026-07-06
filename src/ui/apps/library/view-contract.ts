/**
 * The deck-view contract (CONTRACT V2) - how a deck is presented (grid / showcase / list,
 * user-sized art) is a DROP-IN MODULE. A view is one file in views/ default-exporting a DeckView;
 * views/registry.ts lists them (one import line per view - the single seam, because a browser
 * bundle cannot glob the filesystem at runtime). The view toolbar, the size control, and
 * persistence all derive from this contract; the library names no view.
 */
import type { ReactNode } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
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
  /** "kind:id" keys of pieces already OPEN on the Workbench (a pure annotation - the tick) */
  open: Set<string>;
  /** "kind:id" keys of pieces STAGED for a batch send (render them picked) */
  selected: Set<string>;
  /** tap a piece: toggle it in the staging selection (already-open pieces just note, no toggle) */
  onPiece(e: StudioEntitySummary): void;
  /** the shell's menu door threaded through, so views never import shell modules (one-store law:
   * a per-bundle copy of the store would be a second, invisible menu universe) */
  menus: AppContext["menus"];
  /** the piece's art url, or null when it carries none (render the initial instead) */
  portraitUrl(e: StudioEntitySummary): string | null;
  /** the card-type chip: platform when detected, "Default" for generic cards, plus version
   * ("RoleCall · V3", "Default · V2"); null when the piece has no source (made from scratch) */
  sourceLabel(e: StudioEntitySummary): string | null;
  /** fetch the piece's own words (tagline/description) for close-up views; null on any failure */
  peek(e: StudioEntitySummary): Promise<PiecePeek | null>;
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
  /** render the deck; each piece attaches its own right-click target via useContextMenu */
  Component: (props: { ctx: DeckViewContext }) => ReactNode;
}

export const pieceKey = (e: StudioEntitySummary): string => `${e.kind}:${e.id}`;
