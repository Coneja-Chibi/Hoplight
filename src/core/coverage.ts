/**
 * Coverage declarations - the data that makes the editor's platform lens honest (vs-editor-2 law:
 * the editor knows ZERO platforms; each format folder declares which canonical body paths its wire
 * actually carries, and every lens state is computed from these claims). Paths are dot-separated
 * with PREFIX semantics on path boundaries: "greetings" covers "greetings.firstMessage" but never
 * "greetingsX". Claims live next to their codec (src/formats/<id>/coverage.ts); the round-trip
 * harness that mechanically pins claims to codec reality is tracked follow-up work - until then a
 * wrong claim is a bug in that format's folder, not in any surface.
 */

export interface CoverageDecl {
  /** canonical body path prefixes this format reads AND re-emits on its own wire */
  carries: string[];
  /** honest per-path remarks ("exports as creator_notes") - surfaced as lens tooltips later */
  notes?: Record<string, string>;
}

/** Wire shape served to surfaces: one entry per platform that declared coverage. */
export interface CoverageEntry {
  id: string;
  label: string;
  carries: string[];
  notes?: Record<string, string>;
}

/** Does a declaration cover a canonical body path? Prefix match on dot boundaries only. */
export function coversPath(decl: CoverageDecl, path: string): boolean {
  for (const prefix of decl.carries) {
    if (path === prefix || path.startsWith(`${prefix}.`)) return true;
  }
  return false;
}
