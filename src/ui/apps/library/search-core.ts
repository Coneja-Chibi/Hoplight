/**
 * The Library's search: parse what somebody typed, then RANK the studio against it. Pure, no DOM,
 * no fetch - the room holds the box and the shelf, this file holds the meaning.
 *
 * WHY A GRAMMAR AND NOT JUST A CONTAINS BOX. A studio here is 164 pieces with 142 of them presets.
 * A plain substring filter over that answers "which of these thousand words did you mean" with a
 * shrug: everything that happens to contain your letters, in whatever order the disk handed them
 * over. So this does two things a filter does not. It understands FIELDS, so you can say which part
 * of a piece you meant, and it RANKS, so the thing you actually typed the name of is first rather
 * than eleventh.
 *
 * THE SYNTAX IS `field:value`, and that is a deliberate borrow rather than an invention. Every
 * search box a person arrives here already knowing - GitHub, Gmail, the editor they code in - uses
 * exactly this shape, and the studio's own read tools already speak in `kind=lorebook&id=...`
 * key-value pairs. A second grammar (slashes, dashes, a query language) would be one more thing to
 * learn for nothing gained.
 *
 * THE FIELDS, and why each one earns its place:
 *   (bare)   free text over name, id, lorebook trigger keywords, the source chip, and provenance
 *   name:    the name ONLY, for when a piece's id or its keywords keep dragging in noise
 *   id:      the id ONLY, which is what an error message or a docs page quotes at you
 *   kind:    one deck (aliased `deck:`, because every label in this room says deck)
 *   from:    where the piece came from, matched against the words its source chip actually wears
 *   has:     facts a piece either has or does not: `art`, `source`, `keys`
 *   collection: one of the person's own groupings, by its id (aliased `in:`)
 * Any term may be negated with a leading `-` (`-has:art`), terms AND together, and a "quoted
 * phrase" stays one term so a name with a space in it is searchable as itself.
 *
 * WHAT IS DELIBERATELY ABSENT: date terms (`before:`/`after:`). `importedAt` is optional on the
 * wire and nothing in this room displays it, so a date filter would silently drop every piece whose
 * date never got written and there would be nothing on screen to explain why. A filter you cannot
 * see the input of is a filter that lies.
 */
import { deckMeta } from "../../_shared/decks";

/**
 * What this core needs to know about a piece. StudioEntitySummary already satisfies it; the room
 * adds the three things a summary cannot know by itself (the words on the source chip, a lorebook's
 * trigger keywords) before handing pieces over.
 */
export interface SearchablePiece {
  id: string;
  kind: string;
  name: string;
  sourceFormat?: string;
  sourceVariant?: string;
  /** the words the piece's own source chip wears ("RoleCall · V3"), already resolved by the room */
  sourceLabel?: string | null;
  provenance?: string;
  hasPortrait?: boolean;
  /** a lorebook's trigger keywords (lore-shelf-ops already loads them for the shelf) */
  searchKeys?: readonly string[];
  /**
   * The ids of the person's collections this piece is in, resolved by the room.
   *
   * A piece cannot know this about itself - membership lives in collections.json and belongs to the
   * person, not to the piece - which is exactly why it arrives the same way a lorebook's keywords
   * do: attached by the room before the search runs.
   */
  collections?: readonly string[];
}

export type SearchField = "text" | "name" | "id" | "kind" | "from" | "has" | "collection";

export interface SearchTerm {
  field: SearchField;
  /** already lowercased; matching is case-insensitive everywhere */
  value: string;
  /** a leading `-`: this term must NOT match */
  negated: boolean;
}

export interface ParsedQuery {
  terms: readonly SearchTerm[];
  /**
   * Is this query asking for anything?
   *
   * THE ONE FIELD THE ROOM BRANCHES ON, and it exists so nothing has to re-derive it. An empty
   * shelf and a shelf filtered down to nothing are the same picture and completely different
   * facts: one means "make your first character", the other means "your character is here, you
   * just typed something it does not match". This repo has been bitten by that exact confusion
   * before (see the loadFailed split in index.tsx, and the "not an empty studio" note beside it),
   * so the distinction is a value the core returns, not a guess the JSX makes.
   */
  active: boolean;
  /**
   * Bits of the query this room did not recognise, ready to be shown back.
   *
   * An unknown FIELD is searched as plain text instead of being rejected, because names contain
   * colons: "Chapter 2: The Fall" would otherwise parse `2:` as a field and quietly return
   * nothing. An unknown `has:` FACET matches nothing instead, because there is no sane text
   * fallback for it and guessing which fact somebody meant hands back the wrong shelf silently.
   * Either way the hint says what happened.
   */
  unknown: readonly string[];
}

