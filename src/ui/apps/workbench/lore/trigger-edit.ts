/**
 * Pure trigger-rider edits (functional core for the TriggerEditor leaf). Advanced triggers carry
 * per-trigger riders (isRegex/flags/frequency/probability); a patch value of undefined REMOVES the
 * rider key so the wire never grows empty keys.
 */
import type { Trigger } from "../../../../entities/lorebook/schema";

export interface TriggerRiderPatch {
  isRegex?: boolean;
  flags?: string | undefined;
  frequency?: number | undefined;
  probability?: number | undefined;
}

/** Apply a rider patch to the trigger at `index` (out-of-range = no-op). Keyword never changes
 * here - the chip editor owns add/remove; riders never rename. */
export function patchTriggerAt(triggers: Trigger[], index: number, patch: TriggerRiderPatch): Trigger[] {
  if (index < 0 || index >= triggers.length) return triggers;
  return triggers.map((t, i) => {
    if (i !== index) return t;
    const next: Trigger = { ...t };
    if (patch.isRegex !== undefined) next.isRegex = patch.isRegex;
    if ("flags" in patch) {
      if (patch.flags === undefined) delete next.flags;
      else next.flags = patch.flags;
    }
    if ("frequency" in patch) {
      if (patch.frequency === undefined) delete next.frequency;
      else next.frequency = patch.frequency;
    }
    if ("probability" in patch) {
      if (patch.probability === undefined) delete next.probability;
      else next.probability = patch.probability;
    }
    // a non-regex trigger carries no flags - keep the wire honest
    if (!next.isRegex) delete next.flags;
    return next;
  });
}
