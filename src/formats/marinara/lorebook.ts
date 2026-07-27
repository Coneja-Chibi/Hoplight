/**
 * Marinara-Engine native lorebook codec (the `.marinara.json` export the engine serves from
 * `GET /lorebooks/:id/export` and `POST /lorebooks/export-bulk`). The wire is an ExportEnvelope:
 * `{ type: "marinara_lorebook", version: 1, exportedAt, data: { lorebook, entries, folders } }`
 * (packages/shared/src/types/export.ts + packages/server/src/routes/lorebooks.routes.ts). The three
 * `data` members are FULLY DESERIALIZED storage rows (the storage layer parses the SQLite "true"/"false"
 * strings and JSON columns back to real booleans/arrays/objects, so the file carries native JSON types,
 * not stringified ones - lorebooks.storage.ts parseLorebookRow/parseEntryRow/parseFolderRow).
 *
 * DIALECT NOTES (interop facts, all cited path:line to the engine source):
 * - Keys are PLAIN strings plus a per-entry `useRegex` flag; a regex key is the raw pattern source with
 *   NO `/.../` delimiters (lorebook-keyword-matching.ts:36-46 feeds the key straight to `new RegExp`).
 *   So this codec does NOT reuse the ST `/pattern/flags` keyword helpers - it maps keyword <-> plain
 *   string and carries `isRegex` from the entry flag, which applies to every key at once.
 * - Marinara has a SINGLE ordering axis, `order` (placement); it maps to `sortOrder`, never eviction
 *   `priority` (same doctrine as ST `order` / NAI `budgetPriority`). `priority` stays the default and is
 *   never serialized back.
 * - `selectiveLogic` "and" and "or" both mean ANY-secondary-match in the engine (testSecondaryKeys,
 *   lorebook-keyword-matching.ts:91-103), so both canonicalize to `and_any`; the "or" spelling is
 *   preserved byte-true on an unedited round-trip because the whole envelope rides escrow.
 * - Folders NEST: `parentFolderId` is live at the route layer (createFolder validates the parent,
 *   PATCH runs canReparentFolder cycle checks - lorebooks.routes.ts:616-646). The flat `categories`
 *   projection carries id/name/sortOrder/enabled; the COMPLETE folder rows (parentFolderId included)
 *   ride escrow so nested trees round-trip losslessly.
 *
 * Escrow-of-raw + overlay-edits, exactly like the NovelAI codec: the untouched envelope is stashed under
 * `original["marinara-lorebook"].raw`; on write we clone it and rewrite ONLY the fields whose canonical
 * value changed vs the twin's own decode, so a same-format round trip of an unedited book is byte-true
 * and the engine-only exotica with no canonical home (schedule, activationConditions, relationships,
 * dynamicState, ephemeral, locked, tag, generationTrigger filters, embedding, timestamps) survive intact.
 */
import type { AdapterInput, AdapterOutput, LorebookAdapter } from "../../core/adapter";
import type {
  CanonicalLorebook,
  CharacterFilter,
  InjectionPosition,
  LorebookBody,
  LorebookCategory,
  LorebookEntry,
  LorebookType,
  MessageRole,
  SelectiveLogic,
} from "../../entities/lorebook/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonObject } from "../_shared/card-io";
import { ensureUniqueEntryIds } from "../_shared/lore-enums";

// -- wire shapes (deserialized storage rows; open bags so unmodelled fields ride the clone untouched) --

type Rec = Record<string, unknown>;

interface MariEnvelope {
  type?: unknown;
  version?: unknown;
  exportedAt?: unknown;
  data?: { lorebook?: Rec; entries?: unknown; folders?: unknown; [k: string]: unknown };
  [k: string]: unknown;
}

// -- tolerant readers (never throw; a bad field falls back to a portable default) ------------------

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const numOr = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const recArray = (v: unknown): Rec[] =>
  Array.isArray(v) ? v.filter((x): x is Rec => !!x && typeof x === "object" && !Array.isArray(x)) : [];
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const deepEq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// -- enum maps (each cites the engine helper it inverts) -------------------------------------------

/** testSecondaryKeys: "and"/"or" -> ANY, "and_all" -> ALL, "not" -> NONE, "not_all" -> NOT-ALL. */
const logicToCanonical = (v: unknown): SelectiveLogic =>
  v === "and_all" ? "and_all" : v === "not" ? "not_any" : v === "not_all" ? "not_all" : "and_any";

