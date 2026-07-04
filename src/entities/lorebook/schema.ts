import type { CanonicalEntity } from "../../core/canonical";

/**
 * CanonicalLorebook - the world-info / knowledge-base entity. Adopts the RoleCall LorebookEntry as
 * the canonical baseline (it is a practical superset of SillyTavern World Info, Risu, Agnai, Chub,
 * Lumiverse, and NovelAI's portable surface). Field map + cross-format coverage in
 * design/LOREBOOK-FORMATS.md and specs/formats/rolecall-lorebook.md.
 *
 * Only PORTABLE format content is first-classed here. RC's DB/platform baggage (creator, stats,
 * publishing status, fork lineage, versioning, timestamps, token counts, per-session runtime state)
 * is NOT part of the canonical body - it rides in escrow or on the Entity wrapper, exactly as the
 * character body strips its DB fields. A character references lorebooks by id via
 * CharacterBody.knowledgeRefs (ordered); a format that must embed the book resolves those on export.
 *
 * The wire gate still holds: a field earns a first-class slot only if some real WIRE format SERIALIZES
 * it. RC in-memory-only fields with no serializer producer (allowRecursion, boostIds, boostAmount,
 * scanPreset, probabilityMode - verified absent from packages/lorebook serializeEntryToRoleCallV1 + the
 * ST serializer) ride escrow: first-classing a field nothing serializes is dead surface. But under the
 * schema-is-editor doctrine, an AUTHORED field a real format DOES serialize gets a slot even if only one
 * format produces it (single-platform is not a reason to escrow). So ST's extra scan sources
 * (matchCharacterDepthPrompt, matchCreatorNotes), the vectorized/group-override/group-scoring toggles,
 * the automation binding, and the distinct displayIndex axis are first-classed below - they are ST wire
 * fields a creator sets, not in-memory residue.
 */

/**
 * A keyword/regex trigger. "Advanced" triggers carry their own `probability` (overriding the entry
 * fallback); "simple" triggers omit it and use the entry-level probability. `frequency` is config
 * (min messages between activations); per-session runtime counters are not part of portable content.
 */
export interface Trigger {
  keyword: string;
  isRegex: boolean;
  /** regex flags: g, i, m, s, u, y */
  flags?: string;
  /** min messages that must pass before this trigger can re-activate its entry */
  frequency?: number;
  /** advanced mode only: per-trigger activation chance 0-100, overrides the entry fallback */
  probability?: number;
}

/** How primary + secondary keywords combine. */
export type SelectiveLogic = "and_any" | "and_all" | "not_any" | "not_all";

/**
 * Where the entry content is injected. `world`/`character` are the portable floor (ST before/after
 * char); the rest are richer positions that degrade to the floor on downcast to CCv2 character_book.
 */
export type InjectionPosition =
  | "world"
  | "character"
  | "before_example"
  | "after_example"
  | "depth"
  | "append"
  | "append_bottom"
  | "prepend_top"
  | "scene";

export type MessageRole = "system" | "user" | "assistant";

/** Whitelist (isExclude:false) or blacklist (isExclude:true) an entry to specific characters. */
export interface CharacterFilter {
  names: string[];
  tags: string[];
  isExclude: boolean;
}

export type SideEffectType = "setvar" | "addvar" | "incvar" | "decvar" | "delvar";

/** A variable mutation performed when an entry activates (declarative data, never executed by vaud). */
export interface EntrySideEffect {
  type: SideEffectType;
  variable: string;
  /** for setvar */
  value?: string;
  /** for addvar/incvar/decvar */
  amount?: number;
  scope: "local" | "global";
}

export interface EntrySideEffects {
  effects: EntrySideEffect[];
  onlyOnFirstTrigger: boolean;
  clearOnDeactivate: boolean;
}

/**
 * NovelAI per-entry context-assembly config: authored prompt-shaping dials a creator sets in the NAI
 * lorebook UI (prefix/suffix are authored TEXT, e.g. "[ Mal: " / " ]\n"). All optional; formats without
 * an assembly layer omit the whole block. NAI's `budgetPriority` is deliberately NOT here - it is the
 * placement axis and lives in `sortOrder` (one home per axis, see the sortOrder/priority split below).
 */
export interface EntryContextConfig {
  /** text prepended to the entry when inserted */
  prefix?: string;
  /** text appended to the entry when inserted */
  suffix?: string;
  /** per-entry token budget cap */
  tokenBudget?: number;
  /** tokens reserved so the entry is not trimmed away */
  reservedTokens?: number;
  /** trim strategy: "doNotTrim" | "trimBottom" | "trimTop" (open: NAI may add values) */
  trimDirection?: string;
  /** join strategy: "newline" | "space" | "token" */
  insertionType?: string;
  /** trim granularity: "sentence" | "newline" | "token" */
  maximumTrimType?: string;
  /** signed offset within the target context section (NOT canonical depth - a different axis) */
  insertionPosition?: number;
}

