/**
 * NovelAI native lorebook codec (standalone `.lorebook` / `.json`, the `vaud convert` lorebook path).
 * A NAI lorebook export is `{ lorebookVersion, entries[], settings, categories[] }`; each entry names
 * fields that DIFFER from CCv3: `text` is the content, `displayName` is the label, `keys[]` carry
 * INLINE `/regex/` (no separate regex flag), `forceActivation` is the always-on flag, `searchRange` is
 * the scan window (in CHARACTERS, not messages), and the whole `contextConfig` block (prefix/suffix/
 * trim/insertion + `budgetPriority`) governs assembly. `budgetPriority` is NAI's single ordering axis
 * (higher inserts first) - it maps to `sortOrder` (placement), NOT eviction `priority`, exactly like
 * ST `order` and Risu `insertorder`. Verified against real v3/v4/v6 exports (nai-v3-mal.lorebook.json
 * et al) - interop facts only, no NAI source read. Enums are STRINGS in the FILE across all versions
 * (the int lineage in NovelAI's internal API never reaches the serialized export).
 *
 * NAI has NO character concept and NO secondary-key / selective logic (it uses `&` AND-logic + regex
 * within `keys`), so this family ships a lorebook codec only. Everything with no canonical home rides
 * escrow-of-raw: `lorebookVersion`, `settings`, `categories` (subcontexts), the rich `contextConfig`,
 * `keyRelative`, `nonStoryActivatable`, `category`, and v6's `id`/`lastUpdatedAt`/`loreBiasGroups`/
 * `advancedConditions`. A same-format round-trip is therefore byte-identical; only edited fields
 * re-encode. `userScripts`-style payloads, if present, are carried opaque and NEVER executed.
 */
import type { LorebookAdapter, AdapterInput, AdapterOutput } from "../../core/adapter";
import type {
  CanonicalLorebook,
  LorebookBody,
  LorebookEntry,
  Trigger,
} from "../../entities/lorebook/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonObject } from "../_shared/card-io";
import { keywordToTrigger, triggerToKeyword } from "../_shared/character-book";

/** NAI per-entry assembly config; only `budgetPriority` extracts to canonical, the rest ride escrow. */
interface NaiContextConfig {
  prefix?: string;
  suffix?: string;
  tokenBudget?: number;
  reservedTokens?: number;
  budgetPriority?: number;
  trimDirection?: string;
  insertionType?: string;
  maximumTrimType?: string;
  insertionPosition?: number;
  [k: string]: unknown;
}

/** One NAI lorebook entry. `keys` carry inline `/regex/`; enums are strings; v6 adds `id`/bias/etc. */
interface NaiEntry {
  text?: string;
  contextConfig?: NaiContextConfig;
  displayName?: string;
  keys?: string[];
  searchRange?: number;
  enabled?: boolean;
  forceActivation?: boolean;
  keyRelative?: boolean;
  nonStoryActivatable?: boolean;
  category?: string;
  id?: string;
  [k: string]: unknown;
}

interface NaiLorebook {
  lorebookVersion?: unknown;
  entries?: unknown;
  settings?: unknown;
  categories?: unknown;
  [k: string]: unknown;
}

// -- verbatim NAI defaults, lifted from a real v3 export (a fresh/blank entry's contextConfig) --------

const DEFAULT_LOREBOOK_VERSION = 3;
const DEFAULT_SEARCH_RANGE = 1000;

/** A blank contextConfig matching NAI's own new-entry default, so a cross-format entry emits valid. */
const defaultContextConfig = (budgetPriority: number): NaiContextConfig => ({
  prefix: "",
  suffix: "\n",
  tokenBudget: 2048,
  reservedTokens: 0,
  budgetPriority,
  trimDirection: "doNotTrim",
  insertionType: "newline",
  maximumTrimType: "sentence",
  insertionPosition: -1,
});

// -- entry: native -> canonical --------------------------------------------------------------------

