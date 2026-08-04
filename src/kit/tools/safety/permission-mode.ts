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
  /** Neither yes nor no: do not run it, keep the question open, and let the user ask about it. The
   *  gate still closes - it cannot stay open across turns - but the shell can tell the difference
   *  between "I decided against this" and "I want to know more first". */
  | { type: "hold" }
  | { type: "set-mode"; mode: PermissionMode };

const MAX_GRANTS = 64; // bounded: tool names are finite; a cap defends against a runaway grant set
const MODES = new Set<PermissionMode>(["guarded", "autopilot", "full", "locked"]);
const CHOICES = new Set(["allow-once", "allow-session", "deny", "abort", "hold", "set-mode"]);

/** The three user-selectable modes on the /gates screen, in order, with Chi's words (locked 2026-07-24).
 * `locked` is not offered here: it is the fail-closed fallback + where an abort lands, shown as "Read-only"
 * when it is the active state. The danger floor (unknown/exec) confirms in every mode and is not a mode. */
export const GATE_MODES: readonly PermissionMode[] = ["guarded", "autopilot", "full"];

export const MODE_LABEL: Record<PermissionMode, string> = {
  guarded: "Always ask",
  autopilot: "Never ask safe moves",
  full: "Full control",
  locked: "Read-only",
};

export const MODE_HINT: Record<PermissionMode, string> = {
  guarded: "every write waits for your yes",
  autopilot: "writes go; deletes and sends still ask",
  full: "nothing asks, except the danger floor",
  locked: "reads only; nothing is written",
};

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
    // A hold is a one-shot too. It deliberately grants nothing and loosens nothing: asking a question
    // about a call must never be a way to end up having permitted it.
    case "hold":
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
