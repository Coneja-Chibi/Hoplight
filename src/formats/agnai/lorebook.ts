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
 * keyword like `/happy/` must not be promoted to a regex. `selectiveLogic`, `useProbability`, and the
 * other type-only V2 fields Agnai's own mappers never author ride escrow-of-raw untouched rather than
 * being interpreted under an unverified int convention; a same-format round-trip is byte-identical.
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
import { triggerToKeyword } from "../_shared/character-book";

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
  [k: string]: unknown;
}

interface MemoryBook {
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
    selectiveLogic: "and_any", // Agnai's numeric selectiveLogic has no verified convention -> escrow only

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

// -- entry: canonical -> native, overlaying the escrow twin so unedited entries re-emit verbatim ----

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
  if (changed("secondaryTriggers")) base.secondaryKeys = e.secondaryTriggers.map(triggerToKeyword);
  if (changed("enabled")) base.enabled = e.enabled;
  if (changed("constant")) base.constant = e.constant;
  if (changed("sortOrder")) base.weight = e.sortOrder;
  if (changed("priority")) base.priority = e.priority;
  if (changed("position")) base.position = positionToWire(e.position);
  // Type-only V2 fields Agnai never authors: emit only when meaningful, else clear (keeps the twin-edit
  // case correct and cross-format output clean; escrow-of-raw still guards same-format byte-fidelity).
  if (changed("excludeRecursion")) {
    if (e.excludeRecursion) base.excludeRecursion = true;
    else delete base.excludeRecursion;
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

function bookToWire(body: LorebookBody, raw: MemoryBook | undefined): MemoryBook {
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

// -- adapter ---------------------------------------------------------------------------------------

/** Parse untrusted json into an Agnai MemoryBook, or null if it is not one. */
function readBook(input: AdapterInput): MemoryBook | null {
  const obj = readJsonObject(input) as MemoryBook | null;
  if (!obj || !Array.isArray(obj.entries)) return null;
  if (obj.kind === "memory") return obj; // the unambiguous Agnai marker
  // kind-less fallback: a top-level entry array whose items carry the native `entry` + `keywords` shape.
  const first = obj.entries[0] as Record<string, unknown> | undefined;
  if (first && typeof first === "object" && typeof first.entry === "string" && Array.isArray(first.keywords)) {
    return obj;
  }
  return null;
}

const agnaiLorebook: LorebookAdapter = {
  id: "agnai-lorebook",
  label: "Agnai memory book (json)",
  outputExtensions: ["json"],
  kind: "lorebook",

  // 1.0 when the `kind: "memory"` marker is present (unambiguous); 0.9 for the marker-shaped fallback.
  detect(input: AdapterInput): number {
    const book = readBook(input);
    if (!book) return 0;
    return book.kind === "memory" ? 1 : 0.9;
  },

  toCanonical(input: AdapterInput): CanonicalLorebook {
    const book = readBook(input);
    if (!book) throw new Error("agnai-lorebook: not an Agnai memory book");
    const body = bookToCanonical(book);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "lorebook",
      id: canonicalId(body.name),
      body,
      escrow: { "agnai-lorebook": { raw: book } },
    };
  },

  fromCanonical(entity: CanonicalLorebook): AdapterOutput {
    const raw = entity.escrow?.["agnai-lorebook"]?.raw as MemoryBook | undefined;
    const out = bookToWire(entity.body, raw);
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },
};

export default agnaiLorebook;
