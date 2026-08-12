/**
 * Where a batch of staged pieces actually goes.
 *
 * NOT EVERY KIND HAS A WORKBENCH EDITOR. Sending one that does not opens a tab showing nothing,
 * which reads as broken content rather than as a missing editor - so a kind without one is routed
 * to whatever surface can actually show it, before anything is sent.
 *
 * THE SET IS EMPTY NOW, AND THE SEAM STAYS. Drawings were here until the Workbench gained an editor
 * for them; they now open like any other piece, which is the point of having made them pieces.
 * Deleting the split would only mean rediscovering it the next time a kind arrives before its
 * editor does - which is the normal order, since a kind has to exist before anything can edit one.
 *
 * Its own file because index.tsx has a 500-line cap and this decision grows with the KINDS, not
 * with the Library's chrome - the same split cli.ts needed for the same reason.
 */
import type { StudioEntitySummary } from "../../app-contract";

/** Kinds the Workbench cannot edit, routed to their own surface instead. */
const DRAWN_ELSEWHERE = new Set<string>();

export interface SendRouting {
  /** pieces the Workbench can edit; empty when the batch was all drawings */
  readonly toWorkbench: StudioEntitySummary[];
  /** the drawing to open, when there is one; the viewer draws a single page */
  readonly toViewer: StudioEntitySummary | null;
  /** drawings beyond the first, which are staged but not opened */
  readonly deferred: number;
}

/** Decide where a staged batch goes, without sending anything. */
export function routeSend(batch: readonly StudioEntitySummary[]): SendRouting {
  const drawings = batch.filter((piece) => DRAWN_ELSEWHERE.has(piece.kind));
  return {
    toWorkbench: batch.filter((piece) => !DRAWN_ELSEWHERE.has(piece.kind)),
    toViewer: drawings[0] ?? null,
    deferred: Math.max(0, drawings.length - 1),
  };
}

/** What to say after routing, so a batch that only half-opened does not look like it all did. */
export function sendStatus(routing: SendRouting): string | null {
  if (!routing.toViewer) return null;
  return routing.deferred > 0
    ? `opened ${routing.toViewer.name} · ${routing.deferred} more drawing(s) open one at a time`
    : `opened ${routing.toViewer.name}`;
}
