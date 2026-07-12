/**
 * Create a blank persona in the studio and return a summary for the workbench.
 * Mirrors new-regex-set.ts / new-lorebook.ts (PERSONA-JEWEL-PLAN.md P1).
 */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";
import { emptyPersonaBody } from "../../../entities/persona";

export async function createAndOpenPersona(ctx: AppContext): Promise<StudioEntitySummary> {
  const body = emptyPersonaBody("Untitled persona");
  const saved = await ctx.api.saveEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "persona",
    id: "persona",
    body,
  });
  return {
    id: saved.id,
    kind: "persona",
    name: saved.name || body.name,
    accent: saved.accent,
  };
}
