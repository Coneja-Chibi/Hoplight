/**
 * recall: the composer's history-recall + draft-ghost state machine. Pure core, no I/O, injected text.
 * The "ghost" is just the stash: when you step up into history, whatever you were mid-composing is put
 * aside, and stepping back down past the newest entry restores it verbatim. The ring is bounded and
 * skips empties + exact repeats so it never fills with noise. Every transition returns a whole state,
 * never throws, never mutates its input, the same total-function shape as turn-events.ts.
 */

export interface RecallState {
  /** Submitted lines, oldest first, newest last. Bounded to MAX_RECALL. */
  readonly ring: readonly string[];
  /** Position in the ring while recalling, or null when sitting on the live draft. */
  readonly index: number | null;
  /** The live draft stashed on entry into history (the "ghost"), restored on the way back down. */
  readonly stash: string;
}

const MAX_RECALL = 200;

export const initRecall = (): RecallState => ({ ring: [], index: null, stash: "" });

/** Step to an older entry (the up key at the top of the buffer). Stashes the live draft on entry. */
export const recallPrev = (state: RecallState, liveText: string): { state: RecallState; text: string } => {
  if (state.ring.length === 0) return { state, text: liveText };
  if (state.index === null) {
    const index = state.ring.length - 1;
    return { state: { ...state, index, stash: liveText }, text: state.ring[index]! };
  }
  const index = Math.max(0, state.index - 1);
  return { state: { ...state, index }, text: state.ring[index]! };
};

/** Step to a newer entry (the down key). Past the newest entry, restores the stashed live draft. */
export const recallNext = (state: RecallState): { state: RecallState; text: string } => {
  if (state.index === null) return { state, text: state.stash };
  const next = state.index + 1;
  if (next >= state.ring.length) return { state: { ...state, index: null, stash: "" }, text: state.stash };
  return { state: { ...state, index: next }, text: state.ring[next]! };
};

/** Record a submitted line and return to the live draft. Skips empty and exact-repeat-of-newest. */
export const commit = (state: RecallState, submitted: string): RecallState => {
  const reset = { index: null, stash: "" } as const;
  if (!submitted.trim()) return { ...state, ...reset };
  if (state.ring[state.ring.length - 1] === submitted) return { ...state, ...reset };
  const ring = [...state.ring, submitted].slice(-MAX_RECALL);
  return { ring, ...reset };
};
