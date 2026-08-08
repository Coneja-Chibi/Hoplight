/**
 * Questions the agent is holding, waiting for somebody to answer in a browser.
 *
 * THE PIECE THAT MAKES THE GATE REACHABLE AT ALL. Kit's gate seam is
 * `requestConfirm: (req) => Promise<GateChoice>`, and it BLOCKS the dispatch loop until a human
 * answers. Inside Kit that works because the loop and the keyboard are in one process. Here the loop
 * runs in the loopback server and the person is in a browser, so the promise has to be parked
 * somewhere a second HTTP request can find it and resolve it. That is this file, and without it the
 * window can never have tools no matter how many are wired up.
 *
 * IT FAILS CLOSED, EVERY WAY IT CAN END. A question nobody answers times out to `deny`, not to
 * allow. A turn that is abandoned - tab closed, laptop asleep, stream dropped - denies everything it
 * was holding. An id that does not match anything is refused rather than ignored. The whole point of
 * a gate is that silence is not consent.
 */
import type { GateChoice } from "../../kit/tools/safety/permission-mode";

/**
 * How long a question may stand unanswered.
 *
 * Generous, because a person may genuinely be reading a diff, and a gate that expired while
 * somebody was deciding would be its own kind of broken. But not unbounded: an abandoned turn holds
 * a dispatch loop and a provider connection open, and this process is expected to run all day.
 */
const ANSWER_WINDOW_MS = 10 * 60_000;

/** A question in flight. */
interface Waiting {
  readonly turnId: string;
  readonly settle: (choice: GateChoice) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

export interface PendingGates {
  /**
   * Park a question and hand back the promise the dispatch loop will wait on.
   *
   * `id` is what the browser sends back. It is generated here rather than accepted from anywhere:
   * a caller-chosen id could collide with, or deliberately target, another turn's question.
   */
  ask(turnId: string): { id: string; answer: Promise<GateChoice> };
  /** Resolve one question. False when the id is unknown or already settled. */
  answer(id: string, choice: GateChoice): boolean;
  /** Deny everything still open for a turn. Called when its stream ends, however it ended. */
  abandon(turnId: string): number;
  /** For tests and for the route's own sanity checks. */
  size(): number;
}

export function createPendingGates(
  /** Injected so tests are not real-time. */
  now: () => number = Date.now,
): PendingGates {
  const waiting = new Map<string, Waiting>();
  let counter = 0;

  const settleOnce = (id: string, choice: GateChoice): boolean => {
    const entry = waiting.get(id);
    if (!entry) return false;
    waiting.delete(id);
    clearTimeout(entry.timer);
    entry.settle(choice);
    return true;
  };

  return {
    ask(turnId: string): { id: string; answer: Promise<GateChoice> } {
      // Turn-scoped and monotonic. Not random, because it never leaves this process except to the
      // one browser that is already authenticated to it, and a counter is trivially auditable.
      const id = `${turnId}:${String(++counter)}:${String(now())}`;
      const answer = new Promise<GateChoice>((resolve) => {
        const timer = setTimeout(() => {
          // DENY, never allow. Silence is not consent, and an unattended window is exactly the
          // situation where an accidental yes would be least noticed.
          waiting.delete(id);
          resolve({ type: "deny" });
        }, ANSWER_WINDOW_MS);
        // Node keeps the process alive for a pending timer; this one must not hold a shutdown open.
        timer.unref?.();
        waiting.set(id, { turnId, settle: resolve, timer });
      });
      return { id, answer };
    },

    answer(id: string, choice: GateChoice): boolean {
      return settleOnce(id, choice);
    },

    abandon(turnId: string): number {
      let denied = 0;
      // Collected first: settling mutates the map being walked.
      for (const id of [...waiting.keys()]) {
        if (waiting.get(id)?.turnId !== turnId) continue;
        if (settleOnce(id, { type: "deny" })) denied++;
      }
      return denied;
    },

    size: () => waiting.size,
  };
}

/** The one the server uses. The factory stays exported so tests never share state. */
export const pendingGates: PendingGates = createPendingGates();
