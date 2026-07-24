/**
 * gate-core: the pure permission decision. Given a risk verdict and the standing policy (mode + session
 * grants), decide allow / confirm / deny. Fail-closed: the danger floor (unknown/exec) is never returned
 * as allow without a live confirm, in any mode, and is never covered by a session grant. Exhaustive over
 * PermissionMode with assertNever; total for typed input. The impure gated-dispatch shell turns any throw
 * here into a deny, so a broken policy can never open the gate.
 */
import { assertNever } from "./assert-never";
import type { RiskVerdict, ToolAccess } from "./risk";

export type PermissionMode = "guarded" | "autopilot" | "locked";
export type GateDecision = "allow" | "confirm" | "deny";

/** The standing policy the decision reads and the reducer evolves. grants are session-remembered allows,
 *  keyed by tool name. Defined in this (lowest) module so the decision and the reducer share one shape. */
export interface GateState {
  readonly mode: PermissionMode;
  readonly grants: ReadonlySet<string>;
}

/** The hard floor: accesses that are never auto-allowed and never grantable, in any mode. Exported so
 *  the confirm surface can hide "allow all session" for a floor tool without redefining the set. */
export const isFloor = (access: ToolAccess): boolean => access === "unknown" || access === "exec";

/** Decide one dispatch under the current policy. Exhaustive over mode; the floor holds everywhere. */
export function decideGate(name: string, verdict: RiskVerdict, state: GateState): GateDecision {
  const granted = state.grants.has(name) && !isFloor(verdict.access);
  switch (state.mode) {
    case "locked":
      return verdict.level === "safe" ? "allow" : "deny";
    case "guarded":
      if (verdict.level === "safe") return "allow";
      return granted ? "allow" : "confirm";
    case "autopilot":
      if (verdict.level === "safe" || verdict.level === "caution") return "allow";
      return granted ? "allow" : "confirm";
    default:
      return assertNever("decideGate", state.mode);
  }
}
