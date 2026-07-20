/** Canonical regex entity shape shared by adapters, storage, and editors. */
import type { CanonicalEntity } from "../../core/canonical";

/**
 * CanonicalRegexSet - the find/replace-script entity (same hub-spoke shape as lorebook/persona/pack:
 * body is the authored content; stored under studio/regex/<id>.json). Field map + cross-format survey
 * lives in design/REGEX-FORMATS.md (read it before touching this file - every field below is cited
 * there with its source platform).
 *
 * A regex SET is a named, ordered collection of RULES. One rule maps 1:1 to an ST script row / Risu
 * customscript row / RC rule / Lumiverse script / Marinara script; one set maps to an ST standalone
 * file or card bundle, an RC script, a Lumi folder/pack slice, a Risu card/module list, a Marinara
 * collection (REGEX-JEWEL-PLAN.md's "definition of the thing").
 *
 * SAFETY: a rule is DATA. Applying one is String.replace, never eval - see core/regex/apply.ts (R2)
 * for the budgeted engine and the sandbox doctrine in REGEX-FORMATS.md "Safety posture".
 */

/**
 * Pipeline phase a rule runs at. Open union (string & {}) because a platform can add a phase vaud has
 * never seen (the position-picker law: this is the raw vocabulary, per-platform legality lives in
 * core/regex/platform-fields.ts, never a UI literal). Canonical display order per REGEX-FORMATS.md
 * divergence axis 2: input, output, request, display, prompt, lorebook, reasoning, slash, memory.
 */
export type RegexPhase =
  | "input"
  | "output"
  | "request"
  | "display"
  | "prompt"
  | "lorebook"
  | "reasoning"
  | "slash"
  | "memory"
  | (string & {});

/** Lumiverse's orthogonal target axis (placement x target matrix); absent = platform default. */
export type RegexTargetChannel = "prompt" | "response" | "display";

/**
 * Deterministic rule chaining (vaud-engine-only, R2X): run the carrying rule only when the rule
 * named by `ruleId` DID (`matched: true`) or DID NOT (`matched: false`) apply earlier in the same
 * pass. One pass, sortOrder order: a condition naming a rule that has not run yet (or does not
 * exist) skips the carrying rule with an honest trace reason - never forward-resolves.
 */
export interface RegexRuleCondition {
  ruleId: string;
  matched: boolean;
}

/**
 * Find-side macro substitution mode (ST/RC share none/raw/escaped; Lumi adds "after" - substitute
 * after the replace runs, exact semantics pending the R1 residual read of
 * regex-scripts.service.ts). Risu and Marinara have no such control (capability-hidden, data kept).
 */
export type RegexSubstitution = "none" | "raw" | "escaped" | "after";

/**
 * One find/replace rule. `find`/`flags` are stored SEPARATELY (the Risu/RC/Lumi encoding); the
 * SillyTavern codec folds/unfolds its single `/pattern/flags` wire string on import/export (the
 * lorebook `keywordToTrigger` precedent). `flags` is stored VERBATIM, including Risu extension
 * tokens observed live (e.g. "gu<cbs>") - never stripped except at compile time inside the engine
 * (core/regex/apply.ts), never here.
 */
export interface RegexRule {
  /** stable rule id, preserved across round-trips */
  id: string;
  label: string;
  /** internal creator note; distinct from label (Lumiverse `description`) */
  note?: string;
  /** bare pattern, NO delimiters */
  find: string;
  /** verbatim flags string; default "g"; may carry non-JS extension tokens */
  flags: string;
  /** Risu `ableFlag`: whether the custom flags string applies */
  useFlags?: boolean;
  /** verbatim; may carry $1/{{match}}/CBS/HTML - render only through SealedHtmlPreview */
  replace: string;
  /** ST/RC/Lumi: fragments stripped from the match before replace */
  trimStrings?: string[];
  phases: RegexPhase[];
  /** Lumiverse's placement x target matrix; absent = platform default */
  targets?: RegexTargetChannel[];
  /** find-side macro substitution mode; absent = "none" */
  substituteFind?: RegexSubstitution;
  /** ST/RC/Lumi/Marinara depth window (message depth, 0 = most recent - exact counting per platform
   * is an R1 residual, see REGEX-FORMATS.md) */
  minDepth?: number | null;
  maxDepth?: number | null;
  /** ST/RC/Lumi: re-apply this rule when a message is edited */
  runOnEdit?: boolean;
  /** Marinara `targetCharacterIds`: limit to specific recipient characters; empty/absent = all */
  characterIds?: string[];
  /**
   * Vaud-engine-only (R2X, no wire home anywhere - travel lint marks these three under every
   * platform lens; export keeps the data canonical-side and emits nothing):
   * replace only the FIRST match even under a global flag.
   */
  firstMatchOnly?: boolean;
  /** Vaud-engine-only: run only when another rule in this set did (or did not) apply this pass. */
  condition?: RegexRuleCondition;
  /**
   * Vaud-engine-only: display-channel rule that returns match spans + replacement as an OVERLAY
   * instead of mutating text (ST names this "Overlay strategy" and implements it nowhere).
   */
  overlay?: boolean;
  enabled: boolean;
  sortOrder: number;
  /**
   * Per-platform leftovers with no first-class home (Lumi telemetry/scope/script_id, ST id/uuid,
   * ...). Sealed, round-trips untouched - the lossless-escrow doctrine.
   */
  extras?: Record<string, unknown>;
}

export interface RegexSetBody {
  name: string;
  description?: string;
  /**
   * Set-level on/off (the Library shelf's enable switch; the lorebook `enabled?` precedent). Absent
   * = on; always read as `enabled !== false`. An off set skips export the way an off lorebook does.
   * Additive and optional so the risu character codec and the in-flight set editor stay compatible.
   */
  enabled?: boolean;
  rules: RegexRule[];
}

export type CanonicalRegexSet = CanonicalEntity<"regex", RegexSetBody>;

/** A blank regex set (no rules yet) - the seed the Library's "new set" flow saves and opens. */
export const emptyRegexSetBody = (name: string): RegexSetBody => ({
  name,
  rules: [],
});

/**
 * Narrow character-card view of a regex rule: the Risu `customScripts` legacy shape (singular
 * `phase`, no id/enabled/sortOrder - the card wire has none of those). `entities/character/schema.ts`
 * re-exports this as its `RegexScript` so there is one definition, not two independently-maintained
 * shapes (REGEX-JEWEL-PLAN.md R0). It is intentionally NOT `RegexRule` itself: `RegexRule.phases` is
 * an array and requires `id`/`enabled`/`sortOrder`, which would silently change
 * `CharacterBehavior.regexScripts`'s wire contract and break the risu codec's round-trip tests
 * (`src/formats/risu/risu.test.ts`, out of this phase's scope) - reality over a literal full alias.
 * `RegexRule` is what the standalone regex entity (and its editor) uses; this stays the small
 * card-embedded twin until a real migration replaces `customScripts` with regex-entity refs.
 */
export interface CharacterRegexScript {
  label?: string;
  find: string;
  replace: string;
  /** pipeline phase, open union: "edittrans" | "editoutput" | "editdisplay" | ... */
  phase: string;
  /** custom regex flags (Risu `flag`) */
  flags?: string;
  /** whether the custom flags apply (Risu `ableFlag`) */
  useFlags?: boolean;
}
