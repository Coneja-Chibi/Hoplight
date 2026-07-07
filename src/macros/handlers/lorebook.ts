// ============================================================================
// LOREBOOK MACROS
// Access to lorebook entries and triggered content
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext } from '../types';
import { registerMacros } from '../registry';

/**
 * {{lorebook::EntryName}} - Get content of a lorebook entry by name
 * This is handled specially since it needs lorebook context
 */
const lorebookMacro: MacroDefinition = {
  name: 'lorebook',
  aliases: ['lore', 'entry'],
  description: 'Get content of a lorebook entry by name',
  args: [{ name: 'name', description: 'Entry name/title', required: true }],
  category: 'lorebook',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const name = args[0]?.toLowerCase().trim();
    if (!name) {
      return { value: '', success: false, error: 'Entry name required' };
    }

    // Look through triggered entries for matching name
    const ctx = context as LorebookMacroContext;
    if (!ctx.allLorebookEntries) {
      return { value: '', success: true }; // No lorebook context
    }

    const entry = ctx.allLorebookEntries.find(
      e => e.title.toLowerCase().trim() === name
    );

    if (!entry) {
      return { value: '', success: true }; // Entry not found
    }

    return { value: entry.content, success: true };
  },
};

/**
 * {{outlet::name}} - Named outlet (ST compatibility)
 * Same as {{lorebook::name}}
 */
const outletMacro: MacroDefinition = {
  name: 'outlet',
  description: 'Named outlet - same as {{lorebook::name}}',
  args: [{ name: 'name', description: 'Entry name/title', required: true }],
  category: 'lorebook',
  handler: (args: string[], context: MacroContext): MacroResult => {
    // Delegate to lorebook macro
    return lorebookMacro.handler(args, context);
  },
};

/**
 * {{lorebookRandom::GroupName}} - Get random entry from inclusion group
 */
const lorebookRandomMacro: MacroDefinition = {
  name: 'lorebookrandom',
  aliases: ['lorerand', 'randlore'],
  description: 'Get random entry content from an inclusion group',
  args: [{ name: 'groupName', description: 'Inclusion group name', required: true }],
  category: 'lorebook',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const groupName = args[0]?.toLowerCase().trim();
    if (!groupName) {
      return { value: '', success: false, error: 'Group name required' };
    }

    const ctx = context as LorebookMacroContext;
    if (!ctx.allLorebookEntries) {
      return { value: '', success: true };
    }

    // Find all entries in this group
    const groupEntries = ctx.allLorebookEntries.filter(
      e => e.groupName?.toLowerCase().trim() === groupName && e.enabled
    );

    if (groupEntries.length === 0) {
      return { value: '', success: true };
    }

    // Pick random entry
    const randomIndex = Math.floor(Math.random() * groupEntries.length);
    return { value: groupEntries[randomIndex].content, success: true };
  },
};

/**
 * {{lorebookCount}} - Number of currently triggered/active lorebook entries
 */
const lorebookCountMacro: MacroDefinition = {
  name: 'lorebookcount',
  aliases: ['lorecount', 'activeentries'],
  description: 'Number of currently triggered lorebook entries',
  category: 'lorebook',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const triggered = context.triggeredEntries || [];
    return { value: triggered.length.toString(), success: true };
  },
};

/**
 * {{lorebookTokens}} - Approximate tokens used by triggered lorebook entries
 */
const lorebookTokensMacro: MacroDefinition = {
  name: 'lorebooktokens',
  aliases: ['loretokens'],
  description: 'Approximate tokens used by triggered entries',
  category: 'lorebook',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const triggered = context.triggeredEntries || [];

    // Rough token estimate: ~4 chars per token for English
    let totalChars = 0;
    for (const entry of triggered) {
      totalChars += entry.content.length;
    }

    const estimatedTokens = Math.ceil(totalChars / 4);
    return { value: estimatedTokens.toString(), success: true };
  },
};

/**
 * {{triggeredEntries}} - Comma-separated list of triggered entry names
 */
const triggeredEntriesMacro: MacroDefinition = {
  name: 'triggeredentries',
  aliases: ['triggered', 'activeentrynames'],
  description: 'Comma-separated list of triggered entry names',
  category: 'lorebook',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const triggered = context.triggeredEntries || [];
    const names = triggered.map(e => e.title);
    return { value: names.join(', '), success: true };
  },
};

/**
 * {{lorebookList}} - List all available lorebooks
 */
const lorebookListMacro: MacroDefinition = {
  name: 'lorebooklist',
  aliases: ['lorebooks'],
  description: 'Comma-separated list of active lorebook names',
  category: 'lorebook',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const lorebooks = context.activeLorebooks || [];
    const names = lorebooks.map(l => l.name);
    return { value: names.join(', '), success: true };
  },
};

/**
 * Extended context for lorebook macros
 */
export interface LorebookMacroContext extends MacroContext {
  allLorebookEntries?: Array<{
    id: string;
    title: string;
    content: string;
    groupName?: string | null;
    enabled: boolean;
    lorebookId: string;
  }>;
}

/**
 * Register all lorebook macros
 */
export function registerLorebookMacros(): void {
  registerMacros([
    lorebookMacro,
    outletMacro,
    lorebookRandomMacro,
    lorebookCountMacro,
    lorebookTokensMacro,
    triggeredEntriesMacro,
    lorebookListMacro,
  ]);
}
