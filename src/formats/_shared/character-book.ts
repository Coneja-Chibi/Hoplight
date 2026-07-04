/**
 * CCv2/v3 embedded `character_book` <-> canonical Lorebook mapper. This is a DIFFERENT wire dialect
 * than the standalone SillyTavern worldbook file (sillytavern/lorebook.ts): it uses CCv3 spec field
 * names at the entry top level (keys, secondary_keys, insertion_order, use_regex, position as the
 * coarse "before_char"/"after_char" string) and tucks the ST-extended fields (depth, role, group,
 * probability, sticky, selective_logic, scan sources, ...) into each entry's `extensions` bag. Every
 * such field is therefore read from BOTH the top level AND `entry.extensions` (first-defined wins,
 * extensions first), mirroring how real cards in the wild are shaped.
 *
 * Field map verified against VAUDEVILLE apps/rc character-book.ts fromCharacterBook/toCharacterBook
 * (interop facts only: names, coercions, defaults - not code). The whole raw book rides in the
 * extracted lorebook's own escrow so a re-embed can overlay onto its twin and re-emit unedited
 * entries byte-for-byte, and so decorators / per-entry extension residue survive even when the
 * lorebook is later written out standalone.
 */
import type {
  CanonicalLorebook,
  LorebookBody,
  LorebookEntry,
  Trigger,
  InjectionPosition,
} from "../../entities/lorebook/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { parseSelectiveLogic, selectiveLogicToNumber, parseRole, roleToNumber } from "./lore-enums";

// -- interop wire shapes (CCv3 character_book) -----------------------------------------------------

/** One embedded character_book entry. Core fields at top level; ST extras hide in `extensions`. */
export interface CharacterBookEntry {
  keys: string[];
  secondary_keys?: string[];
  comment?: string;
  content: string;
  constant?: boolean;
  selective?: boolean;
  insertion_order?: number;
  enabled?: boolean;
  position?: "before_char" | "after_char" | number | string;
  use_regex?: boolean;
  case_sensitive?: boolean;
  name?: string;
  priority?: number;
  id?: number | string;
  extensions?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions?: Record<string, unknown>;
  entries: CharacterBookEntry[];
  [k: string]: unknown;
}

// -- coercion helpers ------------------------------------------------------------------------------

/** First value that was actually supplied (undefined = "not present here, look elsewhere"). */
const firstDefined = (...vals: unknown[]): unknown => vals.find((v) => v !== undefined);

const numOr = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const optionalNum = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const boolOr = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);

const optionalBool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

/** A recursion-delay may arrive as a number, or as `true` meaning "one step". */
const parseRecursionDelay = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : v === true ? 1 : 0;

// -- position (character_book dialect: string OR ST int, extensions wins) --------------------------

/**
 * character_book positions: the CCv3 top level carries the coarse "before_char"/"after_char" string,
 * while ST stashes the precise slot (int, or a richer string) under extensions.position. Extensions
 * wins when present. ST ints: 0 world, 1 character, 2 before_example, 3 after_example, 4 depth.
 */
function parseBookPosition(entryPosition: unknown, extensionPosition: unknown): InjectionPosition {
  const raw = firstDefined(extensionPosition, entryPosition);
  if (typeof raw === "number") {
    return raw === 0
      ? "world"
      : raw === 2
        ? "before_example"
        : raw === 3
          ? "after_example"
          : raw === 4
            ? "depth"
            : "character";
  }
  if (
    raw === "world" ||
    raw === "character" ||
    raw === "before_example" ||
    raw === "after_example" ||
    raw === "depth" ||
    raw === "scene"
  ) {
    return raw;
  }
  return raw === "before_char" ? "world" : "character";
}

// -- keyword <-> trigger (character_book dialect: /pattern/flags, gimsuvy, non-greedy) --------------

