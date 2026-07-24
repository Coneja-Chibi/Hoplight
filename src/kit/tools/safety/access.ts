/**
 * access: the central trust map, the single auditable place that declares which tools are safe. Today
 * the read-only tools (list/read/search) map to "read"; everything else resolves to "unknown" and is
 * therefore treated as dangerous. This is a deliberate CLOSED list, not an open registry: a tool
 * dropped into the folder is dangerous until someone consciously classifies it here (deny by absence).
 * The gated thing never gets to declare its own risk.
 */
import type { ToolAccess } from "./risk";

const TRUST = new Map<string, ToolAccess>([
  ["list", "read"],
  ["read", "read"],
  ["search", "read"],
]);

/** Resolve a tool name to its access class. Absent or non-string names -> "unknown" (deny by absence).
 *  A Map lookup (not object indexing) so a name like "__proto__" can never surface a phantom access. */
export function resolveAccess(name: string): ToolAccess {
  if (typeof name !== "string") return "unknown";
  return TRUST.get(name) ?? "unknown";
}
