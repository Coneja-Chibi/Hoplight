/**
 * Create a blank character in the studio and return a summary for the workbench. Mirrors
 * new-persona.ts; the body is the minimal canonical character (every section present, empty),
 * the same shape the store's own tests pin.
 */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";

export async function createAndOpenCharacter(ctx: AppContext): Promise<StudioEntitySummary> {
  const name = "Untitled character";
  const saved = await ctx.api.saveEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "character",
    id: "character",
    body: {
      identity: { name },
      persona: {},
      prompts: {},
      greetings: {},
      examples: {},
      media: {},
      attribution: {},
      discovery: {},
    },
  });
  return { id: saved.id, kind: "character", name: saved.name || name, accent: saved.accent };
}
