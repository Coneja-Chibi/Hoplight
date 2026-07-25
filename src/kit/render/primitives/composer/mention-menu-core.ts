/**
 * Pure composer mention matching and insertion. The visible query is friendly (`@basil`); selecting
 * a row writes the stable stored marker (`@character:basil-1`) used by replay-safe transcript cards.
 */
import type { EntitySummary } from "../../../bridge";

const TRAILING_MENTION = /(?:^|\s)(@[^\s@]*)$/;

export const mentionDraft = (text: string): string => {
  const match = text.match(TRAILING_MENTION);
  const draft = match?.[1] ?? "";
  return draft.includes(":") ? "" : draft;
};

export const matchingPieces = (
  pieces: readonly EntitySummary[],
  draft: string,
): EntitySummary[] => {
  if (!draft.startsWith("@") || draft.includes(":")) return [];
  const query = draft.slice(1).toLowerCase();
  return pieces
    .filter((piece) =>
      !query
      || piece.name.toLowerCase().includes(query)
      || piece.kind.toLowerCase().startsWith(query)
      || piece.id.toLowerCase().startsWith(query)
    )
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 8);
};

export const applyMention = (text: string, piece: EntitySummary): string => {
  const draft = mentionDraft(text);
  if (!draft) return text;
  return `${text.slice(0, text.length - draft.length)}@${piece.kind}:${piece.id} `;
};
