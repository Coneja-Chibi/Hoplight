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
 * A field earns a first-class slot only if some real WIRE format emits it. RC in-memory-only fields
 * with no serializer producer (allowRecursion, boostIds, boostAmount, scanPreset, probabilityMode -
 * verified absent from packages/lorebook serializeEntryToRoleCallV1 + the ST serializer) ride escrow,
 * not the canonical body: first-classing a field nothing serializes is dead surface. Likewise ST's
 * extra scan sources (matchCharacterDepthPrompt, matchCreatorNotes) stay in escrow since the RC
 * baseline models only the four scan sources below; promote on a real second need.
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

  /** bypass token budget - always inject */
  ignoreBudget: boolean;

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
