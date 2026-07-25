/**
 * Pure lifecycle reducer for one Kit model/tool turn. Terminal outcomes are absorbing so a stale,
 * failed, cancelled, or stopped apply can never later be painted as a successful completion.
 */
import type { ToolEffect } from "../tools/tool";

export type LoopPhase =
  | "thinking"
  | "discovering"
  | "reading"
  | "drafting"
  | "preview-ready"
  | "applying"
  | "verifying"
  | "completed"
  | "failed"
  | "stale"
  | "discarded"
  | "cancelled"
  | "stopped";

export interface LoopState {
  phase: LoopPhase;
}

export type LoopStateEvent =
  | { type: "model-request" }
  | { type: "discovering" }
  | { type: "tool-start"; effect: ToolEffect }
  | { type: "preview-ready" }
  | { type: "verifying" }
  | { type: "completed" }
  | { type: "failed" }
  | { type: "stale" }
  | { type: "discarded" }
  | { type: "cancelled" }
  | { type: "stopped" };

const TERMINAL = new Set<LoopPhase>([
  "completed",
  "failed",
  "stale",
  "discarded",
  "cancelled",
  "stopped",
]);

export const initialLoopState = (): LoopState => ({ phase: "thinking" });

const effectPhase = (effect: ToolEffect): LoopPhase => {
  if (effect === "read") return "reading";
  if (effect === "draft") return "drafting";
  return "applying";
};

/** Fold one actual loop event into lifecycle state. Unknown ordering stays tolerant and monotonic. */
export function transitionLoop(state: LoopState, event: LoopStateEvent): LoopState {
  if (TERMINAL.has(state.phase)) return state;
  switch (event.type) {
    case "model-request":
      return { phase: "thinking" };
    case "discovering":
      return { phase: "discovering" };
    case "tool-start":
      return { phase: effectPhase(event.effect) };
    case "preview-ready":
      return { phase: "preview-ready" };
    case "verifying":
      return { phase: "verifying" };
    case "completed":
    case "failed":
    case "stale":
    case "discarded":
    case "cancelled":
    case "stopped":
      return { phase: event.type };
  }
}
