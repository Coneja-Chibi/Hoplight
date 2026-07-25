/**
 * access: the central trust map, the single auditable place that declares which tools are safe. Today
 * known shell tools map explicitly; everything else resolves to "unknown" and is therefore treated as
 * dangerous. Validated semantic capabilities can be supplied to createAccessResolver and receive the
 * preview-only "draft" class. This is still deny by absence: arbitrary dropped-in tools and
 * capability-like names are not trusted, and the gated thing never declares its own risk.
 */
import type { ToolAccess } from "./risk";

const TRUST = new Map<string, ToolAccess>([
  ["list", "read"],
  ["read", "read"],
  ["search", "read"],
  ["docs_query", "read"],
  ["capability_find", "read"],
  ["change_discard", "draft"],
  ["change_apply", "write"],
]);

export type AccessResolver = (name: string) => ToolAccess;

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
  capabilityToolNames: readonly string[],
): AccessResolver {
  const drafts = new Set(
    capabilityToolNames.filter((name) => typeof name === "string" && name.length > 0),
  );
  return (name: string): ToolAccess => {
    const known = resolveAccess(name);
    if (known !== "unknown") return known;
    return typeof name === "string" && drafts.has(name) ? "draft" : "unknown";
  };
}
