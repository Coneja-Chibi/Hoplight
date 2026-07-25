/**
 * access: the central trust map, the single auditable place that declares which tools are safe. Today
 * known shell tools map explicitly; everything else resolves to "unknown" and is therefore treated as
 * dangerous. Validated semantic capabilities can be supplied to createAccessResolver and receive the
 * preview-only "draft" class. This is still deny by absence: arbitrary dropped-in tools and
 * capability-like names are not trusted, and the gated thing never declares its own risk.
 */
import type { CapabilityDescriptor } from "../../../entities/capabilities";
import type { ToolAccess } from "./risk";

const TRUST = new Map<string, ToolAccess>([
  ["studio_list", "read"],
  ["studio_read", "read"],
  ["studio_search", "read"],
  ["docs_query", "read"],
  ["result_query", "read"],
  ["capability_find", "read"],
  ["change_query", "read"],
  ["change_discard", "draft"],
  ["change_apply", "write"],
]);

export type AccessResolver = (name: string) => ToolAccess;
export interface CatalogToolAccess {
  name: string;
  access: "read" | "draft";
}

/**
 * Derive safe exact names only from pure content capabilities. General HarnessTools keep their
 * writable bridge and therefore cannot self-classify as safe through discovery metadata.
 */
export function contentCapabilityAccess(
  descriptors: readonly CapabilityDescriptor[],
): CatalogToolAccess[] {
  return descriptors
    .filter((descriptor) => descriptor.domain === "content")
    .map((descriptor) => ({
      name: descriptor.toolName,
      access: descriptor.effect,
    }));
}

/** Resolve a tool name to its access class. Absent or non-string names -> "unknown" (deny by absence).
 *  A Map lookup (not object indexing) so a name like "__proto__" can never surface a phantom access. */
export function resolveAccess(name: string): ToolAccess {
  if (typeof name !== "string") return "unknown";
  return TRUST.get(name) ?? "unknown";
}

/**
 * Extend the closed policy with exact provider names derived from the validated capability catalog.
 * No prefix or pattern matching is permitted.
 */
export function createAccessResolver(
  capabilityTools: readonly (string | CatalogToolAccess)[],
): AccessResolver {
  const catalog = new Map<string, ToolAccess>();
  for (const entry of capabilityTools) {
    if (typeof entry === "string") {
      if (entry.length > 0) catalog.set(entry, "draft");
      continue;
    }
    if (entry.name.length > 0) catalog.set(entry.name, entry.access);
  }
  return (name: string): ToolAccess => {
    const known = resolveAccess(name);
    if (known !== "unknown") return known;
    return typeof name === "string" ? catalog.get(name) ?? "unknown" : "unknown";
  };
}
