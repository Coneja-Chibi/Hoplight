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
  CAPABILITY_DOMAINS,
  createCapabilityDescriptorCatalog,
  describeContentCapability,
  type CapabilityDescriptor,
  type CapabilityDescriptorCatalog,
  type CapabilityDomain,
} from "./descriptor";
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
export {
  browseCapabilities,
  describeCapability,
  type CapabilityAreaRef,
  type CapabilityBrowseRequest,
  type CapabilityBrowseResult,
  type CapabilityDomainRef,
  type CapabilityDescribeRequest,
  type CapabilityRef,
} from "./navigation";