function entryToCanonical(entry: NaiEntry, index: number): LorebookEntry {
  const keys = Array.isArray(entry.keys) ? entry.keys.filter((k): k is string => typeof k === "string") : [];
  // NAI keys carry their own `/regex/` delimiters, so never force-regex plain strings.
  const triggers: Trigger[] = keys.map((k) => keywordToTrigger(k, false));
  const label = typeof entry.displayName === "string" && entry.displayName ? entry.displayName : `Entry ${index + 1}`;
  const budgetPriority = typeof entry.contextConfig?.budgetPriority === "number" ? entry.contextConfig.budgetPriority : index;

  return {
    id: entry.id != null ? String(entry.id) : String(index),
    title: label,
    content: typeof entry.text === "string" ? entry.text : "",
    comment: null, // NAI has no separate note field

    enabled: entry.enabled !== false, // default on
    constant: entry.forceActivation === true,

    triggerMode: "simple", // NAI has no secondary-key / selective mode (uses `&` + regex within keys)
    triggers,
    secondaryTriggers: [],
    selectiveLogic: "and_any",

    caseSensitive: null,
    matchWholeWords: null,
    // searchRange IS the scan window but its unit is CHARACTERS, not messages; carried as-is, the exact
    // value also rides escrow for a lossless NAI round-trip. Cross-format consumers see a scan number.
    scanDepth: typeof entry.searchRange === "number" ? entry.searchRange : null,

    position: "character", // NAI insertionPosition is an int offset within a section -> escrow; floor here
    depth: 4,
    role: "system",

    sortOrder: budgetPriority, // budgetPriority IS NAI's placement axis (higher first) -> sortOrder
    priority: 100, // single-axis format: no separate eviction priority

    sticky: 0,
    cooldown: 0,
    delay: 0,

    groupName: null,
    categoryId: null, // NAI `category` is a subcontext id with rich config -> escrow, not a flat category
    groupWeight: 1,

    probability: 100, // NAI has no per-entry chance (v6 advancedConditions>random rides escrow)

    useMemo: false,
    excludeRecursion: false,
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

function bookToCanonical(entries: NaiEntry[]): LorebookBody {
  return {
    name: "", // the NAI export carries no book-level name (it lives on the file / UI)
    description: null,
    lorebookType: "world",
    genre: null,
    fandom: null,
    tags: [],
    globalCaseSensitive: false,
    globalMatchWholeWords: false,
    globalScanDepth: 0,
    globalRecursion: false,
    tokenBudget: 0,
    budgetMode: "token",
    entryBudget: 0,
    entries: entries.map(entryToCanonical),
  };
}

// -- entry: canonical -> native, overlaying the escrow twin so unedited entries re-emit verbatim -----

/** Structural equality for the small values we diff (triggers, primitives). */
const deepEq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Re-encode a canonical entry into a native NAI entry. With a raw twin (same-format round-trip) we
 * overlay onto its clone and rewrite ONLY fields whose canonical value changed, so an unedited entry
 * re-emits byte-for-byte (contextConfig richness, keyRelative, category, bias groups untouched). With
 * no twin (cross-format INTO NAI) every field is built from `body` alone onto a valid default shell.
 */
function entryToWire(e: LorebookEntry, twin: NaiEntry | undefined, index: number): NaiEntry {
  const base: NaiEntry = twin
    ? (structuredClone(twin) as NaiEntry)
    : {
        text: "",
        contextConfig: defaultContextConfig(e.sortOrder),
        displayName: "",
        keys: [],
        searchRange: DEFAULT_SEARCH_RANGE,
        enabled: true,
        forceActivation: false,
        keyRelative: false,
        nonStoryActivatable: false,
        category: "",
      };
  const decoded = twin ? entryToCanonical(twin, index) : null;
  const changed = (field: keyof LorebookEntry): boolean => !decoded || !deepEq(e[field], decoded[field]);

  if (changed("triggers")) base.keys = e.triggers.map(triggerToKeyword);
  if (changed("title")) base.displayName = e.title;
  if (changed("content")) base.text = e.content;
  if (changed("enabled")) base.enabled = e.enabled;
  if (changed("constant")) base.forceActivation = e.constant;
  if (changed("scanDepth")) base.searchRange = e.scanDepth ?? DEFAULT_SEARCH_RANGE;
  if (changed("sortOrder")) {
    base.contextConfig = { ...(base.contextConfig ?? defaultContextConfig(e.sortOrder)), budgetPriority: e.sortOrder };
  }
  // NAI v3/v4 entries have NO `id` (identified by array position); v6 uuids ride the twin clone. So a
  // cross-format (no-twin) entry gets no synthetic id - emitting one would pollute the native file.
  return base;
}

function bookToWire(body: LorebookBody, raw: NaiLorebook | undefined): NaiLorebook {
  const twinEntries = Array.isArray(raw?.entries) ? (raw!.entries as NaiEntry[]) : [];
  const twinById = new Map<string, NaiEntry>();
  twinEntries.forEach((en, i) => twinById.set(en.id != null ? String(en.id) : String(i), en));

  const base: NaiLorebook = raw
    ? structuredClone(raw)
    : { lorebookVersion: DEFAULT_LOREBOOK_VERSION, settings: { orderByKeyLocations: false } };
  base.lorebookVersion = typeof raw?.lorebookVersion === "number" ? raw.lorebookVersion : DEFAULT_LOREBOOK_VERSION;
  base.entries = body.entries.map((e, i) => entryToWire(e, twinById.get(e.id), i));
  return base;
}

// -- adapter ---------------------------------------------------------------------------------------

/** Parse untrusted json into a NAI lorebook, or null if it is not one. */
function readLorebook(input: AdapterInput): NaiLorebook | null {
  const obj = readJsonObject(input) as NaiLorebook | null;
  if (!obj || typeof obj.lorebookVersion !== "number" || !Array.isArray(obj.entries)) return null;
  return obj;
}

const novelaiLorebook: LorebookAdapter = {
  id: "novelai-lorebook",
  label: "NovelAI lorebook (native export .lorebook / json)",
  outputExtensions: ["lorebook"],
  kind: "lorebook",

  // 1.0: `lorebookVersion` (number) + `entries` (array) is unique to NAI - no other format claims both.
  detect(input: AdapterInput): number {
    return readLorebook(input) ? 1 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalLorebook {
    const raw = readLorebook(input);
    if (!raw) throw new Error("novelai-lorebook: not a NovelAI lorebook export");
    const body = bookToCanonical(raw.entries as NaiEntry[]);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "lorebook",
      id: canonicalId(body.name),
      body,
      escrow: { "novelai-lorebook": { raw } },
    };
  },

  fromCanonical(entity: CanonicalLorebook): AdapterOutput {
    const raw = entity.escrow?.["novelai-lorebook"]?.raw as NaiLorebook | undefined;
    const out = bookToWire(entity.body, raw);
    return { text: JSON.stringify(out, null, 4), suggestedExtension: "lorebook" };
  },
};

export default novelaiLorebook;
