// ============================================================================
// MACRO SYSTEM TYPES
// Core type definitions for the macro processor
// ============================================================================

/**
 * Context passed to macro handlers during expansion
 * Contains all the information a macro might need
 */
export interface MacroContext {
  // Identity
  characterName: string;
  characterDescription?: string;
  characterPersonality?: string;
  userName: string;
  userPersona?: string;
  modelName?: string;
  groupName?: string;

  // Character card extended fields
  scenario?: string;
  firstMessage?: string;
  mesExamples?: string[];

  // Pronouns (for character)
  characterPronouns?: {
    they: string;
    them: string;
    their: string;
    theirs: string;
    themself: string;
  };

  // Pronouns (for user)
  userPronouns?: {
    they: string;
    them: string;
    their: string;
    theirs: string;
    themself: string;
  };

  // Chat context
  messages: ChatMessage[];
  messageCount: number;
  chatId?: string;
  chatStartTime?: Date;
  lastActivityTime?: Date;

  // Chat memory summaries for context (formatted for prompt injection)
  chatMemories?: string[];
  // Persisted chat summary for {{summary}} / {{chatSummary}}
  chatSummary?: string;

  // Orison user-approved memory, available only when prompt injection is enabled
  orisonPreferences?: string;
  orisonPreferenceBlock?: string;

  // Lorebook context (for lorebook-specific macros)
  triggeredEntries?: TriggeredEntry[];
  activeLorebooks?: LorebookReference[];

  // Variables (local to chat)
  localVariables: Map<string, MacroVariable>;
  // Variables (global across chats)
  globalVariables: Map<string, MacroVariable>;

  /**
   * Character ID, used to namespace `character:` scoped variables
   * (falls back to characterName when absent).
   */
  characterId?: string;

  /**
   * Preset prompts visible to toggle-introspection macros ({{enabled::id}},
   * {{enabled_list::prefix}}, etc.). Includes ALL prompts of the active
   * preset with their EFFECTIVE enabled state (after per-chat overrides).
   * Absent when no preset is active or the call site doesn't thread it.
   */
  presetPrompts?: PresetPromptInfo[];

  // User-defined macros (ephemeral, per-assembly)
  userMacros: Map<string, string>;

  /** {{template::name::body}} definitions (ephemeral, per-assembly) */
  templates?: Map<string, string>;
  /** {{override::name::content}} registrations (ephemeral, per-assembly) */
  blockOverrides?: Map<string, string>;

  // Character colors (from details JSONB)
  characterAccentColor?: string;
  characterPalette?: Array<{ label: string; name: string; hex: string }>;
  characterGradient?: string[];

  // Persona colors (from details JSONB)
  personaAccentColor?: string;
  personaPalette?: Array<{ label: string; name: string; hex: string }>;
  personaGradient?: string[];

  // Group-chat card context (Lumiverse-compatible group macros).
  // groupCardMode: 'solo' outside group chats; 'swap' when one member
  // replies per turn (RC's group model); 'ensemble' reserved.
  groupCardMode?: string;
  focusedCharacterName?: string;
  focusedCharacterDescription?: string;
  focusedCharacterPersonality?: string;
  groupMembers?: Array<{ name: string; description?: string; personality?: string }>;

  // Reasoning tag formatting for mock-reasoning prompts
  // ({{reasoningPrefix}}/{{reasoningSuffix}}).
  reasoningPrefix?: string;
  reasoningSuffix?: string;

  // Per-generation running counters for {{rcounter::name}}. Lifetime = one
  // prompt build (the same context object is shared across all blocks of a
  // build, then discarded), so step numbering resets each generation.
  counters?: Map<string, number>;

  // Time context
  timezone?: string;
  locale?: string;

  // Random seed (optional, for deterministic testing)
  randomSeed?: number;