export interface LorebookEntry {
  /** stable entry id, preserved across round-trips (categories reference it) */
  id: string;
  /** entry label (maps to ST `comment`) */
  title: string;
  content: string;
  /** internal creator note; distinct from title, has no ST home (RC-only) */
  comment?: string | null;
  enabled: boolean;
  /** always inject regardless of keyword match */
  constant: boolean;

  triggerMode: "simple" | "advanced";
  triggers: Trigger[];
  secondaryTriggers: Trigger[];
  selectiveLogic: SelectiveLogic;

  /** null = inherit the lorebook global */
  caseSensitive: boolean | null;
  matchWholeWords: boolean | null;
  scanDepth: number | null;

  position: InjectionPosition;
  /** used when position is "depth" or "append" */
  depth: number;
  role: MessageRole;

  /**
   * Placement / insertion order: where the entry lands relative to its siblings in the assembled
   * prompt. The universal ordering axis - ST `order`, Risu `insertorder`, CCv3 `insertion_order`,
   * Agnai `weight`, RC `sortOrder`. (ST's cosmetic `displayIndex` is a distinct display axis with only
   * one source format, so it rides escrow, not a canonical slot.)
   */
  sortOrder: number;
  /**
   * Eviction / budget priority: which entries survive when the token budget is exceeded (higher
   * survives). A separate axis from placement - CCv3 `priority`, Agnai `priority`, RC `priority`.
   * Formats with no eviction field (ST, Risu) default this to 100.
   */
  priority: number;

  sticky: number;
  cooldown: number;
  delay: number;

  groupName: string | null;
  /** references a LorebookCategory.id */
  categoryId: string | null;
  groupWeight: number;

  /** entry-level activation chance 0-100 (fallback for simple triggers) */
  probability: number;

  useMemo: boolean;

  /** will NOT be found during recursion (direct matches only) */
  excludeRecursion: boolean;
  /** this entry's content will NOT trigger other entries */
  preventRecursion: boolean;
  /** only activate at recursion level N (0 = first pass) */
  delayUntilRecursion: number;

  characterFilter: CharacterFilter | null;

  scanCharacterDescription: boolean;
  scanCharacterPersonality: boolean;
  scanUserPersona: boolean;
  scanScenario: boolean;
  /** extra ST worldinfo scan sources (undefined = not produced by this format / off) */
  scanCharacterDepthPrompt?: boolean;
  scanCreatorNotes?: boolean;

  /** bypass token budget - always inject */
  ignoreBudget: boolean;

  /**
   * Authored ST-lineage entry toggles that only some formats carry (optional: undefined = the format has
   * no such field, distinct from an explicit false a producer set). First-classed per the schema-is-editor
   * doctrine, not escrow. `vectorized` is the RAG toggle (the SETTING, not the vectors, which stay escrow);
   * `groupOverride`/`useGroupScoring` extend the groupName/groupWeight mutual-exclusion axis; `automationId`
   * binds an entry to a Quick-Reply automation by id (the id only, the automation set stays escrow).
   */
  vectorized?: boolean;
  groupOverride?: boolean;
  useGroupScoring?: boolean;
  automationId?: string | null;
  /** NovelAI: keys match relative to the entry's own insertion point, not the story tail */
  keyRelative?: boolean;
  /** NovelAI: entry can activate outside story text (e.g. from a UI action) */
  nonStoryActivatable?: boolean;
  /** NovelAI authored per-entry assembly config (prefix/suffix/trim/budget dials) */
  contextConfig?: EntryContextConfig;
  /**
   * Creator's manual display order in the editor list - a DISTINCT authored axis from `sortOrder`
   * (placement in the assembled prompt). Real ST cards prove they diverge (Seraphina: sortOrder all 100,
   * displayIndex 0-3), so it is NOT regenerable from sortOrder. null/undefined = follow sortOrder.
   */
  displayIndex?: number | null;

  sideEffects: EntrySideEffects | null;

  /** extensible bag for format-specific data with no first-class home */
  metadata?: Record<string, unknown>;
}

/** A folder grouping entries within a lorebook. */
export interface LorebookCategory {
  id: string;
  name: string;
  sortOrder: number;
  enabled?: boolean;
}

export type LorebookType = "world" | "character" | "scenario" | "rules" | "utility" | "other";

export interface LorebookBody {
  name: string;
  description?: string | null;
  lorebookType?: LorebookType | null;
  genre?: string | null;
  fandom?: string | null;
  tags: string[];

  /** global matching defaults; entries with null matching options inherit these */
  globalCaseSensitive: boolean;
  globalMatchWholeWords: boolean;
  globalScanDepth: number;
  globalRecursion: boolean;
  tokenBudget: number;
  budgetMode: "token" | "entry";
  entryBudget: number;

  entries: LorebookEntry[];
  categories?: LorebookCategory[];
}

export type CanonicalLorebook = CanonicalEntity<"lorebook", LorebookBody>;
