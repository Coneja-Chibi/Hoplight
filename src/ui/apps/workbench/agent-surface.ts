/**
 * What the Workbench tells the agent window about itself.
 *
 * THE ONE ROOM WHERE WORK CAN BE LOST. Every other screen describes things that are already on disk;
 * this one describes drafts that are not. An agent that answers "sure, close that and open the other
 * one" while three tabs carry unsaved edits is not being unhelpful in the abstract - it is the reason
 * somebody's afternoon is gone. So the unsaved set is not decoration here, it is the point, and it is
 * said twice: once per item as `dirty`, once as a named note, because briefText caps items at twelve
 * and the note is what survives a bench with more tabs than that.
 *
 * Pure builder, separate from the room, because this is the text a model reads before it answers a
 * question about somebody's half-finished work.
 */
import { useEffect, useRef } from "react";
import type { AgentState, AgentSurfaceSpec, SurfaceItem } from "../../agent/surface";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { keyOf, paneKeyOf } from "../../_shared/piece-key";
/**
 * The static half, which the manifest carries.
 *
 * The actions are things a conversation can do. The turn has no tool belt yet (see server-agent.ts,
 * which says so out loud), so naming "save this for me" here would describe a capability nobody has.
 */
export const WORKBENCH_AGENT_SURFACE: AgentSurfaceSpec = {
  describe:
    "The bench where pieces are edited. Open pieces are the tab strip above; one is being edited, " +
    "and any of them may carry edits that are not on disk yet.",
  actions: [
    {
      id: "read-open-piece",
      label: "Read the piece on the bench",
      describe: "Say what the focused piece actually contains, and what a platform would make of it.",
    },
    {
      id: "account-for-unsaved",
      label: "Account for unsaved work",
      describe:
        "Say which open pieces have edits that are not on disk yet, before anything suggests " +
        "closing a tab or leaving this room.",
    },
  ],
};

/**
 * How one open piece reads in the brief.
 *
 * THE SAME BOOK CAN BE OPEN TWICE. A lorebook pinned beside itself on two different entries is two
 * panes of one entity, so without the entry in the name the brief carries two lines that are
 * character-for-character identical except that one says "focused" - and the model has no way to
 * tell which entry either of them is.
 */
function itemFor(
  piece: StudioEntitySummary,
  activeKey: string,
  dirty: ReadonlySet<string>,
): SurfaceItem {
  const entry = piece.params?.focusEntry;
  return {
    kind: piece.kind,
    id: piece.id,
    name: entry ? `${piece.name} (open on entry ${entry})` : piece.name,
    ...(paneKeyOf(piece) === activeKey ? { focused: true } : {}),
    /**
     * DIRTY IS ENTITY-LEVEL, FOCUS IS PANE-LEVEL, and they are different keys on purpose: the shell
     * writes dirtyPieces under keyOf ("kind:id") while a pane is keyOf plus "@entry". Looking dirty
     * up by pane key would have missed every lorebook opened on an entry - which is precisely the
     * piece most likely to be open twice and half-edited.
     */
    ...(dirty.has(keyOf(piece.id, piece.kind)) ? { dirty: true } : {}),
  };
}

