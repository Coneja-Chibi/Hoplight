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
 * within `keys`), so this family ships a lorebook codec only. Authored NAI surface is FIRST-CLASS
 * (schema-is-editor): the per-entry `contextConfig` assembly dials, `keyRelative`/`nonStoryActivatable`,
 * the entry `category` ref + flat `categories` (id/name/enabled). Original-of-raw carries only what the
 * doctrine allows: version/bookkeeping (`lorebookVersion`, v6 `id`/`lastUpdatedAt`), UI state (category
 * `open`), the rich subcontext machinery riding each category twin, `settings`, and `loreBiasGroups`/
 * `advancedConditions` (bias pending its own reconciled shape; advancedConditions ungrounded - empty in
 * every real sample). A same-format round-trip stays byte-identical; only edited fields re-encode.
 * `userScripts`-style payloads, if present, are carried opaque and NEVER executed.
 */
import type { LorebookAdapter, AdapterInput, AdapterOutput } from "../../core/adapter";
import type {
  CanonicalLorebook,
  LorebookBody,
  LorebookCategory,
  LorebookEntry,
  EntryContextConfig,
  Trigger,
} from "../../entities/lorebook/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonObject } from "../_shared/card-io";
import { keywordToTrigger, triggerToKeyword } from "../_shared/character-book";

/** NAI per-entry assembly config (wire). `budgetPriority` -> sortOrder; the rest -> EntryContextConfig. */
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

/** A NAI category (v6 subcontext/folder). `order` is an ARRAY (subcontext entry ordering), not a rank. */
interface NaiCategory {
  id?: string;
  name?: string;
  enabled?: boolean;
  [k: string]: unknown;
}

interface NaiLorebook {
  lorebookVersion?: unknown;
  entries?: unknown;
  settings?: unknown;
  categories?: unknown;
  [k: string]: unknown;
}

// -- present-or-absent reads (undefined = the export did not carry this typed key) ------------------

const presentStr = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const presentNum = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const presentBool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

/**
 * Extract the authored assembly dials from a wire contextConfig into the canonical block, skipping
 * undefined so deep-equality diffs against a twin's re-decode are stable. `budgetPriority` is excluded:
 * it is the placement axis and lives in `sortOrder` alone.
 */
function readContextConfig(cc: NaiContextConfig | undefined): EntryContextConfig | undefined {
  if (!cc || typeof cc !== "object") return undefined;
  const out: EntryContextConfig = {};
  const set = <K extends keyof EntryContextConfig>(k: K, v: EntryContextConfig[K] | undefined): void => {
    if (v !== undefined) out[k] = v;
  };
  set("prefix", presentStr(cc.prefix));
  set("suffix", presentStr(cc.suffix));
  set("tokenBudget", presentNum(cc.tokenBudget));
  set("reservedTokens", presentNum(cc.reservedTokens));
  set("trimDirection", presentStr(cc.trimDirection));
  set("insertionType", presentStr(cc.insertionType));
  set("maximumTrimType", presentStr(cc.maximumTrimType));
  set("insertionPosition", presentNum(cc.insertionPosition));
  return Object.keys(out).length > 0 ? out : undefined;
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
    // value also rides original for a lossless NAI round-trip. Cross-format consumers see a scan number.
    scanDepth: typeof entry.searchRange === "number" ? entry.searchRange : null,

    // NAI has no before/after-char slot; "character" is the portable floor. The REAL authored position
    // (insertionPosition, a signed section offset) is first-class in contextConfig below, not original.
    position: "character",
    depth: 4,
    role: "system",

    sortOrder: budgetPriority, // budgetPriority IS NAI's placement axis (higher first) -> sortOrder
    priority: 100, // single-axis format: no separate eviction priority

    sticky: 0,
    cooldown: 0,
    delay: 0,

    groupName: null,
    // the entry's category REF is authored and now first-class (pairs with body.categories); the
    // category's rich subcontext CONFIG (createSubcontext, categoryDefaults, bias) rides the twin.
    categoryId: typeof entry.category === "string" && entry.category !== "" ? entry.category : null,
    groupWeight: 1,

    probability: 100, // NAI has no per-entry chance (v6 advancedConditions>random rides original)

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

    // NAI authored activation toggles + the per-entry assembly block, de-kept to first-class slots.
    keyRelative: presentBool(entry.keyRelative),
    nonStoryActivatable: presentBool(entry.nonStoryActivatable),
    contextConfig: readContextConfig(entry.contextConfig),

    sideEffects: null,
  };
}

