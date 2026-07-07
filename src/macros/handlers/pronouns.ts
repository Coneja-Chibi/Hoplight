// ============================================================================
// PRONOUN MACROS
// Gender-aware pronouns for characters and users
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext } from '../types';
import { registerMacros } from '../registry';

/**
 * Default pronoun sets
 */
const PRONOUN_SETS = {
  male: { they: 'he', them: 'him', their: 'his', theirs: 'his', themself: 'himself' },
  female: { they: 'she', them: 'her', their: 'her', theirs: 'hers', themself: 'herself' },
  neutral: { they: 'they', them: 'them', their: 'their', theirs: 'theirs', themself: 'themself' },
};

/**
 * Get pronoun set from context, with fallback to neutral
 */
function getCharacterPronouns(context: MacroContext) {
  return context.characterPronouns || PRONOUN_SETS.neutral;
}

function getUserPronouns(context: MacroContext) {
  return context.userPronouns || PRONOUN_SETS.neutral;
}

// -----------------------------------------------------------------------------
// Character Pronouns
// -----------------------------------------------------------------------------

/**
 * {{they}} - Character's subject pronoun (he/she/they)
 */
const theyMacro: MacroDefinition = {
  name: 'they',
  aliases: ['he/she', 'heshe'],
  description: 'Character\'s subject pronoun (he/she/they)',
  category: 'pronouns',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return { value: getCharacterPronouns(context).they, success: true };
  },
};

/**
 * {{them}} - Character's object pronoun (him/her/them)
 */
const themMacro: MacroDefinition = {
  name: 'them',
  aliases: ['him/her', 'himher'],
  description: 'Character\'s object pronoun (him/her/them)',
  category: 'pronouns',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return { value: getCharacterPronouns(context).them, success: true };
  },
};

/**
 * {{their}} - Character's possessive determiner (his/her/their)
 */
const theirMacro: MacroDefinition = {
  name: 'their',
  aliases: ['his/her', 'hisher'],
  description: 'Character\'s possessive determiner (his/her/their)',
  category: 'pronouns',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return { value: getCharacterPronouns(context).their, success: true };
  },
};

/**
 * {{theirs}} - Character's possessive pronoun (his/hers/theirs)
 */
const theirsMacro: MacroDefinition = {
  name: 'theirs',
  aliases: ['his/hers', 'hishers'],
  description: 'Character\'s possessive pronoun (his/hers/theirs)',
  category: 'pronouns',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return { value: getCharacterPronouns(context).theirs, success: true };
  },
};

/**
 * {{themself}} - Character's reflexive pronoun (himself/herself/themself)
 */
const themselfMacro: MacroDefinition = {
  name: 'themself',
  aliases: ['himself/herself', 'himselfherself'],
  description: 'Character\'s reflexive pronoun (himself/herself/themself)',
  category: 'pronouns',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return { value: getCharacterPronouns(context).themself, success: true };
  },
};

// -----------------------------------------------------------------------------
// Character Pronouns (Capitalized)
// -----------------------------------------------------------------------------

/**
 * {{They}} - Capitalized subject pronoun
 */
const theyCapMacro: MacroDefinition = {
  name: 'They',
  aliases: ['He/She', 'HeShe'],
  description: 'Character\'s subject pronoun, capitalized',
  category: 'pronouns',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const pronoun = getCharacterPronouns(context).they;
    return { value: pronoun.charAt(0).toUpperCase() + pronoun.slice(1), success: true };
  },
};

/**
 * {{Them}} - Capitalized object pronoun
 */
const themCapMacro: MacroDefinition = {
  name: 'Them',
  aliases: ['Him/Her', 'HimHer'],
  description: 'Character\'s object pronoun, capitalized',
  category: 'pronouns',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const pronoun = getCharacterPronouns(context).them;
    return { value: pronoun.charAt(0).toUpperCase() + pronoun.slice(1), success: true };
  },
};

/**
 * {{Their}} - Capitalized possessive determiner
 */
const theirCapMacro: MacroDefinition = {
  name: 'Their',
  aliases: ['His/Her', 'HisHer'],
  description: 'Character\'s possessive determiner, capitalized',
  category: 'pronouns',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const pronoun = getCharacterPronouns(context).their;
    return { value: pronoun.charAt(0).toUpperCase() + pronoun.slice(1), success: true };
  },
};

// -----------------------------------------------------------------------------
// User Pronouns
// -----------------------------------------------------------------------------

/**
 * {{uthey}} - User's subject pronoun
 */
const utheyMacro: MacroDefinition = {
  name: 'uthey',
  aliases: ['userthey', 'userhe/she'],
  description: 'User\'s subject pronoun (he/she/they)',
  category: 'pronouns',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return { value: getUserPronouns(context).they, success: true };
  },
};

/**
 * {{uthem}} - User's object pronoun
 */
const uthemMacro: MacroDefinition = {
  name: 'uthem',
  aliases: ['userthem', 'userhim/her'],
  description: 'User\'s object pronoun (him/her/them)',
  category: 'pronouns',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return { value: getUserPronouns(context).them, success: true };
  },
};

/**
 * {{utheir}} - User's possessive determiner
 */
const utheirMacro: MacroDefinition = {
  name: 'utheir',
  aliases: ['usertheir', 'userhis/her'],
  description: 'User\'s possessive determiner (his/her/their)',
  category: 'pronouns',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return { value: getUserPronouns(context).their, success: true };
  },
};

/**
 * {{utheirs}} - User's possessive pronoun
 */
const utheirsMacro: MacroDefinition = {
  name: 'utheirs',
  aliases: ['usertheirs'],
  description: 'User\'s possessive pronoun (his/hers/theirs)',
  category: 'pronouns',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return { value: getUserPronouns(context).theirs, success: true };
  },
};

/**
 * {{uthemself}} - User's reflexive pronoun
 */
const uthemselfMacro: MacroDefinition = {
  name: 'uthemself',
  aliases: ['userthemself'],
  description: 'User\'s reflexive pronoun (himself/herself/themself)',
  category: 'pronouns',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return { value: getUserPronouns(context).themself, success: true };
  },
};

/**
 * Register all pronoun macros
 */
export function registerPronounMacros(): void {
  registerMacros([
    // Character (lowercase)
    theyMacro,
    themMacro,
    theirMacro,
    theirsMacro,
    themselfMacro,
    // Character (capitalized)
    theyCapMacro,
    themCapMacro,
    theirCapMacro,
    // User
    utheyMacro,
    uthemMacro,
    utheirMacro,
    utheirsMacro,
    uthemselfMacro,
  ]);
}
