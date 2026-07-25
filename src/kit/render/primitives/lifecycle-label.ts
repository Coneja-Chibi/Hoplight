/**
 * Shared human labels for scheduler-owned lifecycle phases in live and sealed Backstage surfaces.
 */
import type { LoopPhase } from "../../loop/state";

const FULL: Record<LoopPhase, string> = {
  thinking: "thinking",
  discovering: "searching capability catalog",
  reading: "reading target",
  drafting: "drafting changes",
  "preview-ready": "preview ready",
  applying: "applying once",
  verifying: "verifying saved piece",
  completed: "receipt: applied and verified",
  failed: "receipt: failed",
  stale: "receipt: stale, nothing written",
  discarded: "receipt: discarded, nothing written",
  cancelled: "cancelled",
  stopped: "stopped",
};

const COMPACT: Partial<Record<LoopPhase, string>> = {
  discovering: "searching",
  applying: "applying",
  verifying: "verifying",
  completed: "verified",
  failed: "failed",
  stale: "stale",
  discarded: "discarded",
};

export const lifecycleLabel = (phase: LoopPhase, compact = false): string =>
  compact ? COMPACT[phase] ?? FULL[phase] : FULL[phase];
