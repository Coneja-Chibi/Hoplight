/**
 * Provider-discovery metadata shared by content capabilities and broader Studio workflows.
 * Descriptors are pure metadata. Execution remains owned by the capability or Kit tool registry.
 */
import { providerToolName } from "./catalog";
import type {
  CapabilityEffect,
  CapabilityExposure,
  ContentCapability,
  ContentKind,
} from "./types";

export const CAPABILITY_DOMAINS = [
  "content",
  "studio",
  "transfer",
  "diagnostics",
] as const;

export type CapabilityDomain = typeof CAPABILITY_DOMAINS[number];

export interface CapabilityDescriptor {
  id: string;
  toolName: string;
  domain: CapabilityDomain;
  kind?: ContentKind;
  area: string;
  action: string;
  summary: string;
  aliases: readonly string[];
  platforms: readonly string[] | "canonical";
  exposure: CapabilityExposure;
  effect: CapabilityEffect;
}

export interface CapabilityDescriptorCatalog {
  all(): readonly CapabilityDescriptor[];
  get(id: string): CapabilityDescriptor | undefined;
}

const DESCRIPTOR_ID = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2,}$/;
const PROVIDER_NAME = /^[a-z][a-z0-9_-]*$/;
const DOMAINS = new Set<string>(CAPABILITY_DOMAINS);
const EXPOSURES = new Set(["direct", "deferred", "hidden"]);
const EFFECTS = new Set(["read", "draft"]);

const nonEmptyStrings = (values: readonly string[]): boolean =>
  values.every((value) => typeof value === "string" && value.trim().length > 0);

/** Project one pure content operation into the shared provider-discovery catalog. */
export const describeContentCapability = (
  capability: ContentCapability,
): CapabilityDescriptor => ({
  id: capability.id,
  toolName: providerToolName(capability.id),
  domain: "content",
  kind: capability.kind,
  area: capability.area,
  action: capability.action,
  summary: capability.summary,
  aliases: capability.aliases,
  platforms: capability.platforms,
  exposure: capability.exposure,
  effect: capability.effect,
});

/** Build the one immutable catalog searched by progressive disclosure. */
export function createCapabilityDescriptorCatalog(
  descriptors: readonly CapabilityDescriptor[],
): CapabilityDescriptorCatalog {
  const ordered = Object.freeze(descriptors.map((descriptor) =>
    Object.freeze({ ...descriptor })));
  const byId = new Map<string, CapabilityDescriptor>();
  const byTool = new Set<string>();

  for (const descriptor of ordered) {
    if (!DESCRIPTOR_ID.test(descriptor.id)) {
      throw new Error(`invalid capability descriptor id "${descriptor.id}"`);
    }
    if (!PROVIDER_NAME.test(descriptor.toolName)) {
      throw new Error(`${descriptor.id}: invalid provider tool name`);
    }
    if (byId.has(descriptor.id)) {
      throw new Error(`duplicate capability descriptor id "${descriptor.id}"`);
    }
    if (byTool.has(descriptor.toolName)) {
      throw new Error(`duplicate capability provider tool "${descriptor.toolName}"`);
    }
    if (!DOMAINS.has(descriptor.domain)) {
      throw new Error(`${descriptor.id}: invalid discovery domain`);
    }
    for (const field of ["area", "action", "summary"] as const) {
      if (typeof descriptor[field] !== "string" || descriptor[field].trim() === "") {
        throw new Error(`${descriptor.id}: ${field} must be non-empty`);
      }
    }
    if (!Array.isArray(descriptor.aliases) || !nonEmptyStrings(descriptor.aliases)) {
      throw new Error(`${descriptor.id}: aliases must contain only non-empty strings`);
    }
    if (descriptor.platforms !== "canonical"
      && (!Array.isArray(descriptor.platforms)
        || descriptor.platforms.length === 0
        || !nonEmptyStrings(descriptor.platforms))) {
      throw new Error(`${descriptor.id}: invalid platform metadata`);
    }
    if (!EXPOSURES.has(descriptor.exposure) || !EFFECTS.has(descriptor.effect)) {
      throw new Error(`${descriptor.id}: invalid exposure or effect`);
    }
    byId.set(descriptor.id, descriptor);
    byTool.add(descriptor.toolName);
  }

  return {
    all: () => ordered,
    get: (id) => byId.get(id),
  };
}
