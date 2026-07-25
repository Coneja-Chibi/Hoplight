/**
 * Pure collapsed browsing and exact selection over the semantic capability catalog.
 */
import { providerToolName } from "./catalog";
import type { CapabilityDomain } from "./descriptor";
import type {
  CapabilityEffect,
  CapabilityExposure,
  ContentKind,
} from "./types";

export interface CapabilityBrowseRequest {
  kind?: ContentKind;
  domain?: CapabilityDomain;
  area?: string;
  platform?: string;
  offset?: number;
  limit?: number;
}

export interface CapabilityDomainRef {
  domain: CapabilityDomain;
  count: number;
}

export interface CapabilityAreaRef {
  area: string;
  count: number;
}

export interface CapabilityRef {
  id: string;
  tool: string;
  domain: CapabilityDomain;
  kind?: ContentKind;
  area: string;
  action: string;
  summary: string;
  platforms: readonly string[] | "canonical";
  effect: CapabilityEffect;
}

export interface CapabilityBrowseResult {
  domains: readonly CapabilityDomainRef[];
  areas: readonly CapabilityAreaRef[];
  capabilities: readonly CapabilityRef[];
  totalCapabilities: number;
  offset: number;
  limit: number;
}

export interface CapabilityDescribeRequest {
  kind?: ContentKind;
  domain?: CapabilityDomain;
  id: string;
  platform?: string;
}

interface NavigableCapability {
  id: string;
  toolName?: string;
  domain?: CapabilityDomain;
  kind?: ContentKind;
  area: string;
  action: string;
  summary: string;
  platforms: readonly string[] | "canonical";
  exposure: CapabilityExposure;
  effect: CapabilityEffect;
}

interface NavigationCatalog<Capability extends NavigableCapability> {
  all(): readonly Capability[];
  get(id: string): Capability | undefined;
}

const domainOf = (capability: NavigableCapability): CapabilityDomain =>
  capability.domain ?? "content";

const availableOn = (capability: NavigableCapability, platform?: string): boolean =>
  !platform
  || capability.platforms === "canonical"
  || capability.platforms.includes(platform);

const availableCapabilities = <Capability extends NavigableCapability>(
  catalog: NavigationCatalog<Capability>,
  kind?: ContentKind,
  domain?: CapabilityDomain,
  platform?: string,
): Capability[] =>
  catalog.all()
    .filter((capability) => capability.exposure !== "hidden")
    .filter((capability) =>
      domain === undefined || domainOf(capability) === domain)
    .filter((capability) =>
      kind === undefined || capability.kind === undefined || capability.kind === kind)
    .filter((capability) => availableOn(capability, platform));

const asRef = (capability: NavigableCapability): CapabilityRef => ({
  id: capability.id,
  tool: capability.toolName ?? providerToolName(capability.id),
  domain: domainOf(capability),
  ...(capability.kind ? { kind: capability.kind } : {}),
  area: capability.area,
  action: capability.action,
  summary: capability.summary,
  platforms: capability.platforms,
  effect: capability.effect,
});

/** Browse areas, or the paginated actions directly beneath one selected area. */
export function browseCapabilities<Capability extends NavigableCapability>(
  catalog: NavigationCatalog<Capability>,
  request: CapabilityBrowseRequest,
): CapabilityBrowseResult {
  const available = availableCapabilities(
    catalog,
    request.kind,
    request.domain,
    request.platform,
  );
  const domains = [...new Set(available.map(domainOf))]
    .sort((a, b) => a.localeCompare(b))
    .map((domain) => ({
      domain,
      count: available.filter((capability) => domainOf(capability) === domain).length,
    }));
  const areas = [...new Set(available.map((capability) => capability.area))]
    .sort((a, b) => a.localeCompare(b))
    .map((area) => ({
      area,
      count: available.filter((capability) => capability.area === area).length,
    }));
  const inArea = request.area
    ? available
      .filter((capability) => capability.area === request.area)
      .sort((a, b) =>
        a.action.localeCompare(b.action) || a.id.localeCompare(b.id))
    : [];
  const limit = Math.max(1, Math.min(25, request.limit ?? 12));
  const offset = Math.max(0, request.offset ?? 0);
  return {
    domains,
    areas,
    capabilities: inArea.slice(offset, offset + limit).map(asRef),
    totalCapabilities: inArea.length,
    offset,
    limit,
  };
}

/** Resolve one model-selectable capability for a target kind and optional platform. */
export function describeCapability<Capability extends NavigableCapability>(
  catalog: NavigationCatalog<Capability>,
  request: CapabilityDescribeRequest,
): Capability | null {
  const capability = catalog.get(request.id);
  if (!capability
    || (request.kind !== undefined
      && capability.kind !== undefined
      && capability.kind !== request.kind)
    || (request.domain !== undefined && domainOf(capability) !== request.domain)
    || capability.exposure === "hidden"
    || !availableOn(capability, request.platform)) {
    return null;
  }
  return capability;
}