/**
 * NAI categories (v6 folders/subcontexts) -> canonical LorebookCategory[]. The flat authored surface
 * (id, name, enabled) is first-class; the rich subcontext machinery (createSubcontext, categoryDefaults,
 * categoryBiasGroups, the `order` ARRAY) rides the twin. sortOrder is the list index: NAI's category
 * `order` is an array of entry ids, a different concept than a rank.
 */
function categoriesToCanonical(raw: unknown): LorebookCategory[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return (raw as NaiCategory[]).map((c, i) => ({
    id: typeof c.id === "string" && c.id ? c.id : String(i),
    name: typeof c.name === "string" ? c.name : `Category ${i + 1}`,
    sortOrder: i,
    ...(typeof c.enabled === "boolean" ? { enabled: c.enabled } : {}),
  }));
}

function bookToCanonical(raw: NaiLorebook): LorebookBody {
  const entries = Array.isArray(raw.entries) ? (raw.entries as NaiEntry[]) : [];
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
    categories: categoriesToCanonical(raw.categories),
  };
}

// -- entry: canonical -> native, overlaying the original twin so unedited entries re-emit verbatim -----

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
  // authored assembly dials: merge the canonical block over the twin's (budgetPriority untouched here -
  // it is the sortOrder axis, written below; unknown twin keys survive the spread)
  if (changed("contextConfig") && e.contextConfig) {
    base.contextConfig = { ...(base.contextConfig ?? defaultContextConfig(e.sortOrder)), ...e.contextConfig };
  }
  if (changed("sortOrder")) {
    base.contextConfig = { ...(base.contextConfig ?? defaultContextConfig(e.sortOrder)), budgetPriority: e.sortOrder };
  }
  if (changed("keyRelative") && e.keyRelative !== undefined) base.keyRelative = e.keyRelative;
  if (changed("nonStoryActivatable") && e.nonStoryActivatable !== undefined) {
    base.nonStoryActivatable = e.nonStoryActivatable;
  }
  if (changed("categoryId")) base.category = e.categoryId ?? "";
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

  // categories: overlay authored name/enabled edits onto their twin rows (rich subcontext config
  // survives the clone); canonical categories with no twin are appended as minimal valid rows.
  if (body.categories && body.categories.length > 0) {
    const twinCats = new Map<string, NaiCategory>();
    (Array.isArray(base.categories) ? (base.categories as NaiCategory[]) : []).forEach((c, i) =>
      twinCats.set(typeof c.id === "string" && c.id ? c.id : String(i), c),
    );
    base.categories = body.categories.map((c) => {
      const twin = twinCats.get(c.id);
      const row: NaiCategory = twin ? (structuredClone(twin) as NaiCategory) : { id: c.id, order: [] };
      if (row.name !== c.name) row.name = c.name;
      if (c.enabled !== undefined && row.enabled !== c.enabled) row.enabled = c.enabled;
      if (twin == null && row.enabled === undefined) row.enabled = true;
      return row;
    });
  }
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
    const body = bookToCanonical(raw);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "lorebook",
      id: canonicalId(body.name),
      body,
      original: { "novelai-lorebook": { raw } },
    };
  },

  fromCanonical(entity: CanonicalLorebook): AdapterOutput {
    const raw = entity.original?.["novelai-lorebook"]?.raw as NaiLorebook | undefined;
    const out = bookToWire(entity.body, raw);
    return { text: JSON.stringify(out, null, 4), suggestedExtension: "lorebook" };
  },
};

export default novelaiLorebook;