/** Inverse of logicToCanonical. `and_any` -> "and" (the "or" spelling is escrow-preserved unedited). */
const logicToMari = (v: SelectiveLogic): string =>
  v === "and_all" ? "and_all" : v === "not_any" ? "not" : v === "not_all" ? "not_all" : "and";

/**
 * Marinara position is 0 / 1 / 2. Ground truth is the engine's injector (prompt-injector.ts:
 * 0 = WORLD_INFO_BEFORE, 1 = WORLD_INFO_AFTER, i.e. before/after character defs), matching its own
 * ST-compatible export (stPosition in lorebooks.routes.ts). The mobile UI labels them "Before
 * chat / After chat", but the injector wins: 0 -> world, 1 -> character, 2 -> depth.
 */
const positionToCanonical = (v: unknown): InjectionPosition =>
  v === 2 ? "depth" : v === 1 ? "character" : "world";

const positionToMari = (v: InjectionPosition): number =>
  v === "depth" || v === "append" ? 2 : v === "character" || v === "append_bottom" || v === "after_example" ? 1 : 0;

const roleToCanonical = (v: unknown): MessageRole => (v === "user" ? "user" : v === "assistant" ? "assistant" : "system");

const categoryToType = (v: unknown): LorebookType =>
  v === "world" ? "world" : v === "character" || v === "npc" ? "character" : v === "spellbook" ? "rules" : "other";

/** npc collapses to character on read, so it cannot be restored; an unedited book keeps it via escrow. */
const typeToCategory = (v: LorebookType | null | undefined): string =>
  v === "world" ? "world" : v === "character" ? "character" : v === "rules" ? "spellbook" : "uncategorized";

/** additionalMatchingSources members that map to a first-class scan flag (the rest ride escrow). */
const MAPPED_SOURCES = ["character_description", "character_personality", "persona_description", "character_scenario"];

/** characterFilter is derived only when a filter mode is engaged; the raw quartet always rides escrow. */
function filterToCanonical(raw: Rec): CharacterFilter | null {
  const charMode = raw.characterFilterMode;
  const tagMode = raw.characterTagFilterMode;
  if ((charMode === undefined || charMode === "any") && (tagMode === undefined || tagMode === "any")) return null;
  return {
    names: strArray(raw.characterFilterIds),
    tags: strArray(raw.characterTagFilters),
    // Canonical carries ONE isExclude for names+tags; the wire has independent modes per axis. A
    // filter counts as exclude when either engaged axis excludes; mixed include-names/exclude-tags
    // cannot be represented first-class and is preserved via the escrowed quartet.
    isExclude: charMode === "exclude" || tagMode === "exclude",
  };
}

// -- entry: native -> canonical --------------------------------------------------------------------

function entryToCanonical(raw: Rec, index: number): LorebookEntry {
  const useRegex = raw.useRegex === true;
  const triggers = strArray(raw.keys).map((k) => ({ keyword: k, isRegex: useRegex }));
  const secondaryTriggers = strArray(raw.secondaryKeys).map((k) => ({ keyword: k, isRegex: useRegex }));
  const sources = strArray(raw.additionalMatchingSources);
  const group = str(raw.group);
  return {
    id: raw.id != null ? String(raw.id) : String(index),
    title: str(raw.name) || `Entry ${index + 1}`,
    content: str(raw.content) ?? "",
    comment: str(raw.description) ?? null,

    enabled: raw.enabled !== false,
    constant: raw.constant === true,

    triggerMode: raw.selective === true || secondaryTriggers.length > 0 ? "advanced" : "simple",
    triggers,
    secondaryTriggers,
    selectiveLogic: logicToCanonical(raw.selectiveLogic),

    caseSensitive: typeof raw.caseSensitive === "boolean" ? raw.caseSensitive : null,
    matchWholeWords: typeof raw.matchWholeWords === "boolean" ? raw.matchWholeWords : null,
    scanDepth: numOrNull(raw.scanDepth),

    position: positionToCanonical(raw.position),
    depth: numOr(raw.depth, 4),
    role: roleToCanonical(raw.role),

    sortOrder: numOr(raw.order, 100),
    priority: 100,

    sticky: numOr(raw.sticky, 0),
    cooldown: numOr(raw.cooldown, 0),
    delay: numOr(raw.delay, 0),

    groupName: group ? group : null,
    categoryId: str(raw.folderId) ?? null,
    groupWeight: numOr(raw.groupWeight, 1),

    probability: clamp(numOr(raw.probability, 100), 0, 100),

    useMemo: false,
    excludeRecursion: raw.excludeRecursion === true,
    preventRecursion: raw.preventRecursion === true,
    delayUntilRecursion: raw.delayUntilRecursion === true ? 1 : 0,

    characterFilter: filterToCanonical(raw),

    scanCharacterDescription: sources.includes("character_description"),
    scanCharacterPersonality: sources.includes("character_personality"),
    scanUserPersona: sources.includes("persona_description"),
    scanScenario: sources.includes("character_scenario"),

    ignoreBudget: false,
    sideEffects: null,
  };
}

