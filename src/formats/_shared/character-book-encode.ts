/**
 * Canonical Lorebook -> embedded `character_book` (the encode / re-embed direction).
 *
 * Split from the decode half for the line cap, and the seam is the right one: reading a book off a
 * card and writing one back are separate jobs with separate hazards. The decode side is tolerant by
 * design - it reads both the CCv3 top level and the extensions bag, first-defined wins. This side is
 * the one that has to be exact, because what it emits is what another program parses.
 */
import type {
  CanonicalLorebook,
  LorebookBody,
  LorebookEntry,
  Trigger,
  InjectionPosition,
} from "../../entities/lorebook/schema";
import { wireId } from "./character-book-id";
import { selectiveLogicToNumber, roleToNumber } from "./lore-enums";
import {
  characterBookToLorebook,
  entryToCanonical,
  type CharacterBook,
  type CharacterBookEntry,
} from "./character-book-decode";


/** Encode a canonical trigger back to the `/pattern/flags` keyword string (shared with risu/lorebook). */
export const triggerToKeyword = (t: Trigger): string =>
  t.isRegex ? `/${t.keyword}/${t.flags ?? ""}` : t.keyword;

/** Precise ext.position value (inverse of parseBookPosition's int branch); RC-only slots collapse. */
const positionToExt = (p: InjectionPosition): number | string =>
  p === "world" || p === "prepend_top"
    ? 0
    : p === "before_example"
      ? 2
      : p === "after_example"
        ? 3
        : p === "depth" || p === "append" || p === "append_bottom"
          ? 4
          : p === "scene"
            ? "scene"
            : 1; // character

/** Coarse CCv3 top-level position string. */
const positionToCoarse = (p: InjectionPosition): "before_char" | "after_char" =>
  p === "world" || p === "before_example" || p === "prepend_top" || p === "scene" ? "before_char" : "after_char";

/** Structural equality for the small JSON values we diff (triggers, primitives). */
const deepEq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Re-encode a canonical entry into a character_book entry. With a raw twin present (same-dialect
 * round-trip) we overlay onto its clone and re-write ONLY the fields whose canonical value differs
 * from the twin's decode, so an unedited entry re-emits byte-for-byte and raw-only residue survives.
 * With no twin (cross-format: the lorebook came from a worldbook file, RC, or was authored) every
 * field is written from `body` alone - the path cross-format conversion actually exercises.
 */
function entryToBook(e: LorebookEntry, twin: CharacterBookEntry | undefined, index: number): CharacterBookEntry {
  const base: CharacterBookEntry = twin
    ? (structuredClone(twin) as CharacterBookEntry)
    : { keys: [], content: "" };
  const decoded = twin ? entryToCanonical(twin, index) : null;
  const ext = (base.extensions && typeof base.extensions === "object" ? base.extensions : {}) as Record<
    string,
    unknown
  >;
  base.extensions = ext;

  const changed = (field: keyof LorebookEntry): boolean => !decoded || !deepEq(e[field], decoded[field]);
  const setExt = (field: keyof LorebookEntry, key: string, val: unknown): void => {
    if (changed(field)) ext[key] = val;
  };

  // core CCv3 top-level fields
  if (changed("triggers")) base.keys = e.triggers.map(triggerToKeyword);
  if (changed("secondaryTriggers")) base.secondary_keys = e.secondaryTriggers.map(triggerToKeyword);
  if (changed("triggers") || changed("secondaryTriggers")) {
    // use_regex is an entry-level force flag: only whole-entry-regex sets it, else a literal keyword
    // would be force-promoted on re-parse. Mixed/regex keywords survive inline as `/pattern/flags`.
    const all = [...e.triggers, ...e.secondaryTriggers];
    base.use_regex = all.length > 0 && all.every((t) => t.isRegex);
    base.selective = e.secondaryTriggers.length > 0;
  }
  if (changed("content")) base.content = e.content;
  if (changed("title")) base.name = e.title;
  if (changed("comment")) base.comment = e.comment ?? undefined;
  if (changed("enabled")) base.enabled = e.enabled;
  if (changed("constant")) base.constant = e.constant;
  if (changed("sortOrder")) base.insertion_order = e.sortOrder;
  if (changed("priority")) base.priority = e.priority;
  if (changed("caseSensitive")) base.case_sensitive = e.caseSensitive ?? undefined;
  if (changed("position")) {
    base.position = positionToCoarse(e.position);
    ext.position = positionToExt(e.position);
  }

  // ST-extended fields -> extensions (pick() reads the extensions bag first)
  setExt("selectiveLogic", "selective_logic", selectiveLogicToNumber(e.selectiveLogic));
  setExt("depth", "depth", e.depth);
  setExt("role", "role", roleToNumber(e.role));
  setExt("scanDepth", "scan_depth", e.scanDepth);
  setExt("groupName", "group", e.groupName ?? "");
  setExt("groupWeight", "group_weight", e.groupWeight);
  setExt("sticky", "sticky", e.sticky);
  setExt("cooldown", "cooldown", e.cooldown);
  setExt("delay", "delay", e.delay);
  setExt("excludeRecursion", "exclude_recursion", e.excludeRecursion);
  setExt("preventRecursion", "prevent_recursion", e.preventRecursion);
  setExt("delayUntilRecursion", "delay_until_recursion", e.delayUntilRecursion);
  setExt("useMemo", "use_memo", e.useMemo);
  setExt("ignoreBudget", "ignore_budget", e.ignoreBudget);
  setExt("scanCharacterDescription", "matchCharacterDescription", e.scanCharacterDescription);
  setExt("scanCharacterPersonality", "matchCharacterPersonality", e.scanCharacterPersonality);
  setExt("scanUserPersona", "matchPersonaDescription", e.scanUserPersona);
  setExt("scanScenario", "matchScenario", e.scanScenario);

  // Authored ST-lineage toggles, de-kept. Only write when the canonical value is defined (undefined =
  // the format has no such field) AND changed vs the twin, so a byte-identical overlay is untouched.
  if (e.scanCharacterDepthPrompt !== undefined)
    setExt("scanCharacterDepthPrompt", "matchCharacterDepthPrompt", e.scanCharacterDepthPrompt);
  if (e.scanCreatorNotes !== undefined) setExt("scanCreatorNotes", "matchCreatorNotes", e.scanCreatorNotes);
  if (e.vectorized !== undefined) setExt("vectorized", "vectorized", e.vectorized);
  if (e.groupOverride !== undefined) setExt("groupOverride", "group_override", e.groupOverride);
  if (e.useGroupScoring !== undefined) setExt("useGroupScoring", "use_group_scoring", e.useGroupScoring);
  if (e.automationId !== undefined) setExt("automationId", "automation_id", e.automationId);
  if (e.displayIndex != null) setExt("displayIndex", "display_index", e.displayIndex);
  setExt("characterFilter", "characterFilter", e.characterFilter
    ? { isExclude: e.characterFilter.isExclude, names: e.characterFilter.names, tags: e.characterFilter.tags }
    : undefined);

  if (changed("probability")) {
    ext.probability = e.probability;
    ext.useProbability = e.probability < 100;
  }

  if (Object.keys(ext).length === 0) delete base.extensions;
  return base;
}