export interface SearchHit<T extends SearchablePiece> {
  piece: T;
  /** higher is a better match; 0 means the piece passed a filter but nothing ranked it */
  score: number;
}

/** `deck:` is an alias for `kind:` because every label in this room says deck, never kind. */
const FIELDS: Readonly<Record<string, SearchField>> = {
  name: "name",
  id: "id",
  kind: "kind",
  deck: "kind",
  from: "from",
  has: "has",
  collection: "collection",
  // `in:the-cast` is how people say it out loud, and it is three characters instead of eleven.
  in: "collection",
};

/** `has:` facets, with the words somebody might reasonably reach for pointing at the same fact. */
const FACETS: Readonly<Record<string, "art" | "source" | "keys">> = {
  art: "art",
  portrait: "art",
  image: "art",
  picture: "art",
  source: "source",
  import: "source",
  imported: "source",
  keys: "keys",
  keyword: "keys",
  keywords: "keys",
  trigger: "keys",
  triggers: "keys",
};

/**
 * The ranking tiers.
 *
 * WHY TIERS AND NOT A SIMILARITY SCORE: the ordering has to be explainable out loud ("exact name
 * first, then names that start with it, then names with it as a word, then anything containing
 * it"), because a shelf that reorders for reasons nobody can state is a shelf people stop
 * trusting. The gaps are wide on purpose so no pile of weak matches can climb into a strong tier.
 */
const TIER = {
  nameExact: 1000,
  namePrefix: 700,
  nameWord: 500,
  nameContains: 300,
  idExact: 260,
  idPrefix: 200,
  keyExact: 180,
  idContains: 120,
  keyContains: 90,
  source: 60,
  provenance: 40,
  /**
   * A second matching term is a TIEBREAK, never a tier jump. Two incidental substrings must not
   * outrank one exact name: that is precisely how a 142-preset deck buries the thing you typed.
   */
  extraTerm: 10,
} as const;

/**
 * Split a raw query into tokens, keeping "quoted phrases" whole.
 *
 * An UNTERMINATED quote runs to the end of the input rather than being rejected. Somebody typing
 * `"blue ey` is mid-word, and a parser that refuses to answer until the closing quote arrives makes
 * the shelf blink empty on every phrase search.
 */
function tokenize(raw: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (const ch of raw) {
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && /\s/.test(ch)) {
      if (current) out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current) out.push(current);
  return out;
}

/** Parse a raw query box into terms. Never throws: every input is a search for something. */
export function parseQuery(raw: string): ParsedQuery {
  const terms: SearchTerm[] = [];
  const unknown: string[] = [];
  for (const token of tokenize(raw)) {
    // A lone "-" is a search for a hyphen, not a negation of nothing.
    const negated = token.startsWith("-") && token.length > 1;
    const body = negated ? token.slice(1) : token;
    const colon = body.indexOf(":");
    const head = colon > 0 ? body.slice(0, colon).toLowerCase() : "";
    const field = head ? FIELDS[head] : undefined;
    if (!field) {
      const value = body.slice(colon + 1).toLowerCase();
      // Only complain about something that LOOKS like a field somebody meant: a word of letters
      // with a value after it. "Chapter 2:" and "Re:" are punctuation in a name, not a typo.
      if (/^[a-z]{2,}$/.test(head) && value.length > 0) unknown.push(`${head}:`);
      terms.push({ field: "text", value: body.toLowerCase(), negated });
      continue;
    }
    const value = body.slice(colon + 1).toLowerCase();
    // A field with nothing after it yet ("kind:") is somebody mid-type. Dropping the term shows
    // the whole deck; treating it as "matches nothing" would blank the shelf between keystrokes.
    if (!value) continue;
    if (field === "has" && !FACETS[value]) unknown.push(`has:${value}`);
    terms.push({ field, value, negated });
  }
  return { terms, active: terms.length > 0, unknown };
}

// -- matching ---------------------------------------------------------------------------------

/**
 * Score a name against one value, 0 when it does not contain it at all.
 *
 * The word-boundary tier is the one worth explaining: a match that STARTS a word ("the great WAR")
 * reads as something somebody meant, while one buried mid-word ("softWARe") is an accident of
 * spelling. Both are real matches and both are kept, but only one of them belongs near the top.
 */
function nameScore(name: string, value: string): number {
  const n = name.toLowerCase();
  if (n === value) return TIER.nameExact;
  if (n.startsWith(value)) return TIER.namePrefix;
  const at = n.indexOf(value);
  if (at < 0) return 0;
  const before = n.charAt(at - 1);
  return /[a-z0-9]/.test(before) ? TIER.nameContains : TIER.nameWord;
}

function idScore(id: string, value: string): number {
  const i = id.toLowerCase();
  if (i === value) return TIER.idExact;
  if (i.startsWith(value)) return TIER.idPrefix;
  return i.includes(value) ? TIER.idContains : 0;
}

