/**
 * Create a blank lorebook in the studio and return a summary for the workbench.
 */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";
import { emptyLorebookBody } from "../../../core/lore";

export async function createAndOpenLorebook(ctx: AppContext): Promise<StudioEntitySummary> {
  const body = emptyLorebookBody("Untitled lorebook");
  const saved = await ctx.api.saveEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "lorebook",
    id: "lorebook",
    body,
  });
  return {
    id: saved.id,
    kind: "lorebook",
    name: saved.name || body.name,
    accent: saved.accent,
  };
}
