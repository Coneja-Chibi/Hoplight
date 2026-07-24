/**
 * permission-mode: the reducer that evolves the gate's standing policy. initGate seeds the fail-closed
 * default (guarded, no grants). applyGateChoice folds a user's confirm choice into the next GateState:
 * allow-session adds a bounded grant, abort slams the mode to locked, set-mode raises or lowers the
 * policy. Total and tolerant: an unrecognized or malformed choice is a no-op (returns the state
 * unchanged), never a throw. Exhaustive over GateChoice with assertNever as the compile-time guard.
 */
import { assertNever } from "./assert-never";
import type { GateState, PermissionMode } from "./gate-core";

export type GateChoice =
  | { type: "allow-once" }
  | { type: "allow-session" }
  | { type: "deny" }
  | { type: "abort" }
  | { type: "set-mode"; mode: PermissionMode };

const MAX_GRANTS = 64; // bounded: tool names are finite; a cap defends against a runaway grant set
const MODES = new Set<PermissionMode>(["guarded", "autopilot", "locked"]);
const CHOICES = new Set(["allow-once", "allow-session", "deny", "abort", "set-mode"]);

const isMode = (v: unknown): v is PermissionMode =>
  typeof v === "string" && MODES.has(v as PermissionMode);

/** The fail-closed starting policy: guarded (confirm risky moves), nothing granted yet. */
export const initGate = (): GateState => ({ mode: "guarded", grants: new Set<string>() });

/** Add a session grant for a tool name, immutably and bounded. A blank or repeat name is a no-op. */
const grant = (state: GateState, name: string): GateState => {
  if (typeof name !== "string" || name.length === 0 || state.grants.has(name)) return state;
  return { ...state, grants: new Set([...state.grants, name].slice(-MAX_GRANTS)) };
};

/** Fold a confirm choice into the next policy. An unknown or malformed choice returns the state
 *  unchanged (tolerant no-op), never a throw. */
export function applyGateChoice(state: GateState, choice: GateChoice, name: string): GateState {
  const type = (choice as { type?: unknown } | null)?.type;
  if (typeof type !== "string" || !CHOICES.has(type)) return state;
  switch (choice.type) {
    case "allow-once":
    case "deny":
      return state; // one-shot decisions carry no standing policy change
    case "allow-session":
      return grant(state, name);
    case "abort":
      return { ...state, mode: "locked" };
    case "set-mode":
      return isMode(choice.mode) ? { ...state, mode: choice.mode } : state;
    default:
      return assertNever("applyGateChoice", choice);
  }
}
