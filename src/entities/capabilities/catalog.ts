/**
 * Immutable capability catalog: one checked lookup over drop-in semantic operations.
 */
import type {
  ContentCapability,
  ContentKind,
} from "./types";

const CAPABILITY_ID = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2,}$/;
const EXPOSURES = new Set(["direct", "deferred", "hidden"]);
const EFFECTS = new Set(["read", "draft"]);

/** Convert a stable dotted capability id to a provider-safe function name. */
export const providerToolName = (id: string): string => id.replaceAll(".", "_");

export interface CapabilityCatalog {
  all(): readonly ContentCapability[];
  get(id: string): ContentCapability | undefined;
  forKind(kind: ContentKind): readonly ContentCapability[];
}

/** Build one immutable catalog, rejecting ambiguous or dishonest identifiers. */
export function createCapabilityCatalog(
  capabilities: readonly ContentCapability[],
): CapabilityCatalog {
  const ordered = Object.freeze([...capabilities]);
  const byId = new Map<string, ContentCapability>();

  for (const capability of ordered) {
    if (typeof capability !== "object" || capability === null) {
      throw new Error("invalid capability module export");
    }
    if (!CAPABILITY_ID.test(capability.id) || capability.id.includes("..")) {
      throw new Error(`invalid capability id "${capability.id}"`);
    }
    if (!capability.id.startsWith(`${capability.kind}.`)) {
      throw new Error(`capability id "${capability.id}" must start with ${capability.kind}.`);
    }
    if (byId.has(capability.id)) {
      throw new Error(`duplicate capability id "${capability.id}"`);
    }
    for (const field of ["area", "action", "summary"] as const) {
      if (typeof capability[field] !== "string" || capability[field].trim() === "") {
        throw new Error(`${capability.id}: ${field} must be a non-empty ${field}`);
      }
    }
    if (!Array.isArray(capability.aliases)
      || capability.aliases.some((alias) => typeof alias !== "string" || alias.trim() === "")) {
      throw new Error(`${capability.id}: aliases must contain only non-empty strings`);
    }
    if (capability.platforms !== "canonical"
      && (!Array.isArray(capability.platforms)
        || capability.platforms.length === 0
        || capability.platforms.some(
          (platform) => typeof platform !== "string" || platform.trim() === "",
        ))) {
      throw new Error(`${capability.id}: invalid platform metadata`);
    }
    if (!EXPOSURES.has(capability.exposure)) {
      throw new Error(`${capability.id}: invalid exposure`);
    }
    if (!EFFECTS.has(capability.effect)) {
      throw new Error(`${capability.id}: invalid effect`);
    }
    if (typeof capability.input?.safeParse !== "function"
      || typeof capability.preview !== "function"
      || typeof capability.concurrencyKey !== "function") {
      throw new Error(`${capability.id}: incomplete runtime contract`);
    }
    byId.set(capability.id, capability);
  }

  return {
    all: () => ordered,
    get: (id) => byId.get(id),
    forKind: (kind) => ordered.filter((capability) => capability.kind === kind),
  };
}
