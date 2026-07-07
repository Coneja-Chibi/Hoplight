// ============================================================================
// RUNTIME STATE MACROS
// System and environment information macros
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext } from '../types';
import { registerMacros } from '../registry';

/**
 * Extended context interface for runtime-specific fields
 */
export interface RuntimeContext extends MacroContext {
  maxPromptTokens?: number;
  isMobile?: boolean;
  lastGenerationType?: 'chat' | 'impersonate' | 'continue' | 'regenerate' | 'swipe' | 'quiet';
  inputContent?: string;
  orisonPreferences?: string;
  orisonPreferenceBlock?: string;
}

/**
 * {{maxPrompt}} - Maximum prompt context size in tokens
 * Returns the configured max context window for the current model/preset
 */
const maxPromptMacro: MacroDefinition = {
  name: 'maxprompt',
  aliases: ['maxcontext', 'contextsize'],
  description: 'Maximum prompt context size in tokens',
  category: 'identity',
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const ctx = context as RuntimeContext;
    // Default to 4096 if not set
    return { value: (ctx.maxPromptTokens ?? 4096).toString(), success: true };
  },
};

/**
 * {{isMobile}} - Check if running on mobile device
 * Returns "true" or "false"
 */
const isMobileMacro: MacroDefinition = {
  name: 'ismobile',
  aliases: ['mobile'],
  description: 'Whether the user is on a mobile device',
  category: 'identity',
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const ctx = context as RuntimeContext;
    return { value: ctx.isMobile ? 'true' : 'false', success: true };
  },
};

/**
 * {{lastGenerationType}} - Type of the last generation request
 * Values: chat, impersonate, continue, regenerate, swipe, quiet
 */
const lastGenerationTypeMacro: MacroDefinition = {
  name: 'lastgenerationtype',
  aliases: ['gentype', 'generationtype'],
  description: 'Type of last generation (chat, impersonate, continue, etc.)',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as RuntimeContext;
    return { value: ctx.lastGenerationType || 'chat', success: true };
  },
};

/**
 * {{input}} - Content currently in the chat input field
 * Useful for prompt previews and testing
 */
const inputMacro: MacroDefinition = {
  name: 'input',
  aliases: ['chatinput'],
  description: 'Content in the chat input field',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as RuntimeContext;
    return { value: ctx.inputContent || '', success: true };
  },
};

/**
 * {{orisonPreferences}} - Active approved Orison memory as raw preference bullets
 */
const orisonPreferencesMacro: MacroDefinition = {
  name: 'orisonpreferences',
  aliases: ['orisonprefs', 'orisonmemory'],
  description: 'Active approved Orison preference memories for this user',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as RuntimeContext;
    return { value: ctx.orisonPreferences || '', success: true };
  },
};

/**
 * {{orisonPreferenceBlock}} - Wrapped system block for Orison preference memory
 */
const orisonPreferenceBlockMacro: MacroDefinition = {
  name: 'orisonpreferenceblock',
  aliases: ['orisonprefsblock', 'orisonmemoryblock'],
  description: 'Wrapped system prompt block for active approved Orison memories',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as RuntimeContext;
    return { value: ctx.orisonPreferenceBlock || '', success: true };
  },
};

/**
 * {{banned}} - Insert a ban token/phrase for text completion
 * Primarily used for text completion models to exclude certain tokens
 * Returns empty for most use cases but signals to the backend
 */
const bannedMacro: MacroDefinition = {
  name: 'banned',
  aliases: ['ban'],
  description: 'Mark text as banned for text completion',
  args: [{ name: 'text', description: 'Text to ban', required: true }],
  category: 'text',
  handler: (args: string[], context: MacroContext): MacroResult => {
    // The banned macro itself returns empty - the actual banning
    // is handled by the backend when it processes the prompt
    // We still parse it so it can be extracted from prompts
    return { value: '', success: true };
  },
};

/**
 * {{outlet::name}} - World info outlet placeholder
 * Creates a named anchor point where world info entries can be inserted
 */
const outletMacro: MacroDefinition = {
  name: 'outlet',
  description: 'Named anchor for world info/lorebook insertion',
  args: [{ name: 'name', description: 'Outlet name', required: true }],
  category: 'lorebook',
  handler: (args: string[], context: MacroContext): MacroResult => {
    // Outlets are placeholders - they get replaced by the context builder
    // when it inserts world info. Return a marker that can be found later.
    const outletName = args[0] || 'default';
    // Return a special marker that the context builder will recognize
    return { value: `<!-- OUTLET:${outletName} -->`, success: true };
  },
};

/**
 * Register all runtime macros
 */
export function registerRuntimeMacros(): void {
  registerMacros([
    maxPromptMacro,
    isMobileMacro,
    lastGenerationTypeMacro,
    inputMacro,
    orisonPreferencesMacro,
    orisonPreferenceBlockMacro,
    bannedMacro,
    outletMacro,
  ]);
}
