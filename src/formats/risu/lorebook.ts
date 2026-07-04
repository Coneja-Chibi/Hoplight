/**
 * RisuAI native lorebook codec (standalone `.json` / `.lorebook`, the `vaud convert` lorebook path).
 * Risu's "export lorebook" writes an envelope `{ type: "risu", ver: 1, data: loreBook[] }`; each
 * `loreBook` uses Risu-native field names that DIFFER from CCv3: `key`/`secondkey` are COMMA-joined
 * strings (not arrays), `comment` is the label, `insertorder` is the placement order, `alwaysActive`
 * is the always-on flag, `activationPercent` is the trigger chance, `useRegex` forces regex keys, and
 * `mode`/`folder` carry Risu's entry-folder hierarchy. Verified against RisuAI src (characterCards.ts
 * loreBook<->character_book, process/lorebook.svelte.ts export/importLoreBook) - interop facts only.
 *
 * CONTAINER-INVARIANCE CONTRACT: the SAME Risu lore must canonicalize identically whether it arrives
 * here as a native envelope or embedded in a `.charx` (which routes through _shared/character-book.ts).
 * Risu's own writer equates the two field-for-field (`insertion_order: lore.insertorder`,
 * `constant: lore.alwaysActive`, `name`+`comment: lore.comment`, `keys: lore.key.split(",")`,
 * `use_regex: lore.useRegex`, `case_sensitive` <- `extentions.risu_case_sensitive`, probability <-
 * `extensions.risu_activationPercent`), so every shared field below maps to the exact canonical value
 * character-book.ts produces. `insertorder` therefore lands in `sortOrder` (NOT priority), matching
 * the embedded path. `role` is the one native-richer field (Risu's own `.charx` writer drops it), so
 * it maps here rather than being discarded. `mode`/`folder`/`loreCache`/`bookVersion` have no canonical
 * home; escrow-of-raw carries them so a same-format round-trip is byte-identical.
 */
import type { LorebookAdapter, AdapterInput, AdapterOutput } from "../../core/adapter";
import type {
  CanonicalLorebook,
  LorebookBody,
  LorebookEntry,
  MessageRole,
  Trigger,
} from "../../entities/lorebook/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonObject } from "../_shared/card-io";
import { keywordToTrigger, triggerToKeyword } from "../_shared/character-book";

/** One Risu-native lore entry. Comma-joined key strings; ST extras live under `extentions` (sic). */
interface LoreBook {
  key?: string;
  secondkey?: string;
  insertorder?: number;
  comment?: string;
  content?: string;
  mode?: "multiple" | "constant" | "normal" | "child" | "folder";
  alwaysActive?: boolean;
  selective?: boolean;
  role?: MessageRole;
  extentions?: { risu_case_sensitive?: boolean };
  activationPercent?: number;
  useRegex?: boolean;
  id?: string;
  [k: string]: unknown;
}

interface RisuLoreExport {
  type?: unknown;
  ver?: unknown;
  data?: unknown;
  [k: string]: unknown;
}

// -- tolerant coercion (Risu string-coerces numbers/bools in the wild) -----------------------------

const boolish = (v: unknown): boolean => v === true || v === "true";
const optionalBoolish = (v: unknown): boolean | null =>
  v === true || v === "true" ? true : v === false || v === "false" ? false : null;
const numish = (v: unknown, fallback: number): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
};

/** Risu joins keywords with commas; split back, trim, drop empties (matches character-book output). */
const splitKeys = (csv: unknown): string[] =>
  typeof csv === "string" ? csv.split(",").map((k) => k.trim()).filter((k) => k.length > 0) : [];

const stringRole = (v: unknown): MessageRole => (v === "user" ? "user" : v === "assistant" ? "assistant" : "system");

// -- entry: native -> canonical (must equal character-book.ts for shared fields) -------------------

