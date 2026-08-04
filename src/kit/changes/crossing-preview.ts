/**
 * Build a crossing ledger for an export, at the moment the gate needs one.
 *
 * WHY THIS RUNS THE CONVERSION TWICE. The gate decides before `execute`, so the only way to show a
 * person what a crossing costs is to perform it once for the preview and again for the write. The
 * alternative is showing them nothing, or caching a result the write might not match. A conversion is
 * pure and in-memory - it serialises a stored piece, it does not touch the studio - so the cost is
 * time, and the thing bought is that nobody approves a conversion they have not seen.
 *
 * TOLERANT ON PURPOSE. Every failure here returns null and the gate falls back to its ordinary
 * confirm. A preview that throws must not deny a legitimate export: the decision is still answerable
 * without the panel, and failing the write because the picture failed is the wrong end to fail from.
 */
import type { KitBridge } from "../bridge";
import type { ContentKind } from "../../entities/capabilities";
import { reviewCrossing, type CrossingReview } from "./crossing";

/** Named the way a person says it, not the adapter id: "sillytavern-preset" is not a sentence. */
const friendlyTarget = (id: string): string => id.replace(/-(preset|lorebook|character|regex|persona)$/, "");

const SETTING_GROUPS = [
  "samplers", "systemPrompts", "templates", "behavior", "apiOptions", "media", "generation",
] as const;

/** What arrives intact, counted from the canonical body so the numbers are the piece's own. */
function carriedOf(body: unknown): { label: string; count: number }[] {
  if (typeof body !== "object" || body === null) return [];
  const record = body as Record<string, unknown>;
  const carried: { label: string; count: number }[] = [];
  const prompts = record["prompts"];
  if (Array.isArray(prompts)) carried.push({ label: "blocks", count: prompts.length });
  const entries = record["entries"];
  if (Array.isArray(entries)) carried.push({ label: "entries", count: entries.length });
  const groups = SETTING_GROUPS.filter((group) => record[group] !== undefined).length;
  if (groups > 0) carried.push({ label: "setting groups", count: groups });
  return carried;
}

/**
 * The ledger for one pending export, or null when there is nothing to show.
 *
 * The conversion graph is imported lazily for the same reason the transfer tool imports it lazily:
 * it is large, and a session that never converts anything should not pay for it at startup.
 */
export async function crossingForExport(
  bridge: KitBridge,
  args: Record<string, unknown> | null,
): Promise<CrossingReview | null> {
  const kind = typeof args?.["kind"] === "string" ? args["kind"] : null;
  const id = typeof args?.["id"] === "string" ? args["id"] : null;
  const to = typeof args?.["to"] === "string" ? args["to"] : null;
  if (!kind || !id || !to) return null;

  try {
    const entity = await bridge.read(kind, id);
    if (!entity) return null;

    const { convertStoredPiece, loadConversionKit } = await import("../tools/_transfer-common");
    const outcome = await convertStoredPiece(await loadConversionKit(), bridge, entity, kind, to);
    if (!outcome.ok) return null;

    return reviewCrossing({
      target: { kind: kind as ContentKind, id },
      to: friendlyTarget(to),
      changes: outcome.translation ?? [],
      carried: carriedOf((entity as { body?: unknown }).body),
      // The source's own escrow has nowhere to live in another platform's file. Reported as
      // reassurance rather than loss: Hoplight still holds it, so converting back restores it.
      escrowDropped: (outcome.loss?.dropped ?? []).some((field) => field.startsWith("original.")),
      warningCount: outcome.loss?.warnings?.length ?? 0,
    });
  } catch {
    return null; // no panel, ordinary confirm; never a denial
  }
}
