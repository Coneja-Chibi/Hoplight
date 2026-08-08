/**
 * What the Library tells the agent window about itself.
 *
 * Pure, and separate from the room, because this is the text a model reads before it answers a
 * question about somebody's studio. A wrong count or a missing "this listing may be stale" is a
 * confidently wrong answer with nothing to trace it back to, so it is worth being able to check
 * without a browser.
 */
import { useEffect, useRef } from "react";
import type { AgentState, AgentSurfaceSpec } from "../../agent/surface";
import { useStudioChanges } from "../../agent/use-studio-changes";
import type { AppContext, StudioDamagedEntry, StudioEntitySummary } from "../../app-contract";

/**
 * The static half, which the manifest carries.
 *
 * Beside the live half on purpose: the description and the state it describes drift apart the
 * moment they live in different files, and this room's whole job is being accurate about what is
 * in somebody's studio.
 */
export const LIBRARY_AGENT_SURFACE: AgentSurfaceSpec = {
  describe:
    "Every piece in the studio, sorted into decks, plus anything on disk that would not open.",
  actions: [
    {
      id: "open-piece",
      label: "Open a piece",
      describe: "Put a piece on the Workbench so it can be read or edited.",
    },
    {
      id: "explain-unreadable",
      label: "Explain an unreadable file",
      describe: "Say why a file in the studio folder did not open and what would actually fix it.",
    },
  ],
};

export function libraryAgentState(input: {
  /** The deck's plural display name ("Characters"). */
  readonly deck: string;
  /** The pieces on the shelf being looked at. */
  readonly inDeck: readonly StudioEntitySummary[];
  /** Every piece in the studio, for the total. */
  readonly total: number;
  readonly damaged: readonly StudioDamagedEntry[];
  /** Keys of pieces the user has staged. */
  readonly staged: ReadonlySet<string>;
  /** The studio could not be reached, which is NOT the same as an empty studio. */
  readonly loadFailed: boolean;
}): AgentState {
  const notes: string[] = [];

  /**
   * SAID FIRST, because everything after it is unreliable. An agent that read an empty listing as
   * "your studio is empty" when the truth was "the server did not answer" would be telling somebody
   * their work is gone.
   */
  if (input.loadFailed) {
    notes.push("The studio could not be reached, so this listing may be empty or out of date.");
  }

  notes.push(`The studio holds ${String(input.total)} pieces in total.`);

  /**
   * Named, not counted. These are the single most likely thing to be asked about in this room, and
   * the reason attached to each one is now specific enough to act on.
   */
  if (input.damaged.length > 0) {
    notes.push(
      `${String(input.damaged.length)} file(s) in the studio folder did not open: ` +
        input.damaged.map((d) => `${d.kind}/${d.id}.json (${d.reason})`).join(", "),
    );
  }

  return {
    headline:
      `The ${input.deck} shelf, showing ${String(input.inDeck.length)} of ` +
      `${String(input.total)} pieces in the studio.`,
    /**
     * THE SHELF, NOT THE STUDIO. What is in front of somebody is the deck they are looking at.
     * Handing over all 164 pieces on every screen would bury the answer to "what is this" under a
     * catalogue, and the total is already in the notes where a count belongs.
     */
    items: input.inDeck.map((e) => ({
      kind: e.kind,
      id: e.id,
      name: e.name,
      ...(input.staged.has(`${e.kind}:${e.id}`) ? { focused: true } : {}),
    })),
    notes,
  };
}

/**
 * Publish the shelf, and LEAVE IT PUBLISHED.
 *
 * The effect returns nothing on purpose. It used to return the publish call's own result as a
 * cleanup, which withdrew the snapshot when this room unmounted - and since the shell swaps apps
 * through one slot, opening the agent window is exactly what unmounts this room. The window then
 * read null on the one navigation it exists for. See live-state.ts.
 *
 * The dependency list is compared by VALUE where it can be. `inDeck` is rebuilt on every render of
 * the room, so it is reduced to a fingerprint rather than passed by identity; without that this
 * effect re-ran and republished on every keystroke anywhere in the app.
 */
export function usePublishLibrarySurface(
  ctx: AppContext,
  input: Parameters<typeof libraryAgentState>[0],
): void {
  const { deck, inDeck, total, damaged, staged, loadFailed } = input;
  /** Cheap and stable: what is on the shelf, not the array that happens to hold it this render. */
  const shelfKey = inDeck.map((e) => `${e.kind}:${e.id}`).join(",");
  const damagedKey = damaged.map((d) => `${d.kind}:${d.id}:${d.reason}`).join(",");

  /** What is staged, not how much: swapping one selection for another keeps the size identical. */
  const stagedKey = [...staged].sort().join(",");

  /**
   * `ctx` is held rather than depended on. It is rebuilt on EVERY shell store write - a status-bar
   * message, a workbench tab, a deck chip - and having it in the dependency list meant this effect
   * re-ran during app switches, republishing the outgoing screen under the incoming app's name.
   */
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    ctxRef.current.agent.publish(
      libraryAgentState({ deck, inDeck, total, damaged, staged, loadFailed }),
    );
    // The keys stand in for inDeck, damaged and staged, which are new objects on every render.
    // Comparing those by identity fired this on every keystroke anywhere in the app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, shelfKey, damagedKey, stagedKey, total, loadFailed]);
}

/**
 * Re-read the shelves whenever the studio folder moves, whoever moved it.
 *
 * THE ROOM USED TO ONLY REFRESH AFTER ITS OWN ACTIONS. Import here, delete here, and the list
 * updates; anything else - a file dropped in from Explorer, an edit made in Kit, eventually a write
 * the agent made - left the screen showing a studio that no longer existed until somebody navigated
 * away and back.
 *
 * Version 0 is the initial subscription and is skipped: the room has already loaded by then, and
 * reloading on mount would double every open.
 */
export function useReloadOnStudioChange(reload: () => void): void {
  const { version } = useStudioChanges();
  /**
   * `reload` is held rather than depended on, and this is not a style preference.
   *
   * It is a useCallback over `ctx`, which the shell rebuilds on every store write. With it in the
   * dependency list, the effect re-fired on each rebuild and `version > 0` was still true - so
   * after the first studio change EVER, a deck-chip click or a status-bar update re-read the whole
   * studio. Each read is an inventory plus one sequential request per lorebook, regex set and
   * persona, so a studio with forty lorebooks paid about forty-five round trips for a chip click.
   * It settled rather than looping, which is exactly why nobody would have noticed it as a bug.
   */
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    // Version 0 is the initial subscription; the room has already loaded by then.
    if (version > 0) reloadRef.current();
  }, [version]);
}
