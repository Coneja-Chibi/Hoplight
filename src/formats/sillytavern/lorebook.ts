/**
 * SillyTavern world-info (worldbook) codec. Reads a standalone ST worldbook `.json`
 * ({ entries: { "0": {...} }, name, scan_depth, ... }) into the canonical Lorebook and back.
 * Field map + int-enum decode verified against VAUDEVILLE packages/lorebook parser.ts (parseSTEntry,
 * parsePosition/parseRole/parseSelectiveLogic) + serializer.ts (interop facts only).
 *
 * ST encodes richer canonical positions lossily (append/append_bottom -> @depth 4, prepend_top -> 0)
 * and drops per-trigger probability; that loss is inherent to ST and is what original-of-raw guards:
 * an unedited entry re-projects from its raw twin, so a vaud round-trip is byte-lossless. ST's two
 * extra scan sources (matchCharacterDepthPrompt, matchCreatorNotes) and uid ride original untouched.
 *
 * NOTE: standalone codec, not yet registry-wired (same wiring step as the RC lorebook codec).
 */
import type { LorebookAdapter, AdapterInput, AdapterOutput } from "../../core/adapter";
import type {
  CanonicalLorebook,
  LorebookBody,
  LorebookEntry,
  Trigger,
  InjectionPosition,
} from "../../entities/lorebook/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonObject } from "../_shared/card-io";
import {
  characterBookToLorebook,
  isStandaloneCharacterBook,
  type CharacterBook,
} from "../_shared/character-book";
import {
  parseSelectiveLogic,
  selectiveLogicToNumber,
  parseRole,
  roleToNumber,
  parseCharacterFilter,
} from "../_shared/lore-enums";

interface StBook {
  entries?: Record<string, Record<string, unknown>>;
  [k: string]: unknown;
}

/** Parse untrusted json into an ST worldbook, or null if it is not one. */
function readBook(input: AdapterInput): StBook | null {
  const book = readJsonObject(input) as StBook | null;
  if (!book) return null;
  const entries = book.entries;
  // ST worldbook: `entries` is a keyed OBJECT (not an array - that would be RC/Agnai) of ST entries.
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) return null;
  const first = Object.values(entries)[0] as Record<string, unknown> | undefined;
  if (!first || typeof first !== "object") return null;
  const looksSt = "key" in first || "keysecondary" in first || "comment" in first || "content" in first;
  return looksSt ? book : null;
}

// -- position + regex-keyword decoders (worldbook-file dialect; selectiveLogic/role are in _shared) --

/** ST numeric positions: 0 before-char, 1 after-char, 2 before-example, 3 after-example, 4 @depth. */
function parsePosition(v: unknown): InjectionPosition {
  switch (v) {
    case 0:
      return "world";
    case 2:
      return "before_example";
    case 3:
      return "after_example";
    case 4:
      return "depth";
    default:
      return "character";
  }
}

/** Inverse of parsePosition; the RC-only positions collapse to their closest ST slot. */
function positionToNumber(p: InjectionPosition): number {
  switch (p) {
    case "world":
    case "prepend_top":
      return 0;
    case "before_example":
    case "scene":
      return 2;
    case "after_example":
      return 3;
    case "depth":
    case "append":
    case "append_bottom":
      return 4;
    default:
      return 1;
  }
}

/** A keyword may carry an inline regex as `/pattern/flags`; decode it to a structured Trigger. */
function keywordToTrigger(raw: string): Trigger {
  const m = /^\/(.+)\/([dgimsuy]*)$/.exec(raw);
  if (m) {
    const t: Trigger = { keyword: m[1] ?? "", isRegex: true };
    if (m[2]) t.flags = m[2];
    return t;
  }
  return { keyword: raw, isRegex: false };
}

const keywordsToTriggers = (arr: unknown): Trigger[] =>
  Array.isArray(arr)
    ? arr.filter((k): k is string => typeof k === "string" && k.trim().length > 0).map(keywordToTrigger)
    : [];