/** Decode a character_book keyword, honoring an entry-level `use_regex` force flag. */
function keywordToTrigger(raw: string, forceRegex: boolean): Trigger {
  const m = /^\/([\w\W]+?)\/([gimsuvy]*)$/.exec(raw.trim());
  if (m) {
    const t: Trigger = { keyword: (m[1] ?? "").replace(/\\\//g, "/"), isRegex: true };
    if (m[2]) t.flags = m[2];
    return t;
  }
  return { keyword: raw, isRegex: forceRegex };
}

const keywordsToTriggers = (arr: unknown, forceRegex: boolean, probability: number): Trigger[] =>
  Array.isArray(arr)
    ? arr
        .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
        .map((k) => {
          const t = keywordToTrigger(k, forceRegex);
          return probability !== 100 ? { ...t, probability } : t;
        })
    : [];

// -- entry: character_book -> canonical ------------------------------------------------------------

function entryToCanonical(entry: CharacterBookEntry, index: number): LorebookEntry {
  const ext = (entry.extensions ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]): unknown =>
    firstDefined(...keys.flatMap((k) => [ext[k], (entry as Record<string, unknown>)[k]]));

  const useProbability = pick("useProbability", "use_probability");
  const rawProbability = useProbability === false ? 100 : numOr(pick("probability"), 100);
  const probability = Math.min(100, Math.max(0, rawProbability));

  const forceRegex = entry.use_regex === true;
  const triggers = keywordsToTriggers(entry.keys, forceRegex, probability);
  const secondaryTriggers = keywordsToTriggers(entry.secondary_keys, forceRegex, probability);
  const groupName = pick("group", "group_name");

  return {
    id: entry.id != null ? String(entry.id) : String(index),
    title: typeof entry.name === "string" && entry.name ? entry.name : `Entry ${index + 1}`,
    content: typeof entry.content === "string" ? entry.content : "",
    comment: typeof entry.comment === "string" ? entry.comment : null,

    enabled: entry.enabled !== false,
    constant: entry.constant === true,

    triggerMode: entry.selective === true || secondaryTriggers.length > 0 ? "advanced" : "simple",
    triggers,
    secondaryTriggers,
    selectiveLogic: parseSelectiveLogic(pick("selectiveLogic", "selective_logic")),

    caseSensitive: optionalBool(firstDefined(entry.case_sensitive, ext.caseSensitive, ext.case_sensitive)),
    matchWholeWords: optionalBool(pick("matchWholeWords", "match_whole_words")),
    scanDepth: optionalNum(pick("scanDepth", "scan_depth")),

    position: parseBookPosition(entry.position, ext.position),
    depth: numOr(pick("depth"), 4),
    role: parseRole(pick("role")),

    sortOrder: numOr(firstDefined(ext.displayIndex, ext.display_index, entry.insertion_order), index),
    priority: entry.priority ?? numOr(pick("order"), 100),

    sticky: numOr(pick("sticky"), 0),
    cooldown: numOr(pick("cooldown"), 0),
    delay: numOr(pick("delay"), 0),

    groupName: typeof groupName === "string" && groupName ? groupName : null,
    categoryId: null,
    groupWeight: numOr(pick("groupWeight", "group_weight"), 1),

    probability,

    useMemo: boolOr(pick("addMemo", "use_memo"), false),
    excludeRecursion: boolOr(pick("excludeRecursion", "exclude_recursion"), false),
    preventRecursion: boolOr(pick("preventRecursion", "prevent_recursion"), false),
    delayUntilRecursion: parseRecursionDelay(pick("delayUntilRecursion", "delay_until_recursion")),

    characterFilter: null,

    scanCharacterDescription: boolOr(pick("matchCharacterDescription", "scanCharacterDescription"), false),
    scanCharacterPersonality: boolOr(pick("matchCharacterPersonality", "scanCharacterPersonality"), false),
    scanUserPersona: boolOr(pick("matchPersonaDescription", "scanUserPersona"), false),
    scanScenario: boolOr(pick("matchScenario", "scanScenario"), false),

    ignoreBudget: boolOr(pick("ignoreBudget", "ignore_budget"), false),

    sideEffects: null,
  };
}

// -- book: character_book -> canonical body --------------------------------------------------------

/** Map an embedded character_book to a canonical LorebookBody (import direction). */
export function characterBookToLorebook(book: CharacterBook): LorebookBody {
  return {
    name: typeof book.name === "string" && book.name ? book.name : "Imported Lorebook",
    description: typeof book.description === "string" ? book.description : null,
    lorebookType: "character",
    genre: null,
    fandom: null,
    tags: [],
    globalCaseSensitive: false,
    globalMatchWholeWords: false,
    globalScanDepth: numOr(book.scan_depth, 100),
    globalRecursion: book.recursive_scanning === true,
    tokenBudget: numOr(book.token_budget, 0),
    budgetMode: "token",
    entryBudget: 0,
    entries: Array.isArray(book.entries) ? book.entries.map(entryToCanonical) : [],
  };
}

// -- extraction: a raw CCv2/v3 card -> its embedded canonical lorebook (if any) --------------------

/** True if `v` is a character_book shape (an object with an `entries` array). */
const isCharacterBook = (v: unknown): v is CharacterBook =>
  !!v && typeof v === "object" && Array.isArray((v as { entries?: unknown }).entries);

/**
 * Locate an embedded character_book on a raw card. Honors the CCv3 slot (`data.character_book`),
 * the CCv2 convention (`data.extensions.character_book`), and the flat V1 shapes, returning the raw
 * book verbatim (not yet mapped) so the caller controls escrow.
 */
export function findCharacterBook(rawCard: unknown): CharacterBook | null {
  if (!rawCard || typeof rawCard !== "object") return null;
  const card = rawCard as Record<string, unknown>;
  const data = (card.data && typeof card.data === "object" ? card.data : card) as Record<string, unknown>;
  const dataExt = (data.extensions && typeof data.extensions === "object" ? data.extensions : {}) as Record<
    string,
    unknown
  >;
  const candidate = firstDefined(data.character_book, dataExt.character_book, card.character_book);
  return isCharacterBook(candidate) ? candidate : null;
}

/**
 * Extract a card's embedded character_book into a standalone CanonicalLorebook, stashing the raw book
 * in the lorebook's own escrow (keyed by the dialect, not the host format) so a re-embed can overlay
 * onto it. Returns null when the card carries no book.
 */
export function extractCharacterBook(rawCard: unknown): CanonicalLorebook | null {
  const book = findCharacterBook(rawCard);
  if (!book) return null;
  const body = characterBookToLorebook(book);
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "lorebook",
    id: canonicalId(body.name),
    body,
    escrow: { "character-book": { raw: book } },
  };
}

