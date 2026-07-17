/**
 * Agnai MemoryBook codec (standalone `.json`, the `vaud convert` lorebook path). Agnai's memory-book
 * download strips `_id`/`userId` and emits `{ kind: "memory", name, description, entries: MemoryEntry[],
 * scanDepth?, tokenBudget?, recursiveScanning?, extensions? }`. MemoryEntry uses Agnai-native names that
 * DIFFER from CCv3: `entry` is the content (not `content`), `keywords` is an ARRAY (not CSV), and the
 * two ordering axes are EXPLICIT - `weight` is placement ("highest renders at the bottom") and
 * `priority` is eviction ("lowest discarded first"). Verified against agnai src (common/memory.ts
 * memoryEntryToNative/nativeToMemoryEntry, common/types/memory.ts, web/pages/Memory encodeBook) - interop
 * facts only.
 *
 * AXIS MAPPING is grounded, not assumed: Agnai's own `memoryEntryToNative` maps CCv3 `insertion_order`
 * (placement) -> `weight` and CCv3 `priority` (eviction) -> `priority`, so `weight` -> canonical
 * `sortOrder` and `priority` -> canonical `priority` matches Agnai's round-trip exactly. Consequence:
 * an Agnai -> SillyTavern convert hits the same tracked placement-order defect the Risu path does (see
 * design/LOREBOOK-FORMATS.md).
 *
 * KEYWORDS map as PLAIN triggers (`isRegex: false`): Agnai has no regex-key feature, so a literal
 * keyword like `/happy/` must not be promoted to a regex. `selectiveLogic` is ST-import residue and uses
 * the ST numeric convention (0 and_any, 1 not_all, 2 not_any, 3 and_all - shared decoder), so it maps to
 * the canonical enum instead of being silently rewritten to and_any on cross-format export (the old
 * hardcode corrupted imported books' secondary-key logic). A same-format round-trip stays byte-identical.
 */
import type { LorebookAdapter, AdapterInput, AdapterOutput } from "../../core/adapter";
import type {
  CanonicalLorebook,
  LorebookBody,
  LorebookEntry,
  InjectionPosition,
  Trigger,
} from "../../entities/lorebook/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonObject } from "../_shared/card-io";
import {
  characterBookToLorebook,
  isStandaloneCharacterBook,
  triggerToKeyword,
} from "../_shared/character-book";
import { parseSelectiveLogic, selectiveLogicToNumber } from "../_shared/lore-enums";

/** One Agnai memory entry. `entry` is the content; `keywords` is a plain array; two ordering axes. */
interface MemoryEntry {
  name?: string;
  entry?: string;
  keywords?: string[];
  priority?: number;
  weight?: number;
  enabled?: boolean;
  id?: number;
  comment?: string;
  secondaryKeys?: string[];
  constant?: boolean;
  position?: "before_char" | "after_char";
  probability?: number;
  useProbability?: boolean;
  excludeRecursion?: boolean;
  /** ST-import residue, ST numeric convention (0..3); Agnai's own editor never authors it */
  selectiveLogic?: number;
  [k: string]: unknown;
}

export interface MemoryBook {
  kind?: unknown;
  name?: unknown;
  description?: unknown;
  entries?: unknown;
  scanDepth?: unknown;
  tokenBudget?: unknown;
  recursiveScanning?: unknown;
  [k: string]: unknown;
}

// -- tolerant coercion -----------------------------------------------------------------------------

const numish = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const stringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((k): k is string => typeof k === "string" && k.trim().length > 0) : [];

/** Agnai stores plain keyword strings; never auto-detect regex (Agnai has no regex-key feature). */
const toTriggers = (arr: unknown): Trigger[] =>
  stringArray(arr).map((keyword) => ({ keyword, isRegex: false }));

/** Agnai's two injection slots mirror ST's before/after char (the portable floor). */
const parsePosition = (v: unknown): InjectionPosition => (v === "before_char" ? "world" : "character");
const positionToWire = (p: InjectionPosition): "before_char" | "after_char" =>
  p === "world" || p === "prepend_top" ? "before_char" : "after_char";

// -- entry: native -> canonical --------------------------------------------------------------------

