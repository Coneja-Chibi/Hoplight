/**
 * RoleCall lorebook codec (RoleCallExportV1, `.json`).
 * Maps RC's nested v1 export wire (triggers/matching/injection/priority/timing/grouping/advanced/
 * scanSources groups) to the flat canonical LorebookEntry and back. Field shapes verified against
 * VAUDEVILLE packages/lorebook schemas.ts + serializer.ts + parser.ts (interop facts only).
 *
 * Lossless by escrow-of-raw: the whole parsed RoleCallExportV1 rides in escrow, so raw-only carriers
 * the canonical body does not model (tree, exportDate, per-entry unsupportedFields, trigger runtime
 * junk) survive a round-trip verbatim. fromCanonical re-projects the canonical body onto a clone of
 * the raw wire, matching entries by id; a from-scratch canonical (no escrow) serializes fresh defaults.
 *
 * NOTE: standalone codec, not yet wired into the character-only registry. Conforming it to the
 * entity-generic FormatAdapter (task #5 wiring step) is additive: id/label/outputExtensions + a type.
 */
import type { AdapterInput, AdapterOutput } from "../../core/adapter";
import type {
  CanonicalLorebook,
  LorebookBody,
  LorebookEntry,
  LorebookCategory,
  Trigger,
} from "../../entities/lorebook/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";

const RC_LOREBOOK_SCHEMA_PREFIX = "1.0.0";

/** The RC v1 export wire, kept loose: we read known fields and carry the rest in escrow. */
interface RcExportRaw {
  schemaVersion?: unknown;
  exportDate?: unknown;
  lorebook?: Record<string, unknown>;
}

/** Parse untrusted json into the RC export shape, or null if it is not one. */
function readExport(input: AdapterInput): RcExportRaw | null {
  const text = input.text ?? (input.bytes ? new TextDecoder().decode(input.bytes) : null);
  if (text == null) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (!json || typeof json !== "object") return null;
  const obj = json as RcExportRaw;
  const book = obj.lorebook;
  if (!book || typeof book !== "object" || !Array.isArray((book as { entries?: unknown }).entries)) {
    return null;
  }
  return obj;
}

/** RC v1 is unambiguous: a "1.0.0"-family schemaVersion plus a lorebook envelope with entries. */
const isRcVersion = (v: unknown): boolean =>
  typeof v === "string" && (v === RC_LOREBOOK_SCHEMA_PREFIX || v.includes(RC_LOREBOOK_SCHEMA_PREFIX));

/** Read a canonical trigger out of the wire, dropping per-session runtime junk (lastActivatedAt). */
function triggerToCanonical(t: Record<string, unknown>): Trigger {
  const out: Trigger = {
    keyword: typeof t.keyword === "string" ? t.keyword : "",
    isRegex: t.isRegex === true,
  };
  if (typeof t.flags === "string") out.flags = t.flags;
  if (typeof t.frequency === "number") out.frequency = t.frequency;
  if (typeof t.probability === "number") out.probability = t.probability;
  return out;
}

const triggersToCanonical = (arr: unknown): Trigger[] =>
  Array.isArray(arr) ? arr.map((t) => triggerToCanonical(t as Record<string, unknown>)) : [];