export function workbenchAgentState(input: {
  /** Every piece open as a tab, in tab order. */
  readonly pieces: readonly StudioEntitySummary[];
  /** Pane key of the piece whose editor is showing; "" when the bench is clear. */
  readonly activeKey: string;
  /** Pane key of the piece pinned beside it, or "" when the stage is a single pane. */
  readonly besideKey: string;
  /** Entity keys ("kind:id") with edits that are not on disk. */
  readonly dirty: ReadonlySet<string>;
}): AgentState {
  const items = input.pieces.map((p) => itemFor(p, input.activeKey, input.dirty));
  const active = input.pieces.find((p) => paneKeyOf(p) === input.activeKey);
  const beside = input.besideKey ? input.pieces.find((p) => paneKeyOf(p) === input.besideKey) : undefined;
  const unsaved = input.pieces.filter((p) => input.dirty.has(keyOf(p.id, p.kind)));
  const notes: string[] = [];

  /**
   * SAID FIRST, ahead of anything about what is open. It is the one fact on this screen that makes a
   * reasonable-sounding suggestion destructive, and the item list it duplicates gets cut off at
   * twelve entries by briefText - this note does not.
   */
  if (unsaved.length > 0) {
    const names = [...new Set(unsaved.map((p) => p.name))].join(", ");
    notes.push(
      `${String(unsaved.length)} open piece(s) carry unsaved work: ${names}. ` +
        "Those edits are not on disk yet.",
    );
  }

  /**
   * The split is a second thing on screen and `focused` cannot say so - there is one flag and two
   * panes. Overloading it would report two focused pieces and mean neither.
   */
  if (beside) {
    notes.push(
      active
        ? `${beside.name} is pinned beside ${active.name} in a split view; both are on screen.`
        : `${beside.name} is pinned in the second pane.`,
    );
  }

  if (input.pieces.length === 0) {
    notes.push("Pieces arrive here from the Library; nothing can be edited until one is opened.");
  }

  return {
    headline:
      input.pieces.length === 0
        ? "The Workbench, with nothing open."
        : active
          ? `The Workbench, editing ${active.name}, with ${String(input.pieces.length)} piece(s) open.`
          : `The Workbench, ${String(input.pieces.length)} piece(s) open and none of them focused.`,
    items,
    notes,
  };
}

/**
 * Publish the bench, and LEAVE IT PUBLISHED.
 *
 * The effect returns no cleanup, deliberately: the shell swaps apps through one slot, so opening the
 * agent window is exactly what unmounts this room. Withdrawing the snapshot there would blank the
 * window on the one navigation it exists for. See live-state.ts.
 *
 * The dependency list is compared by VALUE. `pieces` is a fresh array on every render of the room
 * (it is a getter over the store), and `dirtyPieces` is a fresh record on every real dirty change,
 * so both are reduced to fingerprints rather than passed by identity.
 */
export function usePublishWorkbenchSurface(
  ctx: AppContext,
  input: {
    readonly pieces: readonly StudioEntitySummary[];
    readonly activeKey: string;
    readonly besideKey: string;
  },
): void {
  const { pieces, activeKey, besideKey } = input;
  /**
   * Read through ctx, NOT by importing the shell store.
   *
   * The store import was refused by the structural guardrail, and rightly: an app bundle carrying
   * its own copy of the store forks the store and React with it. The contract gained
   * workbench.dirty() for this - the reader setDirty never had, and whose absence is what made
   * reaching around the one door look reasonable in the first place.
   *
   * The shell rebuilds ctx on every store write, so a draft going dirty re-renders this room and
   * this call sees the new record. It is a read at render time rather than a subscription.
   */
  const dirtyPieces = ctx.workbench.dirty();
  const dirtyKeys = Object.keys(dirtyPieces).filter((k) => dirtyPieces[k] === true);

  const piecesKey = pieces.map(paneKeyOf).join(",");
  /** Sorted: which pieces are dirty, not the order the record happens to hold them in. */
  const dirtyKey = [...dirtyKeys].sort().join(",");

  /**
   * `ctx` is held rather than depended on. The shell rebuilds it on EVERY store write - a status-bar
   * message, a deck chip, a tab - and having it in the dependency list meant an effect like this one
   * re-ran during app switches, republishing the outgoing screen under the incoming app's name.
   */
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    ctxRef.current.agent.publish(
      workbenchAgentState({ pieces, activeKey, besideKey, dirty: new Set(dirtyKeys) }),
    );
    // piecesKey and dirtyKey stand in for pieces and dirtyKeys, which are new objects on every
    // render. Comparing those by identity republished on every keystroke anywhere in the app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piecesKey, dirtyKey, activeKey, besideKey]);
}