/** A lorebook's trigger keywords: what the book is ABOUT, which is often not what it is named. */
function keyScore(keys: readonly string[] | undefined, value: string): number {
  if (!keys || keys.length === 0) return 0;
  let best = 0;
  for (const key of keys) {
    const k = key.toLowerCase();
    if (k === value) return TIER.keyExact;
    if (k.includes(value)) best = TIER.keyContains;
  }
  return best;
}

const sourceWords = (piece: SearchablePiece): string =>
  `${piece.sourceLabel ?? ""} ${piece.sourceFormat ?? ""} ${piece.sourceVariant ?? ""}`.toLowerCase();

/**
 * Free text: the BEST of every place the value could sensibly live, not the first one checked.
 * A cascade would let a weak field short-circuit a strong one (an id that happens to contain the
 * value hiding the fact that a keyword matches it exactly).
 */
function textScore(piece: SearchablePiece, value: string): number {
  return Math.max(
    nameScore(piece.name, value),
    idScore(piece.id, value),
    keyScore(piece.searchKeys, value),
    sourceWords(piece).includes(value) ? TIER.source : 0,
    (piece.provenance ?? "").toLowerCase().includes(value) ? TIER.provenance : 0,
  );
}

/**
 * `kind:` accepts what the ROOM says, not only the internal kind string. The chips read "Sprite
 * packs" and "Regex sets", so `kind:sprite`, `kind:packs` and `kind:rgx` all have to land or the
 * field is a trivia quiz about names the user never sees.
 */
function matchesKind(kind: string, value: string): boolean {
  if (kind.startsWith(value)) return true;
  const meta = deckMeta(kind);
  return [meta.short, ...meta.plural.toLowerCase().split(/\s+/)].some((word) => word.startsWith(value));
}

function matchesFacet(piece: SearchablePiece, value: string): boolean {
  const facet = FACETS[value];
  // An unrecognised facet matches NOTHING (fail closed). It is already reported in `unknown`, so
  // the empty shelf comes with the reason attached rather than looking like a studio that is bare.
  if (!facet) return false;
  if (facet === "art") return piece.hasPortrait === true;
  if (facet === "source") return typeof piece.sourceFormat === "string" && piece.sourceFormat.length > 0;
  return (piece.searchKeys?.length ?? 0) > 0;
}

/** One term against one piece: a score, or null for "this term does not match". */
function termScore(piece: SearchablePiece, term: SearchTerm): number | null {
  switch (term.field) {
    case "text": {
      const score = textScore(piece, term.value);
      return score > 0 ? score : null;
    }
    case "name": {
      const score = nameScore(piece.name, term.value);
      return score > 0 ? score : null;
    }
    case "id": {
      const score = idScore(piece.id, term.value);
      return score > 0 ? score : null;
    }
    // The FILTER fields score zero on purpose. `kind:preset` says which pieces are eligible,
    // not which of them you meant, and adding a constant to every survivor would only make the
    // numbers harder to reason about while changing no order at all.
    case "kind":
      return matchesKind(piece.kind, term.value) ? 0 : null;
    case "from":
      return sourceWords(piece).includes(term.value) ? 0 : null;
    case "has":
      return matchesFacet(piece, term.value) ? 0 : null;
    /**
     * A filter like the rest, and scoring it would be actively wrong: everything in a collection is
     * there because the person put it there, so nothing in one is a better match than anything else.
     * Membership decides eligibility and the shelf keeps its own order.
     */
    case "collection":
      return piece.collections?.includes(term.value) === true ? 0 : null;
  }
}

/** Every term must be satisfied (AND). Returns null when the piece is out, else its score. */
function pieceScore(piece: SearchablePiece, terms: readonly SearchTerm[]): number | null {
  let best = 0;
  let positives = 0;
  for (const term of terms) {
    const score = termScore(piece, term);
    if (term.negated) {
      if (score !== null) return null;
      continue;
    }
    if (score === null) return null;
    if (score > 0) {
      positives++;
      if (score > best) best = score;
    }
  }
  return best + (positives > 1 ? (positives - 1) * TIER.extraTerm : 0);
}

/**
 * The whole search: which pieces survive, and in what order.
 *
 * THE SHELF IS ONLY REORDERED WHEN SOMETHING RANKED IT. An empty box, or a query that is pure
 * filtering (`kind:preset`, `has:art`), leaves the pieces in exactly the order they arrived. That
 * is one rule covering both cases, and it means turning a filter on never shuffles the shelf under
 * somebody's cursor - the pieces that stop matching leave, the rest do not move.
 *
 * The tiebreak chain is TOTAL, down to the id, and that is not pedantry. Ranking runs again on
 * every render of the room, and a comparator that returns 0 for two genuinely different pieces
 * lets them swap places when something unrelated repaints. A shelf you cannot find the same thing
 * on twice is worse than one that ranks slightly wrong.
 */