// -- folders <-> categories (flat projection; the full rows ride escrow so nesting survives) --------

function foldersToCategories(folders: Rec[]): LorebookCategory[] | undefined {
  if (folders.length === 0) return undefined;
  return folders.map((f, i) => {
    const cat: LorebookCategory = { id: str(f.id) || String(i), name: str(f.name) ?? "", sortOrder: numOr(f.order, i) };
    if (typeof f.enabled === "boolean") cat.enabled = f.enabled;
    return cat;
  });
}

// -- book: native -> canonical body ----------------------------------------------------------------

/** The scalar book fields, shared by toCanonical (spread into the body) and bookToWire (the diff base). */
function bookFields(lb: Rec): Pick<
  LorebookBody,
  "name" | "description" | "lorebookType" | "tags" | "enabled" | "globalScanDepth" | "globalRecursion" | "tokenBudget" | "entryBudget"
> {
  return {
    name: str(lb.name) || "Imported Lorebook",
    description: str(lb.description) ?? null,
    lorebookType: categoryToType(lb.category),
    tags: strArray(lb.tags),
    enabled: lb.enabled !== false,
    globalScanDepth: numOr(lb.scanDepth, 2),
    globalRecursion: lb.recursiveScanning === true,
    tokenBudget: numOr(lb.tokenBudget, 2048),
    entryBudget: numOr(lb.entryLimit, 100),
  };
}

function envelopeToCanonical(env: MariEnvelope): LorebookBody {
  const lb = (env.data?.lorebook ?? {}) as Rec;
  const entries = recArray(env.data?.entries);
  const folders = recArray(env.data?.folders);
  return {
    ...bookFields(lb),
    genre: null,
    fandom: null,
    globalCaseSensitive: false,
    globalMatchWholeWords: false,
    budgetMode: "token",
    entries: ensureUniqueEntryIds(entries.map(entryToCanonical)),
    categories: foldersToCategories(folders),
  };
}

// -- entry: canonical -> native, overlaying the twin so an unedited entry re-emits verbatim ---------

/** Rebuild additionalMatchingSources: keep the twin's escrow-only members, re-apply the four flags. */
function writeSources(e: LorebookEntry, twinSources: string[]): string[] {
  const out = twinSources.filter((s) => !MAPPED_SOURCES.includes(s));
  if (e.scanCharacterDescription) out.push("character_description");
  if (e.scanCharacterPersonality) out.push("character_personality");
  if (e.scanUserPersona) out.push("persona_description");
  if (e.scanScenario) out.push("character_scenario");
  return out;
}

/** Best-effort inverse of filterToCanonical (only reached on an edited filter; the note collapse is lossy). */
function applyFilter(base: Rec, filter: CharacterFilter | null): void {
  if (!filter) {
    base.characterFilterMode = "any";
    base.characterFilterIds = [];
    base.characterTagFilterMode = "any";
    base.characterTagFilters = [];
    return;
  }
  const mode = filter.isExclude ? "exclude" : "include";
  base.characterFilterIds = filter.names;
  base.characterTagFilters = filter.tags;
  base.characterFilterMode = filter.names.length > 0 ? mode : "any";
  base.characterTagFilterMode = filter.tags.length > 0 ? mode : "any";
}