function entryToCanonical(entry: MemoryEntry, index: number): LorebookEntry {
  const useProb = entry.useProbability !== false;
  const probability =
    useProb && typeof entry.probability === "number"
      ? Math.min(100, Math.max(0, entry.probability))
      : 100;
  const secondaryTriggers = toTriggers(entry.secondaryKeys);

  return {
    id: entry.id != null ? String(entry.id) : String(index),
    title: typeof entry.name === "string" && entry.name ? entry.name : `Entry ${index + 1}`,
    content: typeof entry.entry === "string" ? entry.entry : "",
    comment: typeof entry.comment === "string" ? entry.comment : null, // Agnai has a distinct note field

    enabled: entry.enabled !== false,
    constant: entry.constant === true,

    triggerMode: "simple", // Agnai has no per-trigger probability
    triggers: toTriggers(entry.keywords),
    secondaryTriggers,
    // ST-import residue on the ST numeric convention (shared decoder); absent -> and_any default
    selectiveLogic: parseSelectiveLogic(entry.selectiveLogic),

    caseSensitive: null, // Agnai has no per-entry case flag
    matchWholeWords: null,
    scanDepth: null, // scan depth is book-level in Agnai, not per-entry

    position: parsePosition(entry.position),
    depth: 4,
    role: "system", // memory entries carry no message role

    sortOrder: numish(entry.weight, index), // weight === placement -> sortOrder (matches Agnai's own map)
    priority: numish(entry.priority, 100), // priority === eviction -> priority

    sticky: 0,
    cooldown: 0,
    delay: 0,

    groupName: null,
    categoryId: null,
    groupWeight: 1,

    probability,

    useMemo: false,
    excludeRecursion: entry.excludeRecursion === true,
    preventRecursion: false,
    delayUntilRecursion: 0,

    characterFilter: null,

    scanCharacterDescription: false,
    scanCharacterPersonality: false,
    scanUserPersona: false,
    scanScenario: false,

    ignoreBudget: false,

    sideEffects: null,
  };
}

function bookToCanonical(book: MemoryBook): LorebookBody {
  const entries = Array.isArray(book.entries) ? (book.entries as MemoryEntry[]) : [];
  return {
    name: typeof book.name === "string" ? book.name : "",
    description: typeof book.description === "string" ? book.description : null,
    lorebookType: "other", // Agnai memory books are general library entities
    genre: null,
    fandom: null,
    tags: [],
    globalCaseSensitive: false,
    globalMatchWholeWords: false,
    globalScanDepth: numish(book.scanDepth, 0),
    globalRecursion: book.recursiveScanning === true,
    tokenBudget: numish(book.tokenBudget, 0),
    budgetMode: "token",
    entryBudget: 0,
    entries: entries.map(entryToCanonical),
  };
}

// -- entry: canonical -> native, overlaying the original twin so unedited entries re-emit verbatim ----

/** Structural equality for the small values we diff. */
const deepEq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Re-encode a canonical entry into a native MemoryEntry. With a raw twin (same-format round-trip) we
 * overlay onto its clone and rewrite ONLY fields whose canonical value changed, so an unedited entry
 * re-emits byte-for-byte (Agnai-only residue - `selectiveLogic`, `selective` - untouched). With no twin
 * (cross-format) every mapped field is written from `body` alone.
 */
function entryToWire(e: LorebookEntry, twin: MemoryEntry | undefined, index: number): MemoryEntry {
  const base: MemoryEntry = twin
    ? (structuredClone(twin) as MemoryEntry)
    : { name: "", entry: "", keywords: [], priority: 100, weight: 0, enabled: true };
  const decoded = twin ? entryToCanonical(twin, index) : null;
  const changed = (field: keyof LorebookEntry): boolean => !decoded || !deepEq(e[field], decoded[field]);

  if (changed("title")) base.name = e.title;
  if (changed("content")) base.entry = e.content;
  if (changed("comment")) {
    if (e.comment != null) base.comment = e.comment;
    else delete base.comment;
  }
  if (changed("triggers")) base.keywords = e.triggers.map(triggerToKeyword);
  // Agnai pairs `secondaryKeys` with `selective` (its own ST importers always set both together), so a
  // fresh encode emits them as a pair - or neither. Agnai's runtime matcher scans only `keywords`, so
  // this is interop well-formedness, not a match-time behavior. An unedited twin is left untouched.
  if (changed("secondaryTriggers")) {
    if (e.secondaryTriggers.length > 0) {
      base.secondaryKeys = e.secondaryTriggers.map(triggerToKeyword);
      base.selective = true;
    } else {
      delete base.secondaryKeys;
      delete base.selective;
    }
  }
  if (changed("enabled")) base.enabled = e.enabled;
  if (changed("constant")) base.constant = e.constant;
  if (changed("sortOrder")) base.weight = e.sortOrder;
  if (changed("priority")) base.priority = e.priority;
  if (changed("position")) base.position = positionToWire(e.position);
  // Type-only V2 fields Agnai never authors: emit only when meaningful, else clear (keeps the twin-edit
  // case correct and cross-format output clean; original-of-raw still guards same-format byte-fidelity).
  if (changed("excludeRecursion")) {
    if (e.excludeRecursion) base.excludeRecursion = true;
    else delete base.excludeRecursion;
  }
  if (changed("selectiveLogic")) {
    if (e.selectiveLogic !== "and_any") base.selectiveLogic = selectiveLogicToNumber(e.selectiveLogic);
    else if (twin && "selectiveLogic" in twin) base.selectiveLogic = 0; // explicit default on the twin
    else delete base.selectiveLogic; // Agnai never authors it; keep fresh encodes clean
  }
  if (changed("probability")) {
    if (e.probability < 100) {
      base.probability = e.probability;
      base.useProbability = true;
    } else {
      delete base.probability;
      delete base.useProbability;
    }
  }
  return base;
}