/** Escape unescaped slashes so a regex pattern survives the `/pattern/flags` wrapper. */
const escapeSlashes = (pattern: string): string => pattern.replace(/(?<!\\)\//g, "\\/");

const triggerToKeyword = (t: Trigger): string =>
  t.isRegex ? `/${escapeSlashes(t.keyword)}/${t.flags ?? ""}` : t.keyword;

// -- present-or-absent reads (undefined = ST worldbook did not carry this typed key) ---------------

const presentBool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
const presentNum = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const presentStr = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

// -- entry <-> wire --------------------------------------------------------------------------------

function entryToCanonical(raw: Record<string, unknown>, index: number): LorebookEntry {
  const enabled = raw.disable !== undefined ? raw.disable !== true : raw.enabled !== false;
  const useProb = raw.useProbability !== false;
  const probability =
    useProb && typeof raw.probability === "number" ? Math.min(100, Math.max(0, raw.probability)) : 100;

  return {
    id: raw.uid != null ? String(raw.uid) : String(index),
    title: typeof raw.comment === "string" && raw.comment ? raw.comment : `Entry ${index + 1}`,
    content: typeof raw.content === "string" ? raw.content : "",
    comment: null, // ST has no internal-note field distinct from the title

    enabled,
    constant: raw.constant === true,

    triggerMode: "simple", // ST has no per-trigger probability
    triggers: keywordsToTriggers(raw.key),
    secondaryTriggers: keywordsToTriggers(raw.keysecondary),
    selectiveLogic: parseSelectiveLogic(raw.selectiveLogic),

    caseSensitive: (raw.caseSensitive as boolean | null | undefined) ?? null,
    matchWholeWords: (raw.matchWholeWords as boolean | null | undefined) ?? null,
    scanDepth: typeof raw.scanDepth === "number" ? raw.scanDepth : null,

    position: parsePosition(raw.position),
    depth: typeof raw.depth === "number" ? raw.depth : 4,
    role: parseRole(raw.role),

    // ST `order` IS the placement axis (insertion order) -> canonical sortOrder. ST has no eviction
    // field, so priority defaults; ST's cosmetic `displayIndex` has no canonical slot and rides original.
    sortOrder: typeof raw.order === "number" ? raw.order : index,
    priority: 100,

    sticky: typeof raw.sticky === "number" ? raw.sticky : 0,
    cooldown: typeof raw.cooldown === "number" ? raw.cooldown : 0,
    delay: typeof raw.delay === "number" ? raw.delay : 0,

    groupName: typeof raw.group === "string" && raw.group ? raw.group : null,
    categoryId: null, // ST has no categories
    groupWeight: typeof raw.groupWeight === "number" ? raw.groupWeight : 1,

    probability,

    useMemo: raw.addMemo === true,
    excludeRecursion: raw.excludeRecursion === true,
    preventRecursion: raw.preventRecursion === true,
    delayUntilRecursion: typeof raw.delayUntilRecursion === "number" ? raw.delayUntilRecursion : 0,

    characterFilter: parseCharacterFilter(raw.characterFilter),

    scanCharacterDescription: raw.matchCharacterDescription === true,
    scanCharacterPersonality: raw.matchCharacterPersonality === true,
    scanUserPersona: raw.matchPersonaDescription === true,
    scanScenario: raw.matchScenario === true,
    scanCharacterDepthPrompt: presentBool(raw.matchCharacterDepthPrompt),
    scanCreatorNotes: presentBool(raw.matchCreatorNotes),

    ignoreBudget: raw.ignoreBudget === true,

    // Authored ST toggles, de-kept to first-class slots (present-or-absent so a cross-format book
    // that never had them stays clean). displayIndex is a DISTINCT authored axis from `order`/sortOrder.
    vectorized: presentBool(raw.vectorized),
    groupOverride: presentBool(raw.groupOverride),
    useGroupScoring: presentBool(raw.useGroupScoring),
    automationId: presentStr(raw.automationId),
    displayIndex: presentNum(raw.displayIndex),

    sideEffects: (raw.sideEffects as LorebookEntry["sideEffects"]) ?? null,
  };
}

/** Overlay a canonical entry onto a clone of its raw ST twin, re-encoding the fields ST owns. */
function entryToWire(e: LorebookEntry, raw: Record<string, unknown> | undefined): Record<string, unknown> {
  const wire: Record<string, unknown> = { ...(raw ? structuredClone(raw) : {}) };
  wire.comment = e.title;
  wire.content = e.content;
  wire.disable = !e.enabled;
  delete wire.enabled; // canonicalize on the `disable` flag, ST's own convention
  wire.constant = e.constant;
  wire.key = e.triggers.map(triggerToKeyword);
  wire.keysecondary = e.secondaryTriggers.map(triggerToKeyword);
  wire.selective = e.secondaryTriggers.length > 0;
  wire.selectiveLogic = selectiveLogicToNumber(e.selectiveLogic);
  wire.caseSensitive = e.caseSensitive;
  wire.matchWholeWords = e.matchWholeWords;
  wire.scanDepth = e.scanDepth;
  wire.position = positionToNumber(e.position);
  wire.depth = e.depth;
  wire.role = roleToNumber(e.role);
  wire.order = e.sortOrder; // placement out
  // displayIndex is a DISTINCT authored axis from `order` (a real card can have order=100 while
  // displayIndex=0..3), so it is first-classed, not fabricated from sortOrder. Write it only when the
  // creator set one; a cross-format entry with none leaves it to ST's own default (no fabrication).
  if (e.displayIndex != null) wire.displayIndex = e.displayIndex;
  wire.sticky = e.sticky;
  wire.cooldown = e.cooldown;
  wire.delay = e.delay;
  wire.group = e.groupName ?? "";
  wire.groupWeight = e.groupWeight;
  wire.probability = e.probability;
  wire.useProbability = e.probability < 100;
  wire.addMemo = e.useMemo;
  wire.excludeRecursion = e.excludeRecursion;
  wire.preventRecursion = e.preventRecursion;
  wire.delayUntilRecursion = e.delayUntilRecursion;
  wire.characterFilter = e.characterFilter
    ? { isExclude: e.characterFilter.isExclude, names: e.characterFilter.names, tags: e.characterFilter.tags }
    : { isExclude: false, names: [], tags: [] };
  wire.matchCharacterDescription = e.scanCharacterDescription;
  wire.matchCharacterPersonality = e.scanCharacterPersonality;
  wire.matchPersonaDescription = e.scanUserPersona;
  wire.matchScenario = e.scanScenario;
  if (e.scanCharacterDepthPrompt !== undefined) wire.matchCharacterDepthPrompt = e.scanCharacterDepthPrompt;
  if (e.scanCreatorNotes !== undefined) wire.matchCreatorNotes = e.scanCreatorNotes;
  if (e.vectorized !== undefined) wire.vectorized = e.vectorized;
  if (e.groupOverride !== undefined) wire.groupOverride = e.groupOverride;
  if (e.useGroupScoring !== undefined) wire.useGroupScoring = e.useGroupScoring;
  if (e.automationId !== undefined) wire.automationId = e.automationId;
  wire.ignoreBudget = e.ignoreBudget;
  if (e.sideEffects && e.sideEffects.effects.length > 0) wire.sideEffects = e.sideEffects;
  else delete wire.sideEffects;
  return wire;
}

function bookToCanonical(book: StBook): LorebookBody {
  const entries = book.entries ?? {};
  return {
    name: typeof book.name === "string" ? book.name : "",
    description: (book.description as string | null | undefined) ?? null,
    lorebookType: "other",
    genre: null,
    fandom: null,
    tags: [],
    globalCaseSensitive: book.case_sensitive === true,
    globalMatchWholeWords: book.match_whole_words === true,
    globalScanDepth: typeof book.scan_depth === "number" ? book.scan_depth : 0,
    globalRecursion: book.recursive_scanning === true,
    tokenBudget: typeof book.token_budget === "number" ? book.token_budget : 0,
    budgetMode: "token",
    entryBudget: 0,
    entries: Object.values(entries).map(entryToCanonical),
  };
}

function bookToWire(body: LorebookBody, rawBook: StBook | undefined): StBook {
  // Index raw entries by their canonical id (uid) so unedited entries re-project onto their twin.
  const rawByKey = rawBook?.entries ?? {};
  const twinById = new Map<string, { key: string; raw: Record<string, unknown> }>();
  for (const [key, raw] of Object.entries(rawByKey)) {
    const id = raw.uid != null ? String(raw.uid) : key;
    twinById.set(id, { key, raw });
  }

  const entries: Record<string, Record<string, unknown>> = {};
  body.entries.forEach((e, index) => {
    const twin = twinById.get(e.id);
    entries[twin?.key ?? String(index)] = entryToWire(e, twin?.raw);
  });

  return {
    ...(rawBook ? structuredClone(rawBook) : {}),
    entries,
    name: body.name,
    description: body.description ?? "",
    scan_depth: body.globalScanDepth,
    token_budget: body.tokenBudget,
    recursive_scanning: body.globalRecursion,
    case_sensitive: body.globalCaseSensitive,
    match_whole_words: body.globalMatchWholeWords,
  };
}

/** Chub / card-extracted character_book JSON (entries array), not ST's keyed object map. */
function readCharacterBook(input: AdapterInput): CharacterBook | null {
  const obj = readJsonObject(input);
  return isStandaloneCharacterBook(obj) ? obj : null;
}

const sillytavernLorebook: LorebookAdapter = {
  id: "sillytavern-lorebook",
  label: "SillyTavern world info (worldbook json)",
  outputExtensions: ["json"],
  kind: "lorebook",

  // 0.9 native object-map worldbook; 0.85 for CCv3/Chub character_book files (still portable as ST).
  detect(input: AdapterInput): number {
    if (readBook(input)) return 0.9;
    if (readCharacterBook(input)) return 0.85;
    return 0;
  },

  toCanonical(input: AdapterInput): CanonicalLorebook {
    const book = readBook(input);
    if (book) {
      const body = bookToCanonical(book);
      return {
        schemaVersion: CANONICAL_SCHEMA_VERSION,
        kind: "lorebook",
        id: canonicalId(body.name),
        body,
        original: { "sillytavern-lorebook": { raw: book } },
      };
    }
    // Chub standalone lorebooks + card extracts: array character_book, re-export as ST object map.
    const cbook = readCharacterBook(input);
    if (!cbook) throw new Error("sillytavern-lorebook: not a recognizable world info book");
    const body = characterBookToLorebook(cbook);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "lorebook",
      id: canonicalId(body.name),
      body,
      // no ST twin - fromCanonical writes a clean keyed worldbook from body alone
      original: { "sillytavern-lorebook": { raw: { source: "character_book", name: body.name } } },
    };
  },

  fromCanonical(entity: CanonicalLorebook): AdapterOutput {
    const rawBook = entity.original?.["sillytavern-lorebook"]?.raw as StBook | undefined;
    // character_book imports stash a marker object without keyed `entries` - treat as no twin
    const twin =
      rawBook && rawBook.entries && typeof rawBook.entries === "object" && !Array.isArray(rawBook.entries)
        ? rawBook
        : undefined;
    const out = bookToWire(entity.body, twin);
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },
};

export default sillytavernLorebook;
