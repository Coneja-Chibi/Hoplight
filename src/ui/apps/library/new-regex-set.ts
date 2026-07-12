/**
 * Create a blank regex set in the studio and return a summary for the workbench.
 * Mirrors new-lorebook.ts: save the empty body, hand back the summary the shelf and workbench share.
 */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";
import { emptyRegexSetBody } from "../../../entities/regex";

export async function createAndOpenRegexSet(ctx: AppContext): Promise<StudioEntitySummary> {
  const body = emptyRegexSetBody("Untitled regex set");
  const saved = await ctx.api.saveEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "regex",
    id: "regex",
    body,
  });
  return {
    id: saved.id,
    kind: "regex",
    name: saved.name || body.name,
    accent: saved.accent,
  };
}