export function canonicalToMemoryBook(body: LorebookBody, raw: MemoryBook | undefined): MemoryBook {
  const twinEntries = Array.isArray(raw?.entries) ? (raw!.entries as MemoryEntry[]) : [];
  const twinById = new Map<string, MemoryEntry>();
  twinEntries.forEach((en, i) => twinById.set(en.id != null ? String(en.id) : String(i), en));

  const out: MemoryBook = raw ? (structuredClone(raw) as MemoryBook) : { kind: "memory" };
  out.name = body.name;
  out.description = body.description ?? "";
  out.entries = body.entries.map((e, i) => entryToWire(e, twinById.get(e.id), i));

  // Optional book fields: preserve the twin's presence/absence; cross-format emits only non-defaults.
  const setOptional = (key: keyof MemoryBook, value: number | boolean, isDefault: boolean): void => {
    const keep = raw ? key in raw : !isDefault;
    if (keep) out[key] = value;
    else delete out[key];
  };
  setOptional("scanDepth", body.globalScanDepth, body.globalScanDepth === 0);
  setOptional("tokenBudget", body.tokenBudget, body.tokenBudget === 0);
  setOptional("recursiveScanning", body.globalRecursion, body.globalRecursion === false);

  return out;
}

/**
 * Wrap a parsed MemoryBook into a CanonicalLorebook. The SINGLE source of the schema/id/original
 * wrapper, shared by `toCanonical` (standalone file) and the Agnai character adapter's `extractLorebook`
 * (embedded `characterBook`), so both canonicalize a given MemoryBook identically - container-invariance
 * by construction. The book rides its OWN original key so a re-embed twin-overlays it byte-for-byte.
 */
export function memoryBookToCanonical(book: MemoryBook): CanonicalLorebook {
  const body = bookToCanonical(book);
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "lorebook",
    id: canonicalId(body.name),
    body,
    original: { "agnai-lorebook": { raw: book } },
  };
}

// -- adapter ---------------------------------------------------------------------------------------

/** Coerce an already-parsed value into an Agnai MemoryBook, or null (tolerant reader, fail closed). */
export function coerceMemoryBook(v: unknown): MemoryBook | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const obj = v as MemoryBook;
  if (!Array.isArray(obj.entries)) return null;
  if (obj.kind === "memory") return obj; // the unambiguous Agnai marker
  // kind-less fallback: a top-level entry array whose items carry the native `entry` + `keywords` shape.
  const first = obj.entries[0] as Record<string, unknown> | undefined;
  if (first && typeof first === "object" && typeof first.entry === "string" && Array.isArray(first.keywords)) {
    return obj;
  }
  return null;
}

/** Parse untrusted json into an Agnai MemoryBook, or null if it is not one. */
function readBook(input: AdapterInput): MemoryBook | null {
  return coerceMemoryBook(readJsonObject(input));
}

const agnaiLorebook: LorebookAdapter = {
  id: "agnai-lorebook",
  label: "Agnai memory book (json)",
  outputExtensions: ["json"],
  kind: "lorebook",

  // 1.0 when the `kind: "memory"` marker is present (unambiguous); 0.9 for native MemoryBook shape;
  // 0.7 for CCv3/Chub character_book (re-exported as a real MemoryBook).
  detect(input: AdapterInput): number {
    const book = readBook(input);
    if (book) return book.kind === "memory" ? 1 : 0.9;
    const obj = readJsonObject(input);
    if (isStandaloneCharacterBook(obj)) return 0.7;
    return 0;
  },

  toCanonical(input: AdapterInput): CanonicalLorebook {
    const book = readBook(input);
    if (book) return memoryBookToCanonical(book);
    // Chub-style character_book downloads: map through shared CCv3 dialect, then export as MemoryBook.
    const obj = readJsonObject(input);
    if (!isStandaloneCharacterBook(obj)) {
      throw new Error("agnai-lorebook: not an Agnai memory book");
    }
    const body = characterBookToLorebook(obj);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "lorebook",
      id: canonicalId(body.name),
      body,
      // no MemoryBook twin - fromCanonical writes a clean Agnai memory book from body
      original: {},
    };
  },

  fromCanonical(entity: CanonicalLorebook): AdapterOutput {
    const raw = entity.original?.["agnai-lorebook"]?.raw as MemoryBook | undefined;
    const out = canonicalToMemoryBook(entity.body, raw);
    // Ensure kind marker so re-detect is unambiguous
    if (out.kind == null) out.kind = "memory";
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },
};

export default agnaiLorebook;