export function searchPieces<T extends SearchablePiece>(
  pieces: readonly T[],
  query: ParsedQuery,
): SearchHit<T>[] {
  const hits: SearchHit<T>[] = [];
  for (const piece of pieces) {
    const score = pieceScore(piece, query.terms);
    if (score !== null) hits.push({ piece, score });
  }
  if (!hits.some((hit) => hit.score > 0)) return hits;
  return hits.sort(
    (a, b) =>
      b.score - a.score
      // The same value fills more of a short name than a long one, so the tighter match leads.
      || a.piece.name.length - b.piece.name.length
      || a.piece.name.localeCompare(b.piece.name)
      || a.piece.kind.localeCompare(b.piece.kind)
      || a.piece.id.localeCompare(b.piece.id),
  );
}

/** Matches per deck, most matches first. Feeds the deck chips and the "it is on another shelf" jump. */
export function matchesByKind<T extends SearchablePiece>(
  hits: readonly SearchHit<T>[],
): { kind: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const hit of hits) counts.set(hit.piece.kind, (counts.get(hit.piece.kind) ?? 0) + 1);
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
}

/**
 * The one line that must never let an empty shelf and a filtered-to-nothing shelf read alike.
 *
 * It always says how many of how many, and when the answer is none it says so in words plus where
 * the matches actually are. "0" on its own is the failure mode this exists to prevent: it looks
 * identical to a deck nobody has put anything in yet.
 */
/** Every field this room understands, in the order the hint lists them. */
export const SEARCH_FIELD_HELP =
  "name: id: kind: from: has:art has:source has:keys collection:";

/**
 * Say out loud what the parser did not understand.
 *
 * A search box that silently reinterprets what somebody typed teaches them to distrust it. The two
 * cases end differently and so must be said differently: an unknown field was still SEARCHED (as
 * text), an unknown fact could not be, and only one of those explains an empty shelf.
 */
export function unknownHint(unknown: readonly string[]): string {
  if (unknown.length === 0) return "";
  const facets = unknown.filter((u) => u.startsWith("has:"));
  const fields = unknown.filter((u) => !u.startsWith("has:"));
  const parts: string[] = [];
  if (fields.length > 0) {
    parts.push(
      fields.length === 1
        ? `${fields[0] ?? ""} is not a field, so it was searched as plain text`
        : `${fields.join(" ")} are not fields, so they were searched as plain text`,
    );
  }
  if (facets.length > 0) {
    parts.push(
      facets.length === 1
        ? `${facets[0] ?? ""} is not something a piece can have, so nothing matches it`
        : `${facets.join(" ")} are not things a piece can have, so nothing matches them`,
    );
  }
  return `${parts.join(" · ")}. Try ${SEARCH_FIELD_HELP}`;
}

export function resultLine(input: {
  active: boolean;
  /** the active deck's display plural ("Presets") */
  deckPlural: string;
  /** matches on the shelf being looked at */
  shown: number;
  /** pieces in this deck, matching or not */
  deckTotal: number;
  /** matches sitting in OTHER decks, which is the whole reason a jump is offered */
  elsewhere: number;
}): string {
  const plural = input.deckPlural.toLowerCase();
  const elsewhere = input.elsewhere > 0 ? ` · ${String(input.elsewhere)} elsewhere` : "";
  if (!input.active) return "";
  if (input.shown > 0) return `${String(input.shown)} of ${String(input.deckTotal)} ${plural} match`;
  /**
   * THE SAME TRAP IN THE OTHER DIRECTION. A deck nobody has put anything in has nothing to hide,
   * so "no personas match" would blame the search for a shelf that was bare before anyone typed.
   * Guarding only one side of this pair is how it comes back.
   */
  if (input.deckTotal === 0) return `no ${plural} yet${elsewhere}`;
  if (input.elsewhere > 0) return `no ${plural} match${elsewhere}`;
  return "nothing in the studio matches";
}

/**
 * Which empty shelf is this: one a search emptied, or one that was always bare?
 *
 * The room renders a different thing for each (the no-match notice versus the ghost card that
 * invites a first import), and picking between them is exactly the judgement that must not be made
 * by eye in the JSX. `active` alone is not enough: a query typed while standing on a deck holding
 * nothing would otherwise produce "all 0 personas are still in the studio", which is the empty-
 * versus-filtered lie wearing the costume of the fix for it.
 */
export const isFilteredEmpty = (query: ParsedQuery, deckTotal: number): boolean =>
  query.active && deckTotal > 0;
