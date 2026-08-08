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

/**
 * A name with the punctuation taken out, for matching only.
 *
 * PEOPLE DO NOT TYPE THE PUNCTUATION IN THEIR OWN FILENAMES. A preset called
 * "The H.T. Files - Paramnesia V.4" is `v.4`, and `"v.4".includes("v4")` is false - so typing `@v4`
 * offered every OTHER v4 preset in the studio and silently hid that one. The piece was indexed, on
 * screen in the Library, and unreachable from the composer, which reads as the file not being there.
 *
 * Decoration counts too: these names carry sparkles and mirrors around the words, and nobody is
 * going to type those to reach their own preset.
 */
const bare = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "");

export const matchingPieces = (
  pieces: readonly EntitySummary[],
  draft: string,
): EntitySummary[] => {
  if (!draft.startsWith("@") || draft.includes(":")) return [];
  const query = draft.slice(1).toLowerCase();
  const plain = bare(query);
  return pieces
    .filter((piece) =>
      !query
      || piece.name.toLowerCase().includes(query)
      || piece.kind.toLowerCase().startsWith(query)
      || piece.id.toLowerCase().startsWith(query)
      /**
       * The forgiving pass, ADDED rather than substituted: every match that worked before still
       * works, and a query that only differs by punctuation now lands too. Guarded on a non-empty
       * `plain` so `@.` does not suddenly match the entire studio.
       */
      || (plain !== "" && (bare(piece.name).includes(plain) || bare(piece.id).includes(plain)))
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