// -- canonical -> character_book (re-embed / export direction) -------------------------------------

const triggerToKeyword = (t: Trigger): string => (t.isRegex ? `/${t.keyword}/${t.flags ?? ""}` : t.keyword);

/** Precise ext.position value (inverse of parseBookPosition's int branch); RC-only slots collapse. */
const positionToExt = (p: InjectionPosition): number | string =>
  p === "world" || p === "prepend_top"
    ? 0
    : p === "before_example"
      ? 2
      : p === "after_example"
        ? 3
        : p === "depth" || p === "append" || p === "append_bottom"
          ? 4
          : p === "scene"
            ? "scene"
            : 1; // character

/** Coarse CCv3 top-level position string. */
const positionToCoarse = (p: InjectionPosition): "before_char" | "after_char" =>
  p === "world" || p === "before_example" || p === "prepend_top" || p === "scene" ? "before_char" : "after_char";

/** Structural equality for the small JSON values we diff (triggers, primitives). */
const deepEq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Re-encode a canonical entry into a character_book entry. With a raw twin present (same-dialect
 * round-trip) we overlay onto its clone and re-write ONLY the fields whose canonical value differs
 * from the twin's decode, so an unedited entry re-emits byte-for-byte and raw-only residue survives.
 * With no twin (cross-format: the lorebook came from a worldbook file, RC, or was authored) every
 * field is written from `body` alone - the path cross-format conversion actually exercises.
 */
function entryToBook(e: LorebookEntry, twin: CharacterBookEntry | undefined, index: number): CharacterBookEntry {
  const base: CharacterBookEntry = twin
    ? (structuredClone(twin) as CharacterBookEntry)
    : { keys: [], content: "" };
  const decoded = twin ? entryToCanonical(twin, index) : null;
  const ext = (base.extensions && typeof base.extensions === "object" ? base.extensions : {}) as Record<
    string,
    unknown
  >;
  base.extensions = ext;

  const changed = (field: keyof LorebookEntry): boolean => !decoded || !deepEq(e[field], decoded[field]);
  const setExt = (field: keyof LorebookEntry, key: string, val: unknown): void => {
    if (changed(field)) ext[key] = val;
  };

  // core CCv3 top-level fields
  if (changed("triggers")) base.keys = e.triggers.map(triggerToKeyword);
  if (changed("secondaryTriggers")) base.secondary_keys = e.secondaryTriggers.map(triggerToKeyword);
  if (changed("triggers") || changed("secondaryTriggers")) {
    // use_regex is an entry-level force flag: only whole-entry-regex sets it, else a literal keyword
    // would be force-promoted on re-parse. Mixed/regex keywords survive inline as `/pattern/flags`.
    const all = [...e.triggers, ...e.secondaryTriggers];
    base.use_regex = all.length > 0 && all.every((t) => t.isRegex);
    base.selective = e.secondaryTriggers.length > 0;
  }
  if (changed("content")) base.content = e.content;
  if (changed("title")) base.name = e.title;
  if (changed("comment")) base.comment = e.comment ?? undefined;
  if (changed("enabled")) base.enabled = e.enabled;
  if (changed("constant")) base.constant = e.constant;
  if (changed("sortOrder")) base.insertion_order = e.sortOrder;
  if (changed("priority")) base.priority = e.priority;
  if (changed("caseSensitive")) base.case_sensitive = e.caseSensitive ?? undefined;
  if (changed("position")) {
    base.position = positionToCoarse(e.position);
    ext.position = positionToExt(e.position);
  }

  // ST-extended fields -> extensions (pick() reads the extensions bag first)
  setExt("selectiveLogic", "selective_logic", selectiveLogicToNumber(e.selectiveLogic));
  setExt("depth", "depth", e.depth);
  setExt("role", "role", roleToNumber(e.role));
  setExt("scanDepth", "scan_depth", e.scanDepth);
  setExt("groupName", "group", e.groupName ?? "");
  setExt("groupWeight", "group_weight", e.groupWeight);
  setExt("sticky", "sticky", e.sticky);
  setExt("cooldown", "cooldown", e.cooldown);
  setExt("delay", "delay", e.delay);
  setExt("excludeRecursion", "exclude_recursion", e.excludeRecursion);
  setExt("preventRecursion", "prevent_recursion", e.preventRecursion);
  setExt("delayUntilRecursion", "delay_until_recursion", e.delayUntilRecursion);
  setExt("useMemo", "use_memo", e.useMemo);
  setExt("ignoreBudget", "ignore_budget", e.ignoreBudget);
  setExt("scanCharacterDescription", "matchCharacterDescription", e.scanCharacterDescription);
  setExt("scanCharacterPersonality", "matchCharacterPersonality", e.scanCharacterPersonality);
  setExt("scanUserPersona", "matchPersonaDescription", e.scanUserPersona);
  setExt("scanScenario", "matchScenario", e.scanScenario);
  if (changed("probability")) {
    ext.probability = e.probability;
    ext.useProbability = e.probability < 100;
  }

  if (Object.keys(ext).length === 0) delete base.extensions;
  if (twin == null && e.id != null) base.id = e.id;
  return base;
}