function entryToCanonical(entry: LoreBook, index: number): LorebookEntry {
  const forceRegex = boolish(entry.useRegex);
  const probability = Math.min(100, Math.max(0, numish(entry.activationPercent, 100)));
  // character-book stamps per-trigger probability onto each keyword when the entry chance is not 100;
  // mirror it so an embedded-vs-native diff sees identical triggers.
  const toTriggers = (csv: unknown): Trigger[] =>
    splitKeys(csv).map((k) => {
      const t = keywordToTrigger(k, forceRegex);
      return probability !== 100 ? { ...t, probability } : t;
    });

  const selective = boolish(entry.selective);
  const secondaryTriggers = selective ? toTriggers(entry.secondkey) : [];
  const label = typeof entry.comment === "string" && entry.comment ? entry.comment : `Entry ${index + 1}`;

  return {
    id: entry.id != null ? String(entry.id) : String(index),
    title: label,
    content: typeof entry.content === "string" ? entry.content : "",
    comment: typeof entry.comment === "string" ? entry.comment : null, // Risu writes name AND comment = comment

    enabled: true, // native lore has no per-entry disable flag; Risu always emits enabled:true
    constant: boolish(entry.alwaysActive),

    triggerMode: selective || secondaryTriggers.length > 0 ? "advanced" : "simple",
    triggers: toTriggers(entry.key),
    secondaryTriggers,
    selectiveLogic: "and_any", // native carries no secondary-key logic

    caseSensitive: optionalBoolish(entry.extentions?.risu_case_sensitive),
    matchWholeWords: null, // native has no entry flag (it rides content as an @@ decorator)
    scanDepth: null, // scan depth is character-level in Risu, not per-entry

    position: "character", // native lore has no position/depth; Risu defaults to the character slot
    depth: 4,
    role: stringRole(entry.role),

    sortOrder: numish(entry.insertorder, index), // insertorder === CCv3 insertion_order -> sortOrder
    priority: 100, // no eviction-priority axis in native lore

    sticky: 0,
    cooldown: 0,
    delay: 0,

    groupName: null,
    categoryId: null,
    groupWeight: 1,

    probability,

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

function bookToCanonical(entries: LoreBook[]): LorebookBody {
  return {
    name: "", // the native envelope carries no book-level name (it lives on the Risu character)
    description: null,
    lorebookType: "character",
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

// -- entry: canonical -> native, overlaying the escrow twin so unedited entries re-emit verbatim ----

const allRegex = (ts: Trigger[]): boolean => ts.length > 0 && ts.every((t) => t.isRegex);

/** Structural equality for the small values we diff (triggers, primitives). */
const deepEq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Re-encode a canonical entry into a native loreBook. With a raw twin (same-format round-trip) we
 * overlay onto its clone and rewrite ONLY fields whose canonical value changed, so an unedited entry
 * re-emits byte-for-byte (comma spacing preserved, `mode`/`folder`/`loreCache` residue untouched).
 * With no twin (cross-format) every field is written from `body` alone.
 */
function entryToWire(e: LorebookEntry, twin: LoreBook | undefined, index: number): LoreBook {
  const base: LoreBook = twin
    ? (structuredClone(twin) as LoreBook)
    : { key: "", secondkey: "", insertorder: 100, comment: "", content: "", mode: "normal", alwaysActive: false, selective: false };
  const decoded = twin ? entryToCanonical(twin, index) : null;
  const changed = (field: keyof LorebookEntry): boolean => !decoded || !deepEq(e[field], decoded[field]);

  if (changed("triggers")) {
    base.key = e.triggers.map(triggerToKeyword).join(", ");
    base.useRegex = allRegex([...e.triggers, ...e.secondaryTriggers]);
  }
  if (changed("secondaryTriggers")) base.secondkey = e.secondaryTriggers.map(triggerToKeyword).join(", ");
  if (changed("triggers") || changed("secondaryTriggers")) base.selective = e.secondaryTriggers.length > 0;
  if (changed("title")) base.comment = e.title; // native `comment` IS the label
  if (changed("content")) base.content = e.content;
  if (changed("sortOrder")) base.insertorder = e.sortOrder;
  if (changed("constant")) base.alwaysActive = e.constant; // leave `mode` to escrow-of-raw
  if (changed("role")) base.role = e.role;
  if (changed("probability")) base.activationPercent = e.probability;
  if (changed("caseSensitive")) {
    base.extentions = { ...(base.extentions ?? {}), risu_case_sensitive: e.caseSensitive === true };
  }
  if (twin == null && e.id != null) base.id = e.id;
  return base;
}

function bookToWire(body: LorebookBody, raw: RisuLoreExport | undefined): RisuLoreExport {
  const twinData = Array.isArray(raw?.data) ? (raw!.data as LoreBook[]) : [];
  const twinById = new Map<string, LoreBook>();
  twinData.forEach((en, i) => twinById.set(en.id != null ? String(en.id) : String(i), en));

  return {
    ...(raw ? structuredClone(raw) : {}),
    type: "risu",
    ver: typeof raw?.ver === "number" ? raw.ver : 1,
    data: body.entries.map((e, i) => entryToWire(e, twinById.get(e.id), i)),
  };
}

// -- adapter ---------------------------------------------------------------------------------------

/** Parse untrusted json into the Risu lore envelope, or null if it is not one. */
function readExport(input: AdapterInput): RisuLoreExport | null {
  const obj = readJsonObject(input) as RisuLoreExport | null;
  if (!obj || obj.type !== "risu" || !Array.isArray(obj.data)) return null;
  return obj;
}

const risuLorebook: LorebookAdapter = {
  id: "risu-lorebook",
  label: "RisuAI lorebook (native export json)",
  outputExtensions: ["json"],
  kind: "lorebook",

  // 1.0: the `{ type: "risu", ver, data }` envelope is unambiguous - no other format claims it.
  detect(input: AdapterInput): number {
    return readExport(input) ? 1 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalLorebook {
    const raw = readExport(input);
    if (!raw) throw new Error("risu-lorebook: not a Risu lorebook export");
    const body = bookToCanonical(raw.data as LoreBook[]);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "lorebook",
      id: canonicalId(body.name),
      body,
      escrow: { "risu-lorebook": { raw } },
    };
  },

  fromCanonical(entity: CanonicalLorebook): AdapterOutput {
    const raw = entity.escrow?.["risu-lorebook"]?.raw as RisuLoreExport | undefined;
    const out = bookToWire(entity.body, raw);
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },
};

export default risuLorebook;
