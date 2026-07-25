/**
 * Replay-safe parsing for canonical piece markers embedded in transcript prose. Only summaries that
 * still exist resolve; stale or malformed markers remain untouched text.
 */
import type { EntitySummary } from "../bridge";

export type MentionPart =
  | { type: "text"; text: string }
  | { type: "piece"; marker: string; piece: EntitySummary };

const MARKER = /@([a-z]+):([a-zA-Z0-9_-]+)/g;

export const parsePieceMentions = (
  text: string,
  pieces: readonly EntitySummary[],
): MentionPart[] => {
  const parts: MentionPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(MARKER)) {
    const index = match.index;
    const kind = match[1];
    const id = match[2];
    if (index === undefined || !kind || !id) continue;
    const piece = pieces.find((candidate) => candidate.kind === kind && candidate.id === id);
    if (!piece) continue;
    if (index > cursor) parts.push({ type: "text", text: text.slice(cursor, index) });
    const marker = match[0];
    parts.push({ type: "piece", marker, piece });
    cursor = index + marker.length;
  }
  if (cursor < text.length) parts.push({ type: "text", text: text.slice(cursor) });
  return parts.length > 0 ? parts : [{ type: "text", text }];
};
