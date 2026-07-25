/**
 * Pure turn-scoped visibility state for direct, deferred, and hidden capabilities.
 */
import type { CapabilityExposure } from "./types";

const MAX_VISIBLE_DEFERRED = 5;

export interface CapabilityExposureState {
  revealedIds: readonly string[];
}

interface VisibleCapability {
  id: string;
  exposure: CapabilityExposure;
}

interface VisibilityCatalog<Capability extends VisibleCapability> {
  all(): readonly Capability[];
}

export const initialExposureState = (): CapabilityExposureState => ({ revealedIds: [] });

/** Reveal only registered deferred capabilities. Hidden capabilities stay absent by construction. */
export function revealCapabilities<Capability extends VisibleCapability>(
  catalog: VisibilityCatalog<Capability>,
  _state: CapabilityExposureState,
  ids: readonly string[],
): CapabilityExposureState {
  const selected = new Set(ids);
  return {
    revealedIds: catalog.all()
      .filter((capability) =>
        capability.exposure === "deferred" && selected.has(capability.id))
      .map((capability) => capability.id)
      .slice(0, MAX_VISIBLE_DEFERRED),
  };
}

/** Return the model-visible capability subset in stable catalog order. */
export function visibleCapabilities<Capability extends VisibleCapability>(
  catalog: VisibilityCatalog<Capability>,
  state: CapabilityExposureState,
): Capability[] {
  const revealed = new Set(state.revealedIds);
  return catalog.all().filter((capability) =>
    capability.exposure === "direct"
    || (capability.exposure === "deferred" && revealed.has(capability.id)));
}