/** A valid default entry row for the cross-format (no-twin) path: Marinara schema defaults for the rest. */
function freshEntry(e: LorebookEntry): Rec {
  return {
    id: e.id,
    name: e.title,
    content: "",
    description: "",
    keys: [],
    secondaryKeys: [],
    enabled: true,
    constant: false,
    selective: false,
    selectiveLogic: "and",
    probability: null,
    scanDepth: null,
    matchWholeWords: false,
    caseSensitive: false,
    useRegex: false,
    characterFilterMode: "any",
    characterFilterIds: [],
    characterTagFilterMode: "any",
    characterTagFilters: [],
    generationTriggerFilterMode: "any",
    generationTriggerFilters: [],
    additionalMatchingSources: [],
    position: 0,
    depth: 4,
    order: 100,
    role: "system",
    sticky: null,
    cooldown: null,
    delay: null,
    ephemeral: null,
    group: "",
    groupWeight: null,
    folderId: null,
    preventRecursion: false,
    excludeRecursion: false,
    delayUntilRecursion: false,
    locked: false,
    tag: "",
    relationships: {},
    dynamicState: {},
    activationConditions: [],
    schedule: null,
    excludeFromVectorization: false,
  };
}

function entryToWire(e: LorebookEntry, twin: Rec | undefined, index: number): Rec {
  const base: Rec = twin ? (structuredClone(twin) as Rec) : freshEntry(e);
  const decoded = twin ? entryToCanonical(twin, index) : null;
  const changed = (f: keyof LorebookEntry): boolean => !decoded || !deepEq(e[f], decoded[f]);

  if (changed("triggers")) base.keys = e.triggers.map((t) => t.keyword);
  if (changed("secondaryTriggers")) base.secondaryKeys = e.secondaryTriggers.map((t) => t.keyword);
  if (changed("triggers") || changed("secondaryTriggers")) {
    const all = [...e.triggers, ...e.secondaryTriggers];
    base.useRegex = all.length > 0 && all.every((t) => t.isRegex);
  }
  if (changed("secondaryTriggers")) base.selective = e.secondaryTriggers.length > 0;

  if (changed("title")) base.name = e.title;
  if (changed("content")) base.content = e.content;
  if (changed("comment")) base.description = e.comment ?? "";
  if (changed("enabled")) base.enabled = e.enabled;
  if (changed("constant")) base.constant = e.constant;
  if (changed("selectiveLogic")) base.selectiveLogic = logicToMari(e.selectiveLogic);
  if (changed("probability")) base.probability = e.probability;
  if (changed("scanDepth")) base.scanDepth = e.scanDepth;
  if (changed("matchWholeWords")) base.matchWholeWords = e.matchWholeWords ?? false;
  if (changed("caseSensitive")) base.caseSensitive = e.caseSensitive ?? false;
  if (changed("position")) base.position = positionToMari(e.position);
  if (changed("depth")) base.depth = e.depth;
  if (changed("role")) base.role = e.role;
  if (changed("sortOrder")) base.order = e.sortOrder;
  if (changed("sticky")) base.sticky = e.sticky;
  if (changed("cooldown")) base.cooldown = e.cooldown;
  if (changed("delay")) base.delay = e.delay;
  if (changed("groupName")) base.group = e.groupName ?? "";
  if (changed("groupWeight")) base.groupWeight = e.groupWeight;
  if (changed("categoryId")) base.folderId = e.categoryId;
  if (changed("preventRecursion")) base.preventRecursion = e.preventRecursion;
  if (changed("excludeRecursion")) base.excludeRecursion = e.excludeRecursion;
  if (changed("delayUntilRecursion")) base.delayUntilRecursion = e.delayUntilRecursion > 0;

  if (
    changed("scanCharacterDescription") ||
    changed("scanCharacterPersonality") ||
    changed("scanUserPersona") ||
    changed("scanScenario")
  ) {
    base.additionalMatchingSources = writeSources(e, strArray(twin?.additionalMatchingSources));
  }
  if (changed("characterFilter")) applyFilter(base, e.characterFilter);

  return base;
}

// -- book + folders: canonical -> native, overlaying their twins -----------------------------------

