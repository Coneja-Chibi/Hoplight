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
import type { AdapterInput, AdapterOutput } from "../../core/adapter";
import type {
  CanonicalLorebook,
  LorebookBody,
  LorebookEntry,
  Trigger,
  SelectiveLogic,
  InjectionPosition,
  MessageRole,
} from "../../entities/lorebook/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";

interface StBook {
  entries?: Record<string, Record<string, unknown>>;
  [k: string]: unknown;
}

/** Parse untrusted json into an ST worldbook, or null if it is not one. */
function readBook(input: AdapterInput): StBook | null {
  const text = input.text ?? (input.bytes ? new TextDecoder().decode(input.bytes) : null);
  if (text == null) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (!json || typeof json !== "object") return null;
  const book = json as StBook;
  const entries = book.entries;
  // ST worldbook: `entries` is a keyed OBJECT (not an array - that would be RC/Agnai) of ST entries.
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) return null;
  const first = Object.values(entries)[0] as Record<string, unknown> | undefined;
  if (!first || typeof first !== "object") return null;
  const looksSt = "key" in first || "keysecondary" in first || "comment" in first || "content" in first;
  return looksSt ? book : null;
}

// -- int-enum + regex-keyword decoders (ST wire -> canonical) --------------------------------------

const parseSelectiveLogic = (v: unknown): SelectiveLogic =>
  v === 1 ? "not_all" : v === 2 ? "not_any" : v === 3 ? "and_all" : "and_any";

const selectiveLogicToNumber = (l: SelectiveLogic): number =>
  l === "not_all" ? 1 : l === "not_any" ? 2 : l === "and_all" ? 3 : 0;

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

const parseRole = (v: unknown): MessageRole => (v === 1 ? "user" : v === 2 ? "assistant" : "system");
const roleToNumber = (r: MessageRole): number => (r === "user" ? 1 : r === "assistant" ? 2 : 0);

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
function escapeSlashes(pattern: string): string {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === "/" && (i === 0 || pattern[i - 1] !== "\\")) out += "\\/";
    else out += pattern[i];
  }
  return out;
}

const triggerToKeyword = (t: Trigger): string =>
  t.isRegex ? `/${escapeSlashes(t.keyword)}/${t.flags ?? ""}` : t.keyword;

// -- entry <-> wire --------------------------------------------------------------------------------

function entryToCanonical(raw: Record<string, unknown>, index: number): LorebookEntry {
  const enabled = raw.disable !== undefined ? raw.disable !== true : raw.enabled !== false;
  const useProb = raw.useProbability !== false;
  const probability =
    useProb && typeof raw.probability === "number" ? Math.min(100, Math.max(0, raw.probability)) : 100;
  const filter = raw.characterFilter as Record<string, unknown> | null | undefined;

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

    sortOrder: typeof raw.displayIndex === "number" ? raw.displayIndex : index,
    priority: typeof raw.order === "number" ? raw.order : 100,

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

    characterFilter: filter
      ? {
          isExclude: filter.isExclude === true,
          names: Array.isArray(filter.names) ? (filter.names as string[]) : [],
          tags: Array.isArray(filter.tags) ? (filter.tags as string[]) : [],
        }
      : null,

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
  wire.displayIndex = e.sortOrder;
  wire.order = e.priority;
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

const sillytavernLorebook = {
  id: "sillytavern-lorebook",
  label: "SillyTavern world info (worldbook json)",
  outputExtensions: ["json"],
  kind: "lorebook" as const,

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
