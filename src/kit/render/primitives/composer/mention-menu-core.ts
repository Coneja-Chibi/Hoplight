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

/**
 * The rows `@` may offer: the person's collections, then their pieces.
 *
 * GROUPS ARE NOT PIECES and are only ever joined here. Counted among pieces they would inflate the
 * deck totals, and the empty-composer suggestion reads the first piece by name - so a group called
 * The Cast would have the terminal opening with "try: inspect The Cast for gaps" about something
 * that cannot be inspected. Groups come first because there are a handful against a studio's worth
 * of pieces, so a name that matches one is the more specific thing to have meant.
 */
export const mentionRows = (
  pieces: readonly EntitySummary[],
  groups: readonly EntitySummary[],
): readonly EntitySummary[] => (groups.length === 0 ? pieces : [...groups, ...pieces]);

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