/**
 * Map ONE canonical lorebook back to an embedded character_book. `rawBook` is the twin from the
 * lorebook's OWN escrow (escrow-of-raw), NOT the host card - so same-dialect round-trips overlay and
 * cross-format encodes from scratch. Book-level fields diff against the twin's decode the same way.
 */
export function lorebookToCharacterBook(body: LorebookBody, rawBook?: CharacterBook): CharacterBook {
  const twinById = new Map<string, CharacterBookEntry>();
  (rawBook?.entries ?? []).forEach((en, i) => twinById.set(en.id != null ? String(en.id) : String(i), en));

  const base: CharacterBook = rawBook ? (structuredClone(rawBook) as CharacterBook) : { entries: [] };
  base.entries = body.entries.map((e, i) => entryToBook(e, twinById.get(e.id), i));

  const decoded = rawBook ? characterBookToLorebook(rawBook) : null;
  const bchanged = (f: keyof LorebookBody): boolean => !decoded || !deepEq(body[f], decoded[f]);
  if (bchanged("name")) base.name = body.name;
  if (bchanged("description")) base.description = body.description ?? undefined;
  if (bchanged("globalScanDepth")) base.scan_depth = body.globalScanDepth;
  if (bchanged("tokenBudget")) base.token_budget = body.tokenBudget;
  if (bchanged("globalRecursion")) base.recursive_scanning = body.globalRecursion;
  return base;
}

/**
 * Re-embed referenced lorebooks into a CCv3 card's `data` object, in place. Every CCv2/v3-family card
 * writer (SillyTavern, RoleCall, Risu) shares this: write the single book at `data.character_book` and
 * clear the `data.extensions.character_book` fallback so no stale duplicate survives. No-op for an
 * empty ref set. This is the export half of the bundle contract; import lives in extractCharacterBook.
 */
export function embedCharacterBook(data: Record<string, unknown>, lorebooks: CanonicalLorebook[]): void {
  const book = lorebooksToCharacterBook(lorebooks);
  if (!book) return;
  data.character_book = book;
  const ext = data.extensions;
  if (ext && typeof ext === "object") delete (ext as Record<string, unknown>).character_book;
}

/**
 * Resolve knowledge refs to a single embedded character_book (the format supports exactly one).
 * 1 -> 1 overlays/encodes that book. N -> 1 concatenates entries under the first book's settings and
 * records the source boundaries in `extensions.vaud_source_books` so the split is recoverable later
 * (rather than silently dropping refs). Returns null for an empty ref set.
 */
export function lorebooksToCharacterBook(lorebooks: CanonicalLorebook[]): CharacterBook | null {
  if (lorebooks.length === 0) return null;
  const rawOf = (l: CanonicalLorebook): CharacterBook | undefined =>
    l.escrow?.["character-book"]?.raw as CharacterBook | undefined;
  if (lorebooks.length === 1) return lorebookToCharacterBook(lorebooks[0]!.body, rawOf(lorebooks[0]!));

  const books = lorebooks.map((l) => lorebookToCharacterBook(l.body, rawOf(l)));
  return {
    ...books[0]!,
    entries: books.flatMap((b) => b.entries),
    extensions: {
      ...(books[0]!.extensions ?? {}),
      vaud_source_books: lorebooks.map((l, i) => ({ name: l.body.name, entryCount: books[i]!.entries.length })),
    },
  };
}