/**
 * Map ONE canonical lorebook back to an embedded character_book. `rawBook` is the twin from the
 * lorebook's OWN original (original-of-raw), NOT the host card - so same-dialect round-trips overlay and
 * cross-format encodes from scratch. Book-level fields diff against the twin's decode the same way.
 */
export function lorebookToCharacterBook(body: LorebookBody, rawBook?: CharacterBook): CharacterBook {
  const twinById = new Map<string, CharacterBookEntry>();
  (rawBook?.entries ?? []).forEach((en, i) => twinById.set(en.id != null ? String(en.id) : String(i), en));
  /** Ids already spoken for in this book, so wireId can keep them unique. */
  const taken = new Set<number>();

  const base: CharacterBook = rawBook ? (structuredClone(rawBook) as CharacterBook) : { entries: [] };
  /**
   * The id is stamped HERE rather than inside entryToBook, because uniqueness is a property of the
   * whole book and cannot be decided one entry at a time.
   *
   * It is written unconditionally, twin or no twin. A same-dialect round trip re-derives the same
   * integer from the same source id, so a byte-identical card stays byte-identical - but a book
   * that arrived with a GUID and a raw twin used to keep the GUID, which is precisely the card that
   * was reported as unimportable.
   */
  base.entries = body.entries.map((e, i) => {
    const out = entryToBook(e, twinById.get(e.id), i);
    out.id = wireId(e.id, i, taken);
    return out;
  });

  const decoded = rawBook ? characterBookToLorebook(rawBook) : null;
  const bchanged = (f: keyof LorebookBody): boolean => !decoded || !deepEq(body[f], decoded[f]);
  if (bchanged("name")) base.name = body.name;
  if (bchanged("description")) base.description = body.description ?? undefined;
  if (bchanged("globalScanDepth")) base.scan_depth = body.globalScanDepth;
  if (bchanged("tokenBudget")) base.token_budget = body.tokenBudget;
  if (bchanged("globalRecursion")) base.recursive_scanning = body.globalRecursion;
  return base;
}

/**
 * Re-embed referenced lorebooks into a CCv3 card's `data` object, in place. Every CCv2/v3-family card
 * writer (SillyTavern, RoleCall, Risu) shares this: write the single book at `data.character_book` and
 * clear the `data.extensions.character_book` fallback so no stale duplicate survives. An explicitly
 * empty resolved set clears both slots, making canonical links authoritative over the raw card twin.
 * This is the export half of the bundle contract; import lives in extractCharacterBook.
 */
export function embedCharacterBook(data: Record<string, unknown>, lorebooks: CanonicalLorebook[]): void {
  const book = lorebooksToCharacterBook(lorebooks);
  const ext = data.extensions;
  if (ext && typeof ext === "object") delete (ext as Record<string, unknown>).character_book;
  if (!book) {
    delete data.character_book;
    return;
  }
  data.character_book = book;
}

/**
 * Resolve knowledge refs to a single embedded character_book (the format supports exactly one).
 * 1 -> 1 overlays/encodes that book. N -> 1 concatenates entries under the first book's settings and
 * records the source boundaries in `extensions.vaud_source_books` so the split is recoverable later
 * (rather than silently dropping refs). Returns null for an empty ref set.
 */
export function lorebooksToCharacterBook(lorebooks: CanonicalLorebook[]): CharacterBook | null {
  if (lorebooks.length === 0) return null;
  const rawOf = (l: CanonicalLorebook): CharacterBook | undefined =>
    l.original?.["character-book"]?.raw as CharacterBook | undefined;
  if (lorebooks.length === 1) return lorebookToCharacterBook(lorebooks[0]!.body, rawOf(lorebooks[0]!));

  const books = lorebooks.map((l) => lorebookToCharacterBook(l.body, rawOf(l)));
  return {
    ...books[0]!,
    entries: books.flatMap((b) => b.entries),
    extensions: {
      ...(books[0]!.extensions ?? {}),
      vaud_source_books: lorebooks.map((l, i) => ({ name: l.body.name, entryCount: books[i]!.entries.length })),
    },
  };
}
