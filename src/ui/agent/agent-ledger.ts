/**
 * What has left this machine from the window, so `/privacy` can answer honestly.
 *
 * IT DID NOT EXIST, AND THAT WAS THE PROBLEM. The terminal records one entry per provider call and
 * `/privacy` reads it back; the window streamed the same `usage` frames and dropped them. Running
 * the command against nothing would have printed "Nothing has left this machine yet" after a
 * conversation that spent real tokens - a false receipt, in the one readout whose whole value is
 * that it cannot overstate or understate.
 *
 * KIT'S OWN LEDGER, not a second one. `recordEgress` and `formatLedger` are the same pure functions
 * the terminal uses, so the two readouts agree about what a send looks like.
 *
 * "THIS SESSION" MEANS THIS SERVER PROCESS. The window's transcript lives in sessionStorage and the
 * ledger lives here, so reloading the page keeps the receipt while quitting the app clears it. That
 * is the honest boundary: the sends happened from this process, and it is this process that watched
 * them happen.
 */
import { EMPTY_LEDGER, recordEgress, type EgressLedger } from "../../kit/providers/egress-ledger";

let ledger: EgressLedger = EMPTY_LEDGER;

/** Record one provider call. Called from the turn stream's `usage` frame, which is one send. */
export function noteEgress(entry: { provider: string; input: number; output: number }): void {
  ledger = recordEgress(ledger, { at: Date.now(), ...entry });
}

/** The ledger as it stands. Read by `/privacy` through the command context. */
export function readEgress(): EgressLedger {
  return ledger;
}

/** For tests, which must not inherit another test's sends. */
export function resetEgress(): void {
  ledger = EMPTY_LEDGER;
}
