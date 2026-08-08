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
  /** rough size of everything written on the piece (chars/4, the shared convention) */
  tokens?: number;
  /** the piece's own content tags (character discovery tags, book/persona tags) */
  tags?: string[];
  /** filled core fields as "n/m" (characters: the nine card fields); absent where meaningless */
  filled?: string;
}

export interface DeckViewContext {
  /** the active deck's pieces, already filtered by kind */
  entities: StudioEntitySummary[];
  deck: DeckMeta;
  /** "kind:id" keys of pieces already OPEN on the Workbench (a pure annotation - the tick) */
  open: Set<string>;
  /** "kind:id" keys of pieces STAGED for a batch send (render them picked) */
  selected: Set<string>;
  /**
   * Tap a piece: toggle it in the staging selection (already-open pieces just note, no toggle).
   *
   * `mods` carries what was held down, so shift extends a range from the last click and ctrl/cmd
   * adds one without disturbing the rest. A view that does not read modifiers passes nothing and
   * keeps the plain toggle it always had.
   */
  onPiece(e: StudioEntitySummary, mods?: { shift: boolean; meta: boolean }): void;
  /**
   * A box was dragged over the shelf. Optional: a view without a draggable surface never calls it.
   *
   * The cards arrive MEASURED, because only the view knows where it drew them. What that means for
   * the selection is decided in select-core.ts.
   */
  onSweep?(
    cards: readonly { key: string; box: { left: number; top: number; right: number; bottom: number } }[],
    box: { left: number; top: number; right: number; bottom: number },
    additive: boolean,
  ): void;
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
  /**
   * Optional lorebook shelf ops (vs-lore-shelf). Absent on non-lore decks / older callers.
   * Views must deny by absence - never require this bag.
   */
  loreShelf?: {
    /** book-level on/off; undefined = treat as on */
    enabledOf(e: StudioEntitySummary): boolean;
    entryCountOf(e: StudioEntitySummary): number | undefined;
    onToggleEnabled(e: StudioEntitySummary, on: boolean): void;
    onSplit(e: StudioEntitySummary): void;
    onMerge(into: StudioEntitySummary, from: StudioEntitySummary): void;
    onDuplicate(e: StudioEntitySummary): void;
  };
  /**
   * Optional regex-set shelf ops (vs-regex-shelf). Absent on non-regex decks / older callers.
   * Views must deny by absence - never require this bag.
   */
  regexShelf?: {
    /** set-level on/off; undefined = treat as on */
    enabledOf(e: StudioEntitySummary): boolean;
    /** total rules in the set */
    ruleCountOf(e: StudioEntitySummary): number | undefined;
    /** rules whose own switch is on */
    enabledRuleCountOf(e: StudioEntitySummary): number | undefined;
    /** computed plain-language one-liner for the whole set (engine truth, no model call) */
    doesWhatOf(e: StudioEntitySummary): string | undefined;
    /** count of rules Health flagged slow; undefined until R4 wires Health (the chip placeholder) */
    slowCountOf(e: StudioEntitySummary): number | undefined;
    onToggleEnabled(e: StudioEntitySummary, on: boolean): void;
    onSplit(e: StudioEntitySummary): void;
    onMerge(into: StudioEntitySummary, from: StudioEntitySummary): void;
    onDuplicate(e: StudioEntitySummary): void;
    /** create a blank set and open it (the shelf's "+ New set" card) */
    onNew(): void;
  };
  /**
   * Optional persona shelf ops (vs-persona-editor wire 2). Absent on non-persona decks / older
   * callers; views deny by absence.
   */
  personaShelf?: {
    /** the library BRIEF (its one honest home - never the injected content) */
    briefOf(e: StudioEntitySummary): string | undefined;
    pronounsOf(e: StudioEntitySummary): string | undefined;
    sectionCountOf(e: StudioEntitySummary): number | undefined;
    hasLorebookOf(e: StudioEntitySummary): boolean;
    /** the studio's default persona id ("" = none) */
    defaultId: string;
    /** create a blank persona and open it */
    onNew(): void;
  };
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
  /** decks this view applies to (kinds); absent = every deck. The toolbar filters by the active
   * deck so a kind-specific shelf (regex sets) never appears on, or renders the pieces of, another
   * deck. */
  kinds?: readonly string[];
  /** render the deck; each piece attaches its own right-click target via useContextMenu */
  Component: (props: { ctx: DeckViewContext }) => ReactNode;
}

export const pieceKey = (e: StudioEntitySummary): string => `${e.kind}:${e.id}`;