/** Map one nested RoleCallEntryV1 to a flat canonical LorebookEntry. */
function entryToCanonical(e: Record<string, unknown>): LorebookEntry {
  const triggers = (e.triggers ?? {}) as Record<string, unknown>;
  const matching = (e.matching ?? {}) as Record<string, unknown>;
  const injection = (e.injection ?? {}) as Record<string, unknown>;
  const priority = (e.priority ?? {}) as Record<string, unknown>;
  const timing = (e.timing ?? {}) as Record<string, unknown>;
  const grouping = (e.grouping ?? {}) as Record<string, unknown>;
  const advanced = (e.advanced ?? {}) as Record<string, unknown>;
  const scan = (e.scanSources ?? {}) as Record<string, unknown>;
  const filter = e.characterFilter as Record<string, unknown> | null | undefined;

  return {
    id: typeof e.id === "string" ? e.id : "",
    title: typeof e.title === "string" ? e.title : "",
    content: typeof e.content === "string" ? e.content : "",
    comment: (e.comment as string | null | undefined) ?? null,
    enabled: e.enabled !== false,
    constant: e.constant === true,

    triggerMode: triggers.mode === "advanced" ? "advanced" : "simple",
    triggers: triggersToCanonical(triggers.primary),
    secondaryTriggers: triggersToCanonical(triggers.secondary),
    selectiveLogic: (triggers.selectiveLogic as LorebookEntry["selectiveLogic"]) ?? "and_any",

    caseSensitive: (matching.caseSensitive as boolean | null | undefined) ?? null,
    matchWholeWords: (matching.matchWholeWords as boolean | null | undefined) ?? null,
    scanDepth: (matching.scanDepth as number | null | undefined) ?? null,

    position: (injection.position as LorebookEntry["position"]) ?? "character",
    depth: typeof injection.depth === "number" ? injection.depth : 4,
    role: (injection.role as LorebookEntry["role"]) ?? "system",

    sortOrder: typeof priority.sortOrder === "number" ? priority.sortOrder : 0,
    priority: typeof priority.priority === "number" ? priority.priority : 100,

    sticky: typeof timing.sticky === "number" ? timing.sticky : 0,
    cooldown: typeof timing.cooldown === "number" ? timing.cooldown : 0,
    delay: typeof timing.delay === "number" ? timing.delay : 0,

    groupName: (grouping.groupName as string | null | undefined) ?? null,
    categoryId: (grouping.categoryId as string | null | undefined) ?? null,
    groupWeight: typeof grouping.groupWeight === "number" ? grouping.groupWeight : 100,

    probability: typeof e.probability === "number" ? e.probability : 100,

    useMemo: advanced.useMemo === true,
    excludeRecursion: advanced.excludeRecursion === true,
    preventRecursion: advanced.preventRecursion === true,
    delayUntilRecursion: typeof advanced.delayUntilRecursion === "number" ? advanced.delayUntilRecursion : 0,

    characterFilter: filter
      ? {
          isExclude: filter.isExclude === true,
          names: Array.isArray(filter.names) ? (filter.names as string[]) : [],
          tags: Array.isArray(filter.tags) ? (filter.tags as string[]) : [],
        }
      : null,

    scanCharacterDescription: scan.characterDescription === true,
    scanCharacterPersonality: scan.characterPersonality === true,
    scanUserPersona: scan.userPersona === true,
    scanScenario: scan.scenario === true,

    ignoreBudget: advanced.ignoreBudget === true,

    sideEffects: (e.sideEffects as LorebookEntry["sideEffects"]) ?? null,
    metadata: (e.metadata as Record<string, unknown> | null | undefined) ?? undefined,
  };
}

function bookToCanonical(book: Record<string, unknown>): LorebookBody {
  const settings = (book.settings ?? {}) as Record<string, unknown>;
  const meta = (book.metadata ?? {}) as Record<string, unknown>;
  const cats = book.categories as unknown;

  const categories: LorebookCategory[] | undefined = Array.isArray(cats)
    ? cats.map((c) => {
        const cat = c as Record<string, unknown>;
        return {
          id: typeof cat.id === "string" ? cat.id : "",
          name: typeof cat.name === "string" ? cat.name : "",
          sortOrder: typeof cat.sortOrder === "number" ? cat.sortOrder : 0,
          enabled: cat.enabled !== false,
        };
      })
    : undefined;

  const body: LorebookBody = {
    name: typeof book.name === "string" ? book.name : "",
    description: (book.description as string | null | undefined) ?? null,
    lorebookType: (settings.lorebookType as LorebookBody["lorebookType"]) ?? "other",
    genre: (meta.genre as string | null | undefined) ?? null,
    fandom: (meta.fandom as string | null | undefined) ?? null,
    tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],

    globalCaseSensitive: settings.globalCaseSensitive === true,
    globalMatchWholeWords: settings.globalMatchWholeWords === true,
    globalScanDepth: typeof settings.globalScanDepth === "number" ? settings.globalScanDepth : 0,
    globalRecursion: settings.globalRecursion === true,
    tokenBudget: typeof settings.tokenBudget === "number" ? settings.tokenBudget : 0,
    budgetMode: settings.budgetMode === "entry" ? "entry" : "token",
    entryBudget: typeof settings.entryBudget === "number" ? settings.entryBudget : 0,

    entries: (book.entries as Record<string, unknown>[]).map(entryToCanonical),
  };
  if (categories) body.categories = categories;
  return body;
}

// -- serialize (canonical -> wire), re-projecting onto raw so raw-only fields survive --------------

/** Emit a canonical trigger to the wire. Advanced triggers keep their probability. */
function triggerToWire(t: Trigger): Record<string, unknown> {
  const out: Record<string, unknown> = { keyword: t.keyword, isRegex: t.isRegex };
  if (t.flags !== undefined) out.flags = t.flags;
  if (t.frequency !== undefined) out.frequency = t.frequency;
  if (t.probability !== undefined) out.probability = t.probability;
  return out;
}

