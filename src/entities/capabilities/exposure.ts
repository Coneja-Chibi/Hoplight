/**
 * Pure turn-scoped visibility state for direct, deferred, and hidden capabilities.
 */
import type { CapabilityCatalog } from "./catalog";
import type { ContentCapability } from "./types";

const MAX_VISIBLE_DEFERRED = 5;

export interface CapabilityExposureState {
  revealedIds: readonly string[];
}

export const initialExposureState = (): CapabilityExposureState => ({ revealedIds: [] });

/** Reveal only registered deferred capabilities. Hidden capabilities stay absent by construction. */
export function revealCapabilities(
  catalog: CapabilityCatalog,
  state: CapabilityExposureState,
  ids: readonly string[],
): CapabilityExposureState {
  const revealed = new Set(state.revealedIds);
  for (const id of ids) {
    if (catalog.get(id)?.exposure === "deferred") revealed.add(id);
  }
  return {
    revealedIds: catalog.all()
      .filter((capability) => revealed.has(capability.id))
      .map((capability) => capability.id)
      .slice(0, MAX_VISIBLE_DEFERRED),
  };
}

/** Return the model-visible capability subset in stable catalog order. */
export function visibleCapabilities(
  catalog: CapabilityCatalog,
  state: CapabilityExposureState,
): ContentCapability[] {
  const revealed = new Set(state.revealedIds);
  return catalog.all().filter((capability) =>
    capability.exposure === "direct"
    || (capability.exposure === "deferred" && revealed.has(capability.id)));
}
