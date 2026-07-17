/**
 * Lite state-graph model: named states + transitions that compile to trigger rows.
 * Non-coders think in states; the wire still gets When/If/Then scripts.
 */
import { newUiId } from "../../../../_shared/new-id";

export const STATE_VAR = "state";

export interface GraphState {
  id: string;
  label: string;
}

export interface GraphTransition {
  id: string;
  /** state id leaving */
  from: string;
  /** state id entering */
  to: string;
  event: string;
  /** extra var conditions (not including the from-state check) */
  whenVar?: string;
  whenOp?: string;
  whenValue?: string;
  /** optional setvar side effect besides changing state */
  effectVar?: string;
  effectOp?: string;
  effectValue?: string;
}

export interface StateGraph {
  states: GraphState[];
  transitions: GraphTransition[];
}

export const blankGraph = (): StateGraph => ({
  states: [
    { id: "idle", label: "Idle" },
    { id: "busy", label: "Busy" },
  ],
  transitions: [],
});

export const newStateId = (label: string, used: ReadonlySet<string>): string => {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "state";
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
};

/**
 * Collision-resistant transition identity for editor-created moves. Pure seam so pane/UI never
 * invents timestamp-only ids; normalize/import paths keep existing ids untouched.
 */
export const newTransitionId = (): string => newUiId("t");
