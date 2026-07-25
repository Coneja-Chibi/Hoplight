/** Public entry point for the pure semantic capability layer. */
export type {
  CapabilityChange,
  CapabilityEffect,
  CapabilityExposure,
  CapabilityPlatformImpact,
  CapabilityPreview,
  CapabilityTargetInput,
  ContentCapability,
  ContentKind,
} from "./types";
export {
  createCapabilityCatalog,
  providerToolName,
  type CapabilityCatalog,
} from "./catalog";
export {
  searchCapabilities,
  type CapabilitySearchHit,
  type CapabilitySearchQuery,
} from "./search";
export {
  initialExposureState,
  revealCapabilities,
  visibleCapabilities,
  type CapabilityExposureState,
} from "./exposure";
