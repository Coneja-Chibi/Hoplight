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
 * extracted lorebook's own original so a re-embed can overlay onto its twin and re-emit unedited
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
import { wireId } from "./character-book-id";
import {
  parseSelectiveLogic,
  selectiveLogicToNumber,
  parseRole,
  roleToNumber,
  parseCharacterFilter,
} from "./lore-enums";

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

/** Present-or-absent read: the value if the wire actually carried this typed key, else undefined (the
 * format has no such field). Distinct from boolOr, which manufactures a default the wire never stated. */
const presentBool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
const presentNum = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const presentStr = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

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

/**
 * Decode a character_book keyword, honoring an entry-level `use_regex` force flag. Exported because
 * the Risu native lorebook (risu/lorebook.ts) shares this exact `/pattern/flags` + use_regex dialect,
 * so both paths canonicalize a keyword identically (see the container-invariance contract there).
 */
export function keywordToTrigger(raw: string, forceRegex: boolean): Trigger {
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

export function entryToCanonical(entry: CharacterBookEntry, index: number): LorebookEntry {
  const ext = (entry.extensions ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]): unknown =>
    firstDefined(...keys.flatMap((k) => [ext[k], (entry as Record<string, unknown>)[k]]));

  // Risu stashes its activation chance under `extensions.risu_activationPercent` (it is the same
  // probability axis, per LOREBOOK-FORMATS.md), so read it too or an embedded Risu book loses it.
  const useProbability = pick("useProbability", "use_probability");
  const rawProbability =
    useProbability === false ? 100 : numOr(pick("probability", "risu_activationPercent"), 100);
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

    // insertion_order IS placement -> sortOrder (`order` is a tolerant fallback for ST-flavored books).
    // ST's cosmetic displayIndex, if stashed in extensions, has no canonical slot and rides the twin.
    sortOrder: numOr(firstDefined(entry.insertion_order, pick("order")), index),
    priority: numOr(entry.priority, 100), // CCv3 `priority` IS eviction -> canonical priority

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

    characterFilter: parseCharacterFilter(pick("characterFilter", "character_filter")),

    scanCharacterDescription: boolOr(pick("matchCharacterDescription", "scanCharacterDescription"), false),
    scanCharacterPersonality: boolOr(pick("matchCharacterPersonality", "scanCharacterPersonality"), false),
    scanUserPersona: boolOr(pick("matchPersonaDescription", "scanUserPersona"), false),
    scanScenario: boolOr(pick("matchScenario", "scanScenario"), false),
    scanCharacterDepthPrompt: presentBool(pick("matchCharacterDepthPrompt", "scanCharacterDepthPrompt")),
    scanCreatorNotes: presentBool(pick("matchCreatorNotes", "scanCreatorNotes")),

    ignoreBudget: boolOr(pick("ignoreBudget", "ignore_budget"), false),

    // Authored ST-lineage toggles, first-classed (were original-only residue). presentX keeps undefined when
    // the book has no such key, so a byte-identical twin overlay never manufactures a default.
    vectorized: presentBool(pick("vectorized")),
    groupOverride: presentBool(pick("groupOverride", "group_override")),
    useGroupScoring: presentBool(pick("useGroupScoring", "use_group_scoring")),
    automationId: presentStr(pick("automationId", "automation_id")) ?? undefined,
    displayIndex: presentNum(pick("displayIndex", "display_index")),

    // sideEffects: no verified producer authors it on the embedded character_book dialect (the standalone
    // ST worldbook codec maps it where it is a real file field). Wire-gate: leave null until a producer appears.
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
export const isCharacterBook = (v: unknown): v is CharacterBook =>
  !!v && typeof v === "object" && Array.isArray((v as { entries?: unknown }).entries);

/**
 * Standalone CCv3/Chub-style book: entries is an array of objects with `keys` (not Agnai's
 * `keywords`/`entry` MemoryBook, and not ST's keyed object map). Used so ST/Agnai/Risu standalone
 * codecs can accept Chub lorebook downloads and card-extracted books.
 */
export function isStandaloneCharacterBook(v: unknown): v is CharacterBook {
  if (!isCharacterBook(v)) return false;
  const first = v.entries[0] as Record<string, unknown> | undefined;
  if (!first || typeof first !== "object") {
    // empty book: still a character_book if it has the usual book-level fields
    return "scan_depth" in v || "token_budget" in v || "name" in v || v.entries.length === 0;
  }
  // Agnai MemoryBook entries use `entry` + `keywords`; CCv3 uses `keys` (+ usually `content`)
  if (Array.isArray(first.keywords) && typeof first.entry === "string") return false;
  return (
    Array.isArray(first.keys) ||
    typeof first.content === "string" ||
    typeof first.name === "string"
  );
}

/**
 * Locate an embedded character_book on a raw card. Honors the CCv3 slot (`data.character_book`),
 * the CCv2 convention (`data.extensions.character_book`), and the flat V1 shapes, returning the raw
 * book verbatim (not yet mapped) so the caller controls original.
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
 * in the lorebook's own original (keyed by the dialect, not the host format) so a re-embed can overlay
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
    original: { "character-book": { raw: book } },
  };
}

