/**
 * gated-dispatch: the one impure edge of the safety cluster. It wraps a DispatchFn so every tool call is
 * classified, decided, and then run, held for confirmation, or blocked, fail-closed. The pure loop never
 * learns about permissions. Every deny path returns a tolerant, readable DispatchResult and NEVER calls
 * the inner dispatch; any throw (a broken decision, a missing or rejecting confirm seam) falls to deny.
 * Abort slams the brakes for the rest of the turn. One gated dispatch is built per turn, so its closure
 * flag (turnLocked) is the turn's memory.
 */
import type { DispatchFn, DispatchResult } from "../../loop/loop-core";
import type { ModelToolCall } from "../../providers/provider";
import { resolveAccess } from "./access";
import { classifyRisk, type RiskVerdict } from "./risk";
import { decideGate, type GateDecision, type GateState } from "./gate-core";
import { applyGateChoice, type GateChoice } from "./permission-mode";
import { summarizePeek, type PeekView } from "./peek-core";

/** What the confirm surface is handed: the tool name, its redacted peek, and the risk verdict. */
export interface GateRequest {
  readonly name: string;
  readonly peek: PeekView;
  readonly verdict: RiskVerdict;
}

/** The seam the shell reaches the outside through: the per-turn policy snapshot, the confirm pause, and
 *  an optional bubble so the app can persist grants/mode across turns. */
export interface GateSeam {
  readonly state: GateState;
  readonly requestConfirm?: (req: GateRequest) => Promise<GateChoice>;
  readonly onChoice?: (choice: GateChoice, name: string) => void;
}

const MAX_ROUNDS = 3; // bounded re-decision so an allow-session / set-mode can never loop forever

const LOCKED_FALLBACK: GateState = { mode: "locked", grants: new Set<string>() };

/** A blocked call the model can read and recover from. The inner dispatch is never reached. */
const blocked = (name: string, reason: string): DispatchResult => ({
  summary: `${name || "tool"}: blocked`,
  output: `Blocked by the safety gate: ${reason}. Do not retry this call; ask the user to allow it.`,
});

/** A structurally-valid GateState from the seam, or fall back to locked (fail-closed) if it is missing. */
const validState = (s: unknown): s is GateState =>
  !!s
  && typeof (s as GateState).mode === "string"
  && typeof (s as { grants?: { has?: unknown } }).grants?.has === "function";

/** Wrap a DispatchFn in the gate. Returns a DispatchFn with the same shape the loop already expects. */
export function makeGatedDispatch(inner: DispatchFn, seam: GateSeam): DispatchFn {
  let turnLocked = false; // an abort this turn denies every later risky call without re-asking

  return async (call: ModelToolCall): Promise<DispatchResult> => {
    const name = typeof call?.name === "string" ? call.name : "";
    const access = resolveAccess(name);
    const verdict = classifyRisk(access, call?.args, name);

    const base = validState(seam?.state) ? seam.state : LOCKED_FALLBACK;
    let working: GateState = turnLocked ? { ...base, mode: "locked" } : base;

    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      let decision: GateDecision;
      try {
        decision = decideGate(name, verdict, working);
      } catch {
        return blocked(name, "the permission decision failed");
      }

      if (decision === "allow") return inner(call);
      if (decision === "deny") return blocked(name, verdict.reason);

      // confirm: hold the loop on the seam. A missing confirm seam is fail-closed.
      if (!seam || typeof seam.requestConfirm !== "function") {
        return blocked(name, "confirmation is unavailable");
      }

      let choice: GateChoice;
      try {
        const peek = summarizePeek(name, call?.args, verdict);
        choice = await seam.requestConfirm({ name, peek, verdict });
      } catch {
        return blocked(name, "the confirmation was declined");
      }
      seam.onChoice?.(choice, name);

      const type = (choice as { type?: unknown } | null)?.type;
      if (type === "allow-once") return inner(call);
      if (type === "deny") return blocked(name, verdict.reason);
      if (type === "abort") {
        turnLocked = true;
        return blocked(name, "aborted by the user");
      }
      // allow-session / set-mode: evolve the working policy and re-decide (bounded by MAX_ROUNDS).
      working = applyGateChoice(working, choice, name);
    }

    return blocked(name, "too many confirmation rounds");
  };
}
