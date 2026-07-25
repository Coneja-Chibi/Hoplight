/**
 * Deterministic metadata search for progressive capability disclosure.
 */
import type { CapabilityDomain } from "./descriptor";
import type {
  CapabilityEffect,
  CapabilityExposure,
  ContentCapability,
  ContentKind,
} from "./types";

const DEFAULT_LIMIT = 5;

export interface CapabilitySearchQuery {
  query: string;
  kind?: ContentKind;
  domain?: CapabilityDomain;
  platform?: string;
  limit?: number;
}

export interface SearchableCapability {
  id: string;
  kind?: ContentKind;
  domain?: CapabilityDomain;
  area: string;
  action: string;
  summary: string;
  aliases: readonly string[];
  platforms: readonly string[] | "canonical";
  exposure: CapabilityExposure;
  effect: CapabilityEffect;
}

export interface CapabilitySearchHit<
  Capability extends SearchableCapability = ContentCapability,
> {
  capability: Capability;
  score: number;
}

interface SearchCatalog<Capability extends SearchableCapability> {
  all(): readonly Capability[];
}

const normalize = (value: string): string => value.trim().toLowerCase();

const operationQuery = (query: string, kind?: ContentKind): string => {
  if (!kind) return query;
  const tokens = query.split(/\s+/).filter((token) => token !== kind && token !== `${kind}s`);
  return tokens.length > 0 ? tokens.join(" ") : query;
};

function scoreField(field: string, query: string, exact: number, contains: number): number {
  const normalized = normalize(field);
  if (normalized === query) return exact;
  if (normalized.includes(query)) return contains;
  return 0;
}

function capabilityHaystack(capability: SearchableCapability): string {
  return [
    capability.id,
    capability.domain ?? "content",
    capability.area,
    capability.action,
    capability.summary,
    ...capability.aliases,
  ].join(" ").toLowerCase();
}

function relevance(
  capability: SearchableCapability,
  query: string,
): { score: number; tokenMatches: number } {
  let score = 0;
  score += scoreField(capability.id, query, 120, 36);
  score += scoreField(capability.action, query, 90, 28);
  score += scoreField(capability.area, query, 70, 22);
  score += scoreField(capability.summary, query, 60, 20);
  for (const alias of capability.aliases) score += scoreField(alias, query, 100, 32);
  const haystack = capabilityHaystack(capability);
  let tokenMatches = 0;
  for (const token of query.split(/\s+/).filter(Boolean)) {
    if (haystack.includes(token)) {
      score += 8;
      tokenMatches += 1;
    }
  }
  return { score, tokenMatches };
}

/** Search catalog metadata, returning at most five full capability references by default. */
export function searchCapabilities<Capability extends SearchableCapability>(
  catalog: SearchCatalog<Capability>,
  request: CapabilitySearchQuery,
): CapabilitySearchHit<Capability>[] {
  const query = normalize(request.query);
  if (!query) return [];
  const intent = operationQuery(query, request.kind);
  const limit = Math.max(1, Math.min(request.limit ?? DEFAULT_LIMIT, DEFAULT_LIMIT));

  const scored = catalog.all()
    .filter((capability) => capability.exposure !== "hidden")
    .filter((capability) =>
      request.kind === undefined
      || capability.kind === undefined
      || capability.kind === request.kind)
    .filter((capability) =>
      request.domain === undefined
      || (capability.domain ?? "content") === request.domain)
    .filter((capability) => {
      if (!request.platform) return true;
      return capability.platforms === "canonical"
        || capability.platforms.includes(request.platform);
    })
    .map((capability) => ({ capability, ...relevance(capability, intent) }))
    .filter((hit) => hit.score > 0);
  const bestCoverage = Math.max(0, ...scored.map((hit) => hit.tokenMatches));
  return scored
    .filter((hit) => hit.tokenMatches === bestCoverage)
    .sort((a, b) => b.score - a.score || a.capability.id.localeCompare(b.capability.id))
    .slice(0, limit)
    .map(({ capability, score }) => ({ capability, score }));
}