function bookToWire(body: LorebookBody, twin: Rec | undefined): Rec {
  const base: Rec = twin
    ? (structuredClone(twin) as Rec)
    : {
        name: body.name,
        description: body.description ?? "",
        category: typeToCategory(body.lorebookType),
        imagePath: null,
        scanDepth: body.globalScanDepth,
        tokenBudget: body.tokenBudget,
        entryLimit: body.entryBudget ?? 100, // 0 is the valid canonical default; || silently coerced it to 100
        recursiveScanning: body.globalRecursion,
        maxRecursionDepth: 3,
        excludeFromVectorization: false,
        characterId: null,
        characterIds: [],
        personaId: null,
        personaIds: [],
        chatId: null,
        isGlobal: false,
        enabled: body.enabled ?? true,
        scope: { mode: "all", chatIds: [] },
        tags: body.tags,
        generatedBy: "import",
        sourceAgentId: null,
      };
  const decoded = twin ? bookFields(twin) : null;
  const changed = (f: keyof ReturnType<typeof bookFields>): boolean => !decoded || !deepEq(body[f], decoded[f]);

  if (changed("name")) base.name = body.name;
  if (changed("description")) base.description = body.description ?? "";
  if (changed("tags")) base.tags = body.tags;
  if (changed("enabled")) base.enabled = body.enabled ?? true;
  if (changed("globalScanDepth")) base.scanDepth = body.globalScanDepth;
  if (changed("globalRecursion")) base.recursiveScanning = body.globalRecursion;
  if (changed("tokenBudget")) base.tokenBudget = body.tokenBudget;
  if (changed("entryBudget")) base.entryLimit = body.entryBudget;
  if (changed("lorebookType")) base.category = typeToCategory(body.lorebookType);
  return base;
}

function foldersToWire(categories: LorebookCategory[] | undefined, twinFolders: Rec[]): Rec[] {
  if (!categories) return twinFolders;
  const twinById = new Map<string, Rec>();
  twinFolders.forEach((f, i) => twinById.set(str(f.id) || String(i), f));
  return categories.map((c) => {
    const twin = twinById.get(c.id);
    const base: Rec = twin ? (structuredClone(twin) as Rec) : { id: c.id, name: c.name, enabled: c.enabled ?? true, parentFolderId: null, order: c.sortOrder };
    if (str(base.name) !== c.name) base.name = c.name;
    if (c.enabled !== undefined && base.enabled !== c.enabled) base.enabled = c.enabled;
    if (base.order !== c.sortOrder) base.order = c.sortOrder;
    return base;
  });
}

function envelopeToWire(body: LorebookBody, raw: MariEnvelope | undefined): MariEnvelope {
  const base: MariEnvelope = raw
    ? (structuredClone(raw) as MariEnvelope)
    : { type: "marinara_lorebook", version: 1, exportedAt: "", data: {} };
  const twinEntries = recArray(raw?.data?.entries);
  const twinById = new Map<string, Rec>();
  twinEntries.forEach((en, i) => twinById.set(en.id != null ? String(en.id) : String(i), en));

  base.data = {
    ...(base.data ?? {}),
    lorebook: bookToWire(body, raw?.data?.lorebook),
    entries: body.entries.map((e, i) => entryToWire(e, twinById.get(e.id), i)),
    folders: foldersToWire(body.categories, recArray(raw?.data?.folders)),
  };
  return base;
}

// -- adapter ---------------------------------------------------------------------------------------

/** Parse untrusted json into a Marinara lorebook envelope, or null if it is not one. */
function readEnvelope(input: AdapterInput): MariEnvelope | null {
  const obj = readJsonObject(input) as MariEnvelope | null;
  if (!obj || obj.type !== "marinara_lorebook") return null;
  const data = obj.data;
  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.entries)) return null;
  return obj;
}

const marinaraLorebook: LorebookAdapter = {
  id: "marinara-lorebook",
  label: "Marinara-Engine lorebook (native .marinara.json export)",
  outputExtensions: ["json"],
  kind: "lorebook",

  // 1.0: the `type: "marinara_lorebook"` envelope tag is unique to this format; nothing else claims it.
  detect(input: AdapterInput): number {
    return readEnvelope(input) ? 1 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalLorebook {
    const raw = readEnvelope(input);
    if (!raw) throw new Error("marinara-lorebook: not a Marinara lorebook export");
    const body = envelopeToCanonical(raw);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "lorebook",
      id: canonicalId(body.name),
      body,
      original: { "marinara-lorebook": { raw } },
    };
  },

  fromCanonical(entity: CanonicalLorebook): AdapterOutput {
    const raw = entity.original?.["marinara-lorebook"]?.raw as MariEnvelope | undefined;
    const out = envelopeToWire(entity.body, raw);
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },
};

export default marinaraLorebook;
