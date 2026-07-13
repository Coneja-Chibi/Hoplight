/**
 * Create a blank preset in the studio and return a summary for the workbench.
 * Mirrors new-persona.ts / new-regex-set.ts (PRESET-JEWEL-PLAN.md P1).
 */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";
import { emptyPresetBody } from "../../../entities/preset";

export async function createAndOpenPreset(ctx: AppContext): Promise<StudioEntitySummary> {
  const body = emptyPresetBody("Untitled preset");
  const saved = await ctx.api.saveEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "preset",
    id: "preset",
    body,
  });
  return {
    id: saved.id,
    kind: "preset",
    name: saved.name || body.name,
    accent: saved.accent,
  };
}
