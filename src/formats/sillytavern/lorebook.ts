/**
 * SillyTavern world-info (worldbook) codec. Reads a standalone ST worldbook `.json`
 * ({ entries: { "0": {...} }, name, scan_depth, ... }) into the canonical Lorebook and back.
 * Field map + int-enum decode verified against VAUDEVILLE packages/lorebook parser.ts (parseSTEntry,
 * parsePosition/parseRole/parseSelectiveLogic) + serializer.ts (interop facts only).
 *
 * ST encodes richer canonical positions lossily (append/append_bottom -> @depth 4, prepend_top -> 0)
 * and drops per-trigger probability; that loss is inherent to ST and is what escrow-of-raw guards:
 * an unedited entry re-projects from its raw twin, so a vaud round-trip is byte-lossless. ST's two
 * extra scan sources (matchCharacterDepthPrompt, matchCreatorNotes) and uid ride escrow untouched.
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
    // field, so priority defaults; ST's cosmetic `displayIndex` has no canonical slot and rides escrow.
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

    ignoreBudget: raw.ignoreBudget === true,

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
  // displayIndex is ST-only cosmetic: a same-format twin carries its own (untouched via the clone);
  // a cross-format entry (no twin) defaults the display list to insertion order.
  if (raw === undefined) wire.displayIndex = e.sortOrder;
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

const sillytavernLorebook: LorebookAdapter = {
  id: "sillytavern-lorebook",
  label: "SillyTavern world info (worldbook json)",
  outputExtensions: ["json"],
  kind: "lorebook",

  // 0.9, not 1.0: the generic ST worldbook reader, mirroring the ST character adapter's posture.
  detect(input: AdapterInput): number {
    return readBook(input) ? 0.9 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalLorebook {
    const book = readBook(input);
    if (!book) throw new Error("sillytavern-lorebook: not a recognizable world info book");
    const body = bookToCanonical(book);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "lorebook",
      id: canonicalId(body.name),
      body,
      escrow: { "sillytavern-lorebook": { raw: book } },
    };
  },

  fromCanonical(entity: CanonicalLorebook): AdapterOutput {
    const rawBook = entity.escrow?.["sillytavern-lorebook"]?.raw as StBook | undefined;
    const out = bookToWire(entity.body, rawBook);
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },
};

export default sillytavernLorebook;
