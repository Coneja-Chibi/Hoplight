// ============================================================================
// MACRO SYSTEM
// Main export point for the macro processor
// ============================================================================

// Core types
export type {
  MacroContext,
  MacroResult,
  MacroProcessResult,
  MacroExpansion,
  MacroError,
  MacroSideEffect,
  MacroDefinition,
  MacroHandler,
  LazyMacroArg,
  LazyMacroHandler,
  MacroCategory,
  MacroVariable,
  MacroVariableValue,
  ChatMessage,
  TriggeredEntry,
  LorebookReference,
  PresetPromptInfo,
} from './types';

// Variable scopes (session / character / arc / scene / global)
export {
  resolveVariableTarget,
  mapForTarget,
  effectTypesForTarget,
  type VariableScope,
  type ResolvedVariableTarget,
} from './scopes';

// List value convention (JSON-array strings between macros)
export { parseListArg, formatList, listItemToString } from './lists';

// Macro lint (static analysis — spec Part IV.7)
export {
  lintMacros,
  scanMacros,
  type LintFinding,
  type LintSeverity,
  type LintInput,
  type LintPromptInput,
} from './lint';

// Registry
export {
  registerMacro,
  registerMacros,
  getMacro,
  getMacroHandler,
  hasMacro,
  getAllMacros,
  getMacrosByCategory,
  clearRegistry,
  getRegistryStats,
} from './registry';

// Processor
export {
  processMacros,
  containsMacros,
  parseMacro,
  createDefaultContext,
  quickExpand,
  evaluateConditionExpression,
} from './processor';

// Handler registration functions
export { registerIdentityMacros } from './handlers/identity';
export { registerTimeMacros } from './handlers/time';
export { registerRandomMacros } from './handlers/random';
export { registerChatMacros } from './handlers/scene';
export { registerCharacterMacros } from './handlers/character';
export { registerVariableMacros } from './handlers/variables';
export { registerConditionalMacros } from './handlers/conditional';
export { registerTextMacros } from './handlers/text';
export { registerLorebookMacros } from './handlers/lorebook';
export { registerPronounMacros } from './handlers/pronouns';
export { registerRoleplayMacros } from './handlers/roleplay';
export { registerGameMacros } from './handlers/game';
export { registerStatsMacros } from './handlers/stats';
export { registerRuntimeMacros } from './handlers/runtime';
export { registerUserMacros } from './handlers/user-macros';
export { registerLumiverseCompatMacros } from './handlers/lumiverse-compat';
export { registerPresetIntrospectionMacros } from './handlers/preset-introspection';
export { registerStateMacros } from './handlers/state';
export { registerIterationMacros } from './handlers/iteration';
export { registerTimingMacros } from './handlers/timing';
export { registerInReplyMacros } from './handlers/in-reply';
export { registerCompositionMacros } from './handlers/composition';
export { registerPhaseMacros } from './handlers/phase-macros';
export { registerOffbandMacros } from './handlers/offband-macros';

// Off-band $ macros (spec Part III.3) — async resolve pre-pass
export {
  resolveOffbandAsks,
  containsOffbandMacros,
  extractOffbandAsks,
  parseOffbandAsk,
  cacheKeyFor,
  canonicalizePick,
  OFFBAND_CACHE_KEY,
  type OffbandAsk,
  type OffbandExecutor,
  type OffbandBlock,
} from './offband';

// Evaluation phases (spec Part VIII)
export {
  processPhasedBlocks,
  containsPhaseMacros,
  type PhasedBlock,
  type PhaseEvaluator,
} from './phases';

// State hooks & event handlers (LLM tags → state)
export {
  parseMacroEngineConfig,
  runMacroHooks,
  runInReplyCaptures,
  compileEventPattern,
  IN_REPLY_ASKS_KEY,
  type MacroEngineConfig,
  type StateHook,
  type MacroEvent,
  type HookAction,
  type HookRunVars,
  type HookRunResult,
  type HookFiring,
  type InReplyAsk,
} from './hooks';

// Extended context types
export type { CharacterCardContext } from './handlers/character';
export type { LorebookMacroContext } from './handlers/lorebook';
export type { StatsMacroContext } from './handlers/stats';
export type { RuntimeContext } from './handlers/runtime';
export type { SceneExtendedContext } from './handlers/scene';

// Prompt Builder (for chat UI integration)
export {
  processText,
  processTextBlocks,
  buildMacroContext,
  type CharacterData,
  type PersonaData,
  type PresetData,
  type LorebookData,
  type PromptBuildContext,
  type PromptBuildResult,
} from './prompt-builder';

// Initialization
import { registerIdentityMacros } from './handlers/identity';
import { registerTimeMacros } from './handlers/time';
import { registerRandomMacros } from './handlers/random';
import { registerChatMacros } from './handlers/scene';
import { registerCharacterMacros } from './handlers/character';
import { registerVariableMacros } from './handlers/variables';
import { registerConditionalMacros } from './handlers/conditional';
import { registerTextMacros } from './handlers/text';
import { registerLorebookMacros } from './handlers/lorebook';
import { registerPronounMacros } from './handlers/pronouns';
import { registerRoleplayMacros } from './handlers/roleplay';
import { registerGameMacros } from './handlers/game';
import { registerStatsMacros } from './handlers/stats';
import { registerRuntimeMacros } from './handlers/runtime';
import { registerUserMacros } from './handlers/user-macros';
import { registerLumiverseCompatMacros } from './handlers/lumiverse-compat';
import { registerPresetIntrospectionMacros } from './handlers/preset-introspection';
import { registerStateMacros } from './handlers/state';
import { registerIterationMacros } from './handlers/iteration';
import { registerTimingMacros } from './handlers/timing';
import { registerInReplyMacros } from './handlers/in-reply';
import { registerCompositionMacros } from './handlers/composition';
import { registerPhaseMacros } from './handlers/phase-macros';
import { registerOffbandMacros } from './handlers/offband-macros';

let initialized = false;

/**
 * Initialize all built-in macros
 * Call this once at application startup
 */
export function initializeMacros(): void {
  if (initialized) return;

  registerIdentityMacros();
  registerTimeMacros();
  registerRandomMacros();
  registerChatMacros();
  registerCharacterMacros();
  registerVariableMacros();
  registerConditionalMacros();
  registerTextMacros();
  registerLorebookMacros();
  registerPronounMacros();
  registerRoleplayMacros();
  registerGameMacros();
  registerStatsMacros();
  registerRuntimeMacros();
  registerUserMacros();
  registerLumiverseCompatMacros();
  registerPresetIntrospectionMacros();
  registerStateMacros();
  registerIterationMacros();
  registerTimingMacros();
  registerInReplyMacros();
  registerCompositionMacros();
  registerPhaseMacros();
  registerOffbandMacros();

  initialized = true;
}

/**
 * Check if macros have been initialized
 */
export function isMacrosInitialized(): boolean {
  return initialized;
}

/**
 * Reset initialization state (for testing)
 */
export function resetMacroInitialization(): void {
  initialized = false;
}
