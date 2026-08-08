/**
 * Taking a piece named in the conversation and putting it on the bench.
 *
 * THE OTHER HALF OF A MENTION. Pointing the agent at `@preset:astrolabe` tells the model which one
 * to read; this is what lets YOU open the same piece without going and finding it again. The marker
 * in the transcript becomes the thing you click.
 *
 * IT OPENS RATHER THAN SENDS. `ctx.workbench.open` lands on the piece's editor, which is right for a
 * click somebody made deliberately - the follow-prompt exists for batches arriving from the Library,
 * and asking "do you want to go there" about a link you just pressed is asking twice.
 */
import type { AppContext, StudioEntitySummary } from "../app-contract";

/** A marker as the composer writes it: `@kind:id`. */
const MARKER = /^@([a-z-]+):(\S+)$/;

/**
 * Read a marker, or null when the text is not one.
 *
 * Pure and total, because it runs over every word of every transcript line looking for something to
 * make clickable, and a throw there would take the whole conversation down over one odd token.
 */
export function readMarker(word: string): { kind: string; id: string } | null {
  const match = MARKER.exec(word.trim());
  if (!match) return null;
  const [, kind, id] = match;
  return kind && id ? { kind, id } : null;
}

/**
 * Find the piece a marker names, or null.
 *
 * BY EXACT ID AND KIND, never by name. The marker exists precisely so a click cannot land on the
 * wrong piece when two are called the same thing - resolving it loosely would give back the
 * ambiguity the marker was written to remove.
 */
export function pieceFor(
  marker: { kind: string; id: string },
  pieces: readonly StudioEntitySummary[],
): StudioEntitySummary | null {
  return pieces.find((p) => p.kind === marker.kind && p.id === marker.id) ?? null;
}

/**
 * Open a mentioned piece on the Workbench.
 *
 * Returns whether it went. False means the marker named something that is no longer in the studio -
 * a piece deleted since the conversation mentioned it - which the caller reports rather than
 * swallowing, because a link that does nothing when clicked is read as the app being broken.
 */
export function openMentioned(
  ctx: AppContext,
  marker: { kind: string; id: string },
  pieces: readonly StudioEntitySummary[],
): boolean {
  const piece = pieceFor(marker, pieces);
  if (!piece) return false;
  ctx.workbench.open(piece);
  ctx.openApp("workbench");
  return true;
}
