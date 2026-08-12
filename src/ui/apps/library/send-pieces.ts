/**
 * Where a batch of staged pieces actually goes.
 *
 * NOT EVERY PIECE HAS A WORKBENCH EDITOR. A drawing (htmldoc) is rendered by the HTML View tab and
 * by nothing else, so sending one to the Workbench opens a tab that shows nothing - which reads as
 * a broken drawing rather than as a surface that was never built for it. Split by destination
 * before anything is sent.
 *
 * Its own file because index.tsx has a 500-line cap and this is a routing decision that will grow
 * with the KINDS, not with the Library's chrome - the same split cli.ts needed for the same reason.
 */
import type { StudioEntitySummary } from "../../app-contract";

/** Kinds the Workbench has no editor for, routed to their own surface instead. */
const DRAWN_ELSEWHERE = new Set(["htmldoc"]);

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