/** Overlay a canonical entry onto a clone of its raw wire twin (or {} when converting fresh). */
function entryToWire(e: LorebookEntry, raw: Record<string, unknown> | undefined): Record<string, unknown> {
  const base = raw ? structuredClone(raw) : {};
  const wire: Record<string, unknown> = {
    ...base,
    id: e.id,
    title: e.title,
    content: e.content,
    comment: e.comment ?? null,
    enabled: e.enabled,
    constant: e.constant,
    triggers: {
      mode: e.triggerMode,
      primary: e.triggers.map(triggerToWire),
      secondary: e.secondaryTriggers.map(triggerToWire),
      selectiveLogic: e.selectiveLogic,
    },
    matching: {
      caseSensitive: e.caseSensitive,
      matchWholeWords: e.matchWholeWords,
      scanDepth: e.scanDepth,
    },
    injection: { position: e.position, depth: e.depth, role: e.role },
    priority: { sortOrder: e.sortOrder, priority: e.priority },
    timing: { sticky: e.sticky, cooldown: e.cooldown, delay: e.delay },
    grouping: { groupName: e.groupName, categoryId: e.categoryId ?? null, groupWeight: e.groupWeight },
    probability: e.probability,
    advanced: {
      useMemo: e.useMemo,
      excludeRecursion: e.excludeRecursion,
      preventRecursion: e.preventRecursion,
      delayUntilRecursion: e.delayUntilRecursion,
      ignoreBudget: e.ignoreBudget,
    },
    characterFilter: e.characterFilter
      ? { isExclude: e.characterFilter.isExclude, names: e.characterFilter.names, tags: e.characterFilter.tags }
      : null,
    scanSources: {
      characterDescription: e.scanCharacterDescription,
      characterPersonality: e.scanCharacterPersonality,
      userPersona: e.scanUserPersona,
      scenario: e.scanScenario,
    },
  };
  // sideEffects / metadata are additive on the wire: emit only when present, matching RC's serializer.
  if (e.sideEffects && e.sideEffects.effects.length > 0) wire.sideEffects = e.sideEffects;
  else delete wire.sideEffects;
  if (e.metadata != null) wire.metadata = e.metadata;
  else delete wire.metadata;
  return wire;
}

function bookToWire(body: LorebookBody, rawBook: Record<string, unknown> | undefined): Record<string, unknown> {
  const base = rawBook ? structuredClone(rawBook) : {};
  const rawEntries = new Map<string, Record<string, unknown>>();
  if (Array.isArray(base.entries)) {
    for (const re of base.entries as Record<string, unknown>[]) {
      if (typeof re.id === "string") rawEntries.set(re.id, re);
    }
  }

  const wire: Record<string, unknown> = {
    ...base,
    name: body.name,
    description: body.description ?? null,
    settings: {
      lorebookType: body.lorebookType ?? "other",
      globalCaseSensitive: body.globalCaseSensitive,
      globalMatchWholeWords: body.globalMatchWholeWords,
      globalScanDepth: body.globalScanDepth,
      globalRecursion: body.globalRecursion,
      tokenBudget: body.tokenBudget,
      budgetMode: body.budgetMode,
      entryBudget: body.entryBudget,
    },
    metadata: { genre: body.genre ?? null, fandom: body.fandom ?? null, tags: body.tags },
    entries: body.entries.map((e) => entryToWire(e, rawEntries.get(e.id))),
  };

  if (body.categories) {
    wire.categories = body.categories.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      enabled: c.enabled ?? true,
    }));
  }
  return wire;
}

const rolecallLorebook = {
  id: "rolecall-lorebook",
  label: "RoleCall lorebook (v1 export json)",
  outputExtensions: ["json"],
  kind: "lorebook" as const,

  detect(input: AdapterInput): number {
    const raw = readExport(input);
    if (!raw) return 0;
    return isRcVersion(raw.schemaVersion) ? 1 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalLorebook {
    const raw = readExport(input);
    if (!raw || !raw.lorebook) throw new Error("rolecall-lorebook: not a RoleCall v1 export");
    const body = bookToCanonical(raw.lorebook);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "lorebook",
      id: canonicalId(body.name),
      body,
      escrow: { "rolecall-lorebook": { raw } },
    };
  },

  fromCanonical(entity: CanonicalLorebook): AdapterOutput {
    const raw = entity.escrow?.["rolecall-lorebook"]?.raw as RcExportRaw | undefined;
    const rawBook = (raw?.lorebook ?? undefined) as Record<string, unknown> | undefined;
    const out = {
      schemaVersion: isRcVersion(raw?.schemaVersion) ? (raw?.schemaVersion as string) : RC_LOREBOOK_SCHEMA_PREFIX,
      exportDate: typeof raw?.exportDate === "string" ? raw.exportDate : new Date().toISOString(),
      lorebook: bookToWire(entity.body, rawBook),
    };
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },
};

export default rolecallLorebook;
