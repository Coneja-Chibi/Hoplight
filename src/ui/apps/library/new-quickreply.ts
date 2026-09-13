/** Create a blank quick-reply set and return the shared Workbench summary. */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";
import { emptyQuickReplyBody } from "../../../entities/quickreply/schema";

export async function createAndOpenQuickReplies(ctx: AppContext): Promise<StudioEntitySummary> {
  const body = emptyQuickReplyBody("Untitled quick replies");
  const saved = await ctx.api.saveEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "quickreply",
    id: "quick-replies",
    body,
  });
  return { id: saved.id, kind: "quickreply", name: saved.name || body.name, accent: saved.accent };
}