  /**
   * When true, side-effect macros (setvar, setglobalvar, addvar, incvar, etc.)
   * become no-ops. Used when processing historical chat messages so that
   * variable assignments in old messages do not re-fire on every turn.
   * Read macros (getvar, getglobalvar, hasvar, etc.) are unaffected.
   */
  readOnly?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

/**
 * A preset prompt as seen by toggle-introspection macros.
 */
export interface PresetPromptInfo {
  /** Database id (uuid) */
  id: string;
  /** Stable author-facing slug (ST identifier, e.g. "main", or custom id) */
  identifier: string;
  /** Display name */
  name: string;
  /** Effective enabled state, after per-chat overrides */
  enabled: boolean;
  /** Author-declared metadata fields (roster, callsign, genre_label, ...) */
  metadata?: Record<string, MacroVariableValue>;
  /** Prompt body — read by {{include::prompt_id}} */
  content?: string;
}

export interface TriggeredEntry {
  id: string;
  title: string;
  content: string;
  lorebookId: string;
  lorebookName: string;
}

export interface LorebookReference {
  id: string;
  name: string;
  entryCount: number;
}

/**
 * Variables can be primitives, arrays, or objects
 * Using interface + type pattern to avoid circular reference error
 */
export interface MacroVariableArray extends Array<MacroVariableValue> {}
export interface MacroVariableObject { [key: string]: MacroVariableValue; }
export type MacroVariableValue = string | number | boolean | null | MacroVariableArray | MacroVariableObject;

export interface MacroVariable {
  value: MacroVariableValue;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result of a macro expansion
 */
export interface MacroResult {
  /** The expanded value (string or empty for side-effect-only macros) */
  value: string;
  /** Whether the macro executed successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Side effects to apply (variable changes, etc.) */
  sideEffects?: MacroSideEffect[];
}

export interface MacroSideEffect {
  type: 'setLocalVar' | 'setGlobalVar' | 'deleteLocalVar' | 'deleteGlobalVar';
  key: string;
  value?: MacroVariableValue;
  /**
   * Name of the macro that produced this effect (e.g. "state.set",
   * "incvar"). Annotated by the processor for the debug trace; handlers
   * don't need to set it.
   */
  cause?: string;
}

/**
 * Macro handler function signature
 *
 * @param args - Arguments passed to the macro (after the macro name, split by ::)
 * @param context - Full context for the macro
 * @returns The result of the macro expansion
 */
export type MacroHandler = (
  args: string[],
  context: MacroContext
) => MacroResult;

/**
 * An argument passed to a lazy macro handler. The argument has NOT been
 * evaluated: `raw` is the original source text (whitespace preserved,
 * nested macros unexpanded); `evaluate()` expands it on demand WITHOUT
 * trimming (unlike the eager path, which trims every evaluated arg).
 *
 * Lazy args exist for macros whose body must not run unconditionally:
 * iteration ({{foreach}} substitutes $item before expanding), conditional
 * content ({{when_enabled}} must not fire side effects in a skipped
 * branch), and whitespace-sensitive output ({{sep}}, {{raw}}).
 */
export interface LazyMacroArg {
  /** Original unexpanded source text of this argument */
  raw: string;
  /** Expand the argument now (no trim applied) */
  evaluate: () => string;
}

/**
 * Handler variant receiving lazy arguments. Used when
 * MacroDefinition.lazyHandler is set; takes precedence over `handler`
 * inside the processor. Text returned in `value` is re-parsed for macros
 * by the evaluator, so a lazy handler may return raw arg text (or
 * per-item substituted copies of it) and nested macros still expand.
 */
export type LazyMacroHandler = (
  args: LazyMacroArg[],
  context: MacroContext
) => MacroResult;

/**
 * Macro definition for registration
 */
export interface MacroDefinition {
  /** Macro name (lowercase, e.g., 'char', 'random', 'getvar') */
  name: string;
  /** Aliases (e.g., 'character' for 'char') */
  aliases?: string[];
  /** Human-readable description */
  description: string;
  /** Expected arguments (for documentation/validation) */
  args?: MacroArgDef[];
  /** The handler function */
  handler: MacroHandler;
  /**
   * Lazy handler variant — receives unevaluated args (raw text +
   * evaluate-on-demand). When set, the processor calls this INSTEAD of
   * `handler`. Keep `handler` as a best-effort eager fallback for callers
   * that look up handlers directly via getMacroHandler.
   */
  lazyHandler?: LazyMacroHandler;
  /** Category for organization */
  category: MacroCategory;
  /** Whether this macro has side effects (variable mutations, etc.) */
  hasSideEffects?: boolean;
  /**
   * Nondeterministic: same args may produce different output across calls
   * (random / time-dependent). A volatile macro anywhere in a template
   * disqualifies the evaluation result from caching — see
   * MacroProcessResult.cacheable. Known built-in families are also covered
   * by the registry's volatile name set.
   */
  volatile?: boolean;
}

/**
 * Interceptor hook run around macro processing.
 * 'pre' receives the raw template before any preprocessing; 'post' receives
 * the final expanded text. Both return the (possibly modified) text.
 */
export interface MacroInterceptor {
  /** Unique id — registering the same id again replaces the previous hook */
  id: string;
  phase: 'pre' | 'post';
  fn: (text: string, context: MacroContext) => string;
}

export interface MacroArgDef {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
}

export type MacroCategory =
  | 'identity'
  | 'time'
  | 'random'
  | 'chat'
  | 'variables'
  | 'conditional'
  | 'text'
  | 'lorebook'
  | 'pronouns'
  | 'preset';

/**
 * Result of processing text through the macro system
 */
export interface MacroProcessResult {
  /** Final expanded text */
  text: string;
  /** Macros that were expanded */
  expansions: MacroExpansion[];
  /** Any errors encountered */
  errors: MacroError[];
  /** Side effects to persist */
  sideEffects: MacroSideEffect[];
  /**
   * Variables read during evaluation, as "scope:name" keys (e.g.
   * "local:nsfw_on", "global:theme"). Together with `cacheable` this is the
   * result fingerprint: a caller may reuse a previous result for the same
   * template iff cacheable is true and every touched variable's value is
   * unchanged.
   */
  touchedVariables: string[];
  /**
   * False when the evaluation hit a volatile macro (random/time family) or
   * produced side effects — such results must not be reused.
   */
  cacheable: boolean;
  /** Processing stats */
  stats: {
    totalMacros: number;
    successfulExpansions: number;
    failedExpansions: number;
    nestingDepthReached: number;
    processingTimeMs: number;
  };
}

export interface MacroExpansion {
  /** Original macro text (e.g., "{{char}}") */
  original: string;
  /** Expanded value */
  expanded: string;
  /** Macro name */
  macroName: string;
  /** Nesting depth where this was expanded */
  depth: number;
}

export interface MacroError {
  /** The macro that failed */
  macro: string;
  /** Error message */
  message: string;
  /** Position in original text */
  position?: number;
}
