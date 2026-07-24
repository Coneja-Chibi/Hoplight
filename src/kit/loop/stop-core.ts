/**
 * Pure stop conditions for the agent loop: when to end a turn regardless of what the model wants.
 * A cap on steps prevents runaways; a repeated identical tool call means the model is stuck. Pure,
 * so it is tested directly (stop-core.test.ts).
 */

export interface StopState {
  /** How many model round-trips have happened this turn. */
  step: number;
  /** Hard cap on round-trips per turn. */
  maxSteps: number;
  /** The last few tool-call keys ("name:argsJson"), oldest to newest. */
  recentCallKeys: readonly string[];
}

const STUCK_RUN = 3;

/** A human reason to stop, or null to keep going. */
export function stopReason(state: StopState): string | null {
  if (state.step >= state.maxSteps) {
    return `reached the ${state.maxSteps}-step limit for one turn`;
  }
  const keys = state.recentCallKeys;
  if (keys.length >= STUCK_RUN) {
    const tail = keys.slice(-STUCK_RUN);
    if (tail.every((key) => key === tail[0])) {
      return "the same tool was called three times with no new result";
    }
  }
  return null;
}

/** Stable key for a tool call, so repeated identical calls are detectable. */
export const callKey = (name: string, args: unknown): string => `${name}:${JSON.stringify(args ?? null)}`;
