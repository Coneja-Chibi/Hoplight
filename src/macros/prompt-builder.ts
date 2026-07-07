// ============================================================================
// PROMPT BUILDER - Macro-aware prompt assembly
// ============================================================================
// This module provides utilities for assembling prompts with macro expansion.
// It should be called by the chat UI when constructing the final prompt
// to send to the AI backend.
// ============================================================================

import { MacroContext, MacroProcessResult, ChatMessage, TriggeredEntry, LorebookReference } from './types';
import { processMacros, createDefaultContext } from './processor';
import { initializeMacros, isMacrosInitialized } from './index';

/**
 * Character data for prompt building
 */
export interface CharacterData {
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;
  firstMessage?: string;
  exampleMessages?: string;
  systemPrompt?: string;
  postHistoryInstructions?: string;
  creatorNotes?: string;
  creatorName?: string;
  version?: string;
  tags?: string[];
  accentColor?: string;
  palette?: Array<{ label: string; name: string; hex: string }>;
  gradient?: string[];
}

/**
 * User/persona data for prompt building
 */
export interface PersonaData {
  name: string;
  description?: string;
  pronouns?: {
    they: string;
    them: string;
    their: string;
    theirs: string;
    themself: string;
  };
  accentColor?: string;
  palette?: Array<{ label: string; name: string; hex: string }>;
  gradient?: string[];
}

/**
 * Preset data for prompt building
 */
export interface PresetData {
  name: string;
  systemPrompt?: string;
  // Prompts organized by category would be here
}

/**
 * Lorebook data for prompt building
 */
export interface LorebookData {
  id: string;
  name: string;
  entries: TriggeredEntry[];
}

/**
 * Full context for prompt building
 */
export interface PromptBuildContext {
  character: CharacterData;
  persona: PersonaData;
  preset?: PresetData;
  lorebooks?: LorebookData[];
  messages: ChatMessage[];
  modelName?: string;

  // Variables (loaded from database)
  localVariables?: Map<string, { value: unknown; createdAt: Date; updatedAt: Date }>;
  globalVariables?: Map<string, { value: unknown; createdAt: Date; updatedAt: Date }>;

  // Stats context (if available)
  tokenCount?: number;
  tokenBudget?: number;
  responseTokens?: number;
  sessionTokens?: number;
}

/**
 * Result of prompt building
 */
export interface PromptBuildResult {
  /** The processed text with all macros expanded */
  processedText: string;
  /** Original text before processing */
  originalText: string;
  /** All macro expansions that occurred */
  expansions: MacroProcessResult['expansions'];
  /** Any errors during processing */
  errors: MacroProcessResult['errors'];
  /** Side effects to apply (variable changes) */
  sideEffects: MacroProcessResult['sideEffects'];
  /** Whether processing was successful */
  success: boolean;
}

/**
 * Ensure macros are initialized
 */
function ensureInitialized(): void {
  if (!isMacrosInitialized()) {
    initializeMacros();
  }
}

/**
 * Build a macro context from prompt build context
 */
