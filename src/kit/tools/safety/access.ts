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
  ["studio_character_create", "draft"],
  ["studio_lorebook_create", "draft"],
  ["studio_persona_create", "draft"],
  ["studio_preset_create", "draft"],
  ["studio_regex_create", "draft"],
  ["studio_pack_create", "draft"],
  // Lifecycle beyond creation. A copy is preview-only like every other create, so it is a draft.
  // Removal is durable and irreversible, so it takes the dedicated `delete` class (danger floor)
  // rather than "write" - a piece coming back is not something the Gate can offer.
  ["studio_duplicate", "draft"],
  ["studio_delete", "delete"],
  // Transfer serializes to another platform's wire and returns the payload as an observation. It
  // touches no storage and writes no file, so it is a read. Export is the tool that writes, and it
  // gets its own name and its own class here rather than a widened meaning of transfer.
  ["studio_transfer", "read"],
  // Export creates a file in the studio's exports folder. `write` rather than `delete`: it is
  // create-only and refuses an occupied name, so it can add a file but never destroy one.
  ["studio_export", "write"],
  // Pure catalog lookup: no storage, no filesystem, no network.
  ["macro_lookup", "read"],
  // Hands the shell a list to draw. Reads nothing, stores nothing, and cannot answer for anybody:
  // picking fills the composer rather than sending.
  ["ask_choice", "read"],
  // Its sibling, and it sat outside this map long enough to reach a user: `block_lookup` declares
  // `effect: "read"` at its own definition, but this map is the authority and had no entry, so every
  // call raised a DANGER banner reading `unrecognized tool`. Four others were in the same state. The
  // consequence of a missed entry is not a quiet hole - it is a false alarm on a safe tool, which
  // teaches people to click through the prompts that matter. `trust-map.test.ts` now fails when a
  // registered tool is missing here, so the next one is caught by CI instead of by somebody using it.
  ["block_lookup", "read"],
  // Reads inside an explicitly shared folder and can do nothing else; the grant is the boundary.
  ["folder_search", "read"],
  // The one-way door into the studio. Preview-only like every other create, hence draft, not write.
  ["folder_import", "draft"],
  // Renders a preset through an engine checkout to see whether its macros resolve. It SPAWNS a
  // subprocess, which is worth stating plainly - but the payload is a first-party renderer in this
  // repo, not an opaque one, and the studio is never mutated. `exec` is reserved for a payload we did
  // not write; this is a read that happens to fork.
  ["preset_verify", "read"],
  // Opens the outline rail over the transcript. Display only.
  ["rail_open", "read"],
  // The regex workbench. It RUNS patterns, which sounds like exec and is not: the payload is a
  // regular expression, the engine refuses anything the validator calls a backtracking bomb, and
  // every run is time-bounded. Nothing is stored - saving belongs to regex_create.
  ["regex_lab", "read"],
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
