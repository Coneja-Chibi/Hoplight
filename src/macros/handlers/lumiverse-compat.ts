// ============================================================================
// LUMIVERSE COMPATIBILITY MACROS
// Macros from Lumiverse's preset dialect so imported presets (e.g.
// ThreadBare) run natively: running counters, reasoning tag emitters,
// group-card macros, and platform tokens.
//
// Platform tokens that depend on Lumiverse-side services (lumia council,
// spotify) resolve to EMPTY STRING on purpose: an unknown macro survives as
// literal text, which is truthy inside {{if::...}} guards — leaving them
// unresolved would wrongly ACTIVATE Lumiverse-only preset sections.
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext } from '../types';
import { registerMacros } from '../registry';

/**
 * {{rcounter::name}} - Running counter, scoped to one generation.
 *
 * Each evaluation increments and returns the named counter ("Step 1",
 * "Step 2", ...). State lives in context.counters, which the processor
 * guarantees on the caller's context object — so numbering continues across
 * all prompt blocks of one build and resets on the next generation.
 */
const rcounterMacro: MacroDefinition = {
  name: 'rcounter',
  aliases: ['runningcounter'],
  description: 'Auto-incrementing counter, resets each generation: {{rcounter::step}}',
  args: [{ name: 'name', description: 'Counter name', required: false }],
  category: 'variables',
  volatile: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    // No-op in read-only mode (e.g. re-rendering historical messages), matching
    // every other side-effect macro — never mutate counter state there.
    if (context.readOnly) {
      return { value: '', success: true };
    }
    const name = args[0] || 'default';
    const counters = context.counters ?? (context.counters = new Map());
    const next = (counters.get(name) ?? 0) + 1;
    counters.set(name, next);
    return { value: String(next), success: true };
  },
};

/**
 * {{reasoningPrefix}} / {{reasoningSuffix}} - Reasoning tag emitters.
 *
 * Used by mock-reasoning presets to open/close a fake thinking block in the
 * model's own output. The optional ::raw argument (Lumiverse) means
 * "unescaped" — RC always emits raw, so it is accepted and ignored.
 */
const reasoningPrefixMacro: MacroDefinition = {
  name: 'reasoningprefix',
  description: 'Opening reasoning tag (default <think>)',
  category: 'text',
  handler: (_args: string[], context: MacroContext): MacroResult => {
    return { value: context.reasoningPrefix ?? '<think>', success: true };
  },
};

const reasoningSuffixMacro: MacroDefinition = {
  name: 'reasoningsuffix',
  description: 'Closing reasoning tag (default </think>)',
  category: 'text',
  handler: (_args: string[], context: MacroContext): MacroResult => {
    return { value: context.reasoningSuffix ?? '</think>', success: true };
  },
};

// ============================================================================
// GROUP-CARD MACROS
// ============================================================================

/** Resolve the focused character's name (active speaker in a group turn). */
function focusedName(context: MacroContext): string {
  return context.focusedCharacterName || context.characterName || '';
}

/**
 * {{groupCardMode}} - 'solo' | 'swap' | 'ensemble'.
 * Defaults to 'solo' outside group chats; RC's group model (one member
 * replies per turn) is 'swap'.
 */
const groupCardModeMacro: MacroDefinition = {
  name: 'groupcardmode',
  description: "Group handling mode: 'solo', 'swap', or 'ensemble'",
  category: 'identity',
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const fallback = context.groupMembers?.length ? 'swap' : 'solo';
    return { value: context.groupCardMode || fallback, success: true };
  },
};

/** {{charGroupFocused}} - Name of the character replying this turn. */
const charGroupFocusedMacro: MacroDefinition = {
  name: 'chargroupfocused',
  description: 'Name of the group member replying this turn',
  category: 'identity',
  handler: (_args: string[], context: MacroContext): MacroResult => {
    return { value: focusedName(context), success: true };
  },
};

/** {{charGroupFocusedDescription}} - Focused member's description. */
const charGroupFocusedDescriptionMacro: MacroDefinition = {
  name: 'chargroupfocuseddescription',
  description: 'Description of the group member replying this turn',
  category: 'identity',
  handler: (_args: string[], context: MacroContext): MacroResult => {
    return {
      value: context.focusedCharacterDescription ?? context.characterDescription ?? '',
      success: true,
    };
  },
};

/** {{charGroupFocusedPersonality}} - Focused member's personality. */
const charGroupFocusedPersonalityMacro: MacroDefinition = {
  name: 'chargroupfocusedpersonality',
  description: 'Personality of the group member replying this turn',
  category: 'identity',
  handler: (_args: string[], context: MacroContext): MacroResult => {
    return {
      value: context.focusedCharacterPersonality ?? context.characterPersonality ?? '',
      success: true,
    };
  },
};

/** {{groupOthers}} - Comma list of group members other than the focused one. */
const groupOthersMacro: MacroDefinition = {
  name: 'groupothers',
  description: 'Names of the other group members (comma-separated)',
  category: 'identity',
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const focused = focusedName(context);
    const others = (context.groupMembers ?? [])
      .map(m => m.name)
      .filter(name => name && name !== focused);
    return { value: others.join(', '), success: true };
  },
};

// ============================================================================
// LUMIVERSE PLATFORM TOKENS
// ============================================================================

/** {{lumiaDef}} - Lumiverse's character definition → RC description. */
const lumiaDefMacro: MacroDefinition = {
  name: 'lumiadef',
  description: "Character description (Lumiverse alias)",
  category: 'identity',
  handler: (_args: string[], context: MacroContext): MacroResult => {
    return { value: context.characterDescription || '', success: true };
  },
};

/** {{lumiaPersonality}} - Lumiverse's personality → RC personality. */
const lumiaPersonalityMacro: MacroDefinition = {
  name: 'lumiapersonality',
  description: "Character personality (Lumiverse alias)",
  category: 'identity',
  handler: (_args: string[], context: MacroContext): MacroResult => {
    return { value: context.characterPersonality || '', success: true };
  },
};

/** Tokens backed by Lumiverse-side services RC doesn't have → empty. */
const UNAVAILABLE_PLATFORM_TOKENS = [
  'lumiacouncilmodeactive',
  'lumiacouncilinst',
  'lumiacouncildeliberation',
  'lumiastatesynthesis',
  'lumiabehavior',
  'lumiaooc',
  'lumiaoocerotic',
  'lumiaooceroticbleed',
  'spotify_track_name',
  'spotify_artists',
  'spotify_album_art',
  'spotify_album_name',
  'spotify_has_lyrics',
  'spotify_is_playing',
  'spotify_lyrics',
  'sim_tracker',
  'usercolormode',
  'isnarrator',
  'wi_marker',
];

const emptyTokenMacros: MacroDefinition[] = UNAVAILABLE_PLATFORM_TOKENS.map(name => ({
  name,
  description: 'Lumiverse platform token (unavailable in RoleCall, resolves empty)',
  category: 'text' as const,
  handler: (): MacroResult => ({ value: '', success: true }),
}));

export function registerLumiverseCompatMacros(): void {
  registerMacros([
    rcounterMacro,
    reasoningPrefixMacro,
    reasoningSuffixMacro,
    groupCardModeMacro,
    charGroupFocusedMacro,
    charGroupFocusedDescriptionMacro,
    charGroupFocusedPersonalityMacro,
    groupOthersMacro,
    lumiaDefMacro,
    lumiaPersonalityMacro,
    ...emptyTokenMacros,
  ]);
}
