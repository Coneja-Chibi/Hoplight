/**
 * How often this window may spend money.
 *
 * THE PER-REQUEST CAPS DO NOT BOUND THE THREAT THEIR OWN COMMENT NAMES. `MAX_MESSAGES` and
 * `MAX_CHARS` limit one turn; the failure they were written for - "a runaway loop in the page" -
 * makes MANY small turns, each perfectly legal. The only throttle was a ref inside one React hook,
 * which is client-side, per-instance, and bypassed by any same-origin fetch loop.
 *
 * So the limit lives on the server, where a bug in the page cannot reach it. Two rules, because
 * they catch different failures: a BURST cap for a loop that fires as fast as it can, and a
 * CONCURRENCY cap because each turn holds a provider connection open for up to five minutes and
 * nothing else stops ten of them existing at once.
 *
 * Deliberately not a per-key spend ledger. That is a real thing to want and a much larger one; this
 * is the cheap bound that turns an infinite loop into a bounded annoyance.
 */

/** Turns allowed to start in a window. Generous for a person, hopeless for a loop. */
const BURST = 12;
const WINDOW_MS = 60_000;
/** Turns that may be in flight at once. A person asks one thing at a time. */
const MAX_IN_FLIGHT = 3;

export interface TurnLimit {
  /** Take a slot, or say why not. Release the returned function when the turn ends. */
  start(): { ok: true; release: () => void } | { ok: false; why: string; retryAfter: number };
  /** For tests. */
  inFlight(): number;
}

export function createTurnLimit(now: () => number = Date.now): TurnLimit {
  /** Start times inside the current window. */
  let recent: number[] = [];
  let running = 0;

  return {
    start() {
      const at = now();
      recent = recent.filter((t) => at - t < WINDOW_MS);

      if (running >= MAX_IN_FLIGHT) {
        return {
          ok: false,
          why: `Already running ${String(running)} turns. Wait for one to finish.`,
          retryAfter: 5,
        };
      }
      if (recent.length >= BURST) {
        const oldest = recent[0] ?? at;
        const wait = Math.max(1, Math.ceil((WINDOW_MS - (at - oldest)) / 1000));
        return {
          ok: false,
          why: `Too many turns in the last minute (${String(BURST)}). This is usually a stuck page.`,
          retryAfter: wait,
        };
      }

      recent.push(at);
      running++;
      /** Idempotent: a turn that ends twice - abort then finally - must not free two slots. */
      let freed = false;
      return {
        ok: true,
        release: () => {
          if (freed) return;
          freed = true;
          running--;
        },
      };
    },
    inFlight: () => running,
  };
}

/** The one the routes use. The factory stays exported so tests never share state. */
export const turnLimit: TurnLimit = createTurnLimit();