export function buildMacroContext(ctx: PromptBuildContext): MacroContext {
  // Convert lorebooks to references
  const lorebookRefs: LorebookReference[] = (ctx.lorebooks || []).map(lb => ({
    id: lb.id,
    name: lb.name,
    entryCount: lb.entries.length,
  }));

  // Build triggered entries from all lorebooks
  const triggeredEntries: TriggeredEntry[] = (ctx.lorebooks || []).flatMap(lb => lb.entries);

  // Character pronouns (could be parsed from character data or set explicitly)
  const defaultPronouns = { they: 'they', them: 'them', their: 'their', theirs: 'theirs', themself: 'themself' };

  // Convert exampleMessages string to array for macros
  const mesExamples = ctx.character.exampleMessages
    ? ctx.character.exampleMessages.split('\n').filter(Boolean)
    : undefined;

  const context: MacroContext = {
    // Identity
    characterName: ctx.character.name,
    userName: ctx.persona.name,
    userPersona: ctx.persona.description,
    modelName: ctx.modelName,

    // Character card
    characterDescription: ctx.character.description,
    characterPersonality: ctx.character.personality,

    // Character card extended fields
    scenario: ctx.character.scenario,
    mesExamples,

    // Character colors
    characterAccentColor: ctx.character.accentColor,
    characterPalette: ctx.character.palette,
    characterGradient: ctx.character.gradient,

    // Persona colors
    personaAccentColor: ctx.persona.accentColor,
    personaPalette: ctx.persona.palette,
    personaGradient: ctx.persona.gradient,

    // Pronouns
    characterPronouns: defaultPronouns,
    userPronouns: ctx.persona.pronouns || defaultPronouns,

    // Messages
    messages: ctx.messages,
    messageCount: ctx.messages.length,

    // Variables
    localVariables: ctx.localVariables || new Map(),
    globalVariables: ctx.globalVariables || new Map(),
    userMacros: new Map(),
    templates: new Map(),
    blockOverrides: new Map(),

    // Lorebooks
    activeLorebooks: lorebookRefs,
    triggeredEntries,

    // Timestamps
    chatStartTime: ctx.messages.length > 0
      ? new Date(ctx.messages[0].timestamp || Date.now())
      : new Date(),
    lastActivityTime: ctx.messages.length > 0
      ? new Date(ctx.messages[ctx.messages.length - 1].timestamp || Date.now())
      : undefined,
  };

  // VVS-557: card-definition macros — kept in parity with buildCardFieldMacroContext
  // (prompt-assembly.ts). The display path is a SECOND macro context-builder; the prior fix
  // wired only the prompt one, so {{charPrompt}}/{{charInstruction}} rendered raw/blank in
  // the chat bubble. Object.assign mirrors how the prompt path attaches these card fields.
  return Object.assign(context, {
    charPrompt: ctx.character.systemPrompt || '',
    charInstruction: ctx.character.postHistoryInstructions || '',
    charCreatorNotes: ctx.character.creatorNotes || '',
  });
}

/**
 * Process a single text block through the macro system
 */
export function processText(text: string, ctx: PromptBuildContext): PromptBuildResult {
  ensureInitialized();

  const macroContext = buildMacroContext(ctx);
  const result = processMacros(text, macroContext);

  return {
    processedText: result.text,
    originalText: text,
    expansions: result.expansions,
    errors: result.errors,
    sideEffects: result.sideEffects,
    success: result.errors.length === 0,
  };
}

/**
 * Process multiple text blocks in order
 * Useful for processing an entire prompt structure (system, character, scenario, etc.)
 */
export function processTextBlocks(
  blocks: { key: string; text: string }[],
  ctx: PromptBuildContext
): Map<string, PromptBuildResult> {
  ensureInitialized();

  const results = new Map<string, PromptBuildResult>();
  const macroContext = buildMacroContext(ctx);

  for (const block of blocks) {
    if (!block.text) {
      results.set(block.key, {
        processedText: '',
        originalText: '',
        expansions: [],
        errors: [],
        sideEffects: [],
        success: true,
      });
      continue;
    }

    const result = processMacros(block.text, macroContext);
    results.set(block.key, {
      processedText: result.text,
      originalText: block.text,
      expansions: result.expansions,
      errors: result.errors,
      sideEffects: result.sideEffects,
      success: result.errors.length === 0,
    });

    // Apply side effects to context for subsequent blocks
    // (This allows {{setvar}} in one block to affect {{getvar}} in a later block)
    for (const effect of result.sideEffects) {
      if (effect.type === 'setLocalVar' && effect.value !== undefined) {
        macroContext.localVariables.set(effect.key, {
          value: effect.value,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else if (effect.type === 'setGlobalVar' && effect.value !== undefined) {
        macroContext.globalVariables.set(effect.key, {
          value: effect.value,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else if (effect.type === 'deleteLocalVar') {
        macroContext.localVariables.delete(effect.key);
      } else if (effect.type === 'deleteGlobalVar') {
        macroContext.globalVariables.delete(effect.key);
      }
    }
  }

  return results;
}

/**
 * Quick utility to check if text contains macros
 */
export { containsMacros } from './processor';

/**
 * Quick expand for simple cases
 */
export { quickExpand } from './processor';
