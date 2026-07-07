// ============================================================================
// IDENTITY MACROS
// Character, user, and model identity macros
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext } from '../types';
import { registerMacros } from '../registry';

/**
 * {{char}} - Character name
 */
const charMacro: MacroDefinition = {
  name: 'char',
  aliases: ['character', 'bot'],
  description: 'The character\'s name',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return {
      value: context.characterName,
      success: true,
    };
  },
};

/**
 * {{user}} - User name
 */
const userMacro: MacroDefinition = {
  name: 'user',
  aliases: ['player'],
  description: 'The user\'s name',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return {
      value: context.userName,
      success: true,
    };
  },
};

/**
 * {{persona}} - User's persona description
 */
const personaMacro: MacroDefinition = {
  name: 'persona',
  aliases: ['userpersona'],
  description: 'The user\'s persona description',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return {
      value: context.userPersona || '',
      success: true,
    };
  },
};

/**
 * {{model}} - Current AI model name
 */
const modelMacro: MacroDefinition = {
  name: 'model',
  aliases: ['aimodel', 'llm'],
  description: 'The current AI model name',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return {
      value: context.modelName || 'Unknown',
      success: true,
    };
  },
};

/**
 * {{charDescription}} - Character's full description
 */
const charDescriptionMacro: MacroDefinition = {
  name: 'chardescription',
  aliases: ['chardesc', 'description'],
  description: 'The character\'s full description',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return {
      value: context.characterDescription || '',
      success: true,
    };
  },
};

/**
 * {{charPersonality}} - Character's personality field
 */
const charPersonalityMacro: MacroDefinition = {
  name: 'charpersonality',
  aliases: ['personality'],
  description: 'The character\'s personality field',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return {
      value: context.characterPersonality || '',
      success: true,
    };
  },
};

/**
 * {{group}} - Group chat name. Outside a group chat there is no group, so this
 * falls back to the character's name — matching SillyTavern, where {{group}}
 * resolves to {{char}} in solo chats. Cards that use {{group}} for the active
 * character therefore work in both solo and group contexts.
 */
const groupMacro: MacroDefinition = {
  name: 'group',
  aliases: ['groupname'],
  description: 'The group chat name (falls back to the character name outside a group)',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return {
      value: context.groupName || context.characterName || '',
      success: true,
    };
  },
};

/**
 * {{persona_color}} / {{personacolor}} - Persona's accent/signature color (hex)
 */
const personaColorMacro: MacroDefinition = {
  name: 'personacolor',
  aliases: ['persona_color', 'persona.color'],
  description: "The persona's accent/signature color (hex)",
  category: 'identity',
  handler: (_args: string[], context: MacroContext): MacroResult => {
    return {
      value: context.personaAccentColor || '',
      success: true,
    };
  },
};

/**
 * {{persona_palette}} / {{personapalette}} - Persona's color palette as JSON
 */
const personaPaletteMacro: MacroDefinition = {
  name: 'personapalette',
  aliases: ['persona_palette', 'persona.palette'],
  description: "The persona's color palette as JSON array",
  category: 'identity',
  handler: (_args: string[], context: MacroContext): MacroResult => {
    return {
      value: context.personaPalette ? JSON.stringify(context.personaPalette) : '[]',
      success: true,
    };
  },
};

/**
 * {{persona_gradient}} / {{personagradient}} - Persona's gradient colors as JSON
 */
const personaGradientMacro: MacroDefinition = {
  name: 'personagradient',
  aliases: ['persona_gradient', 'persona.gradient'],
  description: "The persona's gradient accent colors as JSON array",
  category: 'identity',
  handler: (_args: string[], context: MacroContext): MacroResult => {
    return {
      value: context.personaGradient ? JSON.stringify(context.personaGradient) : '[]',
      success: true,
    };
  },
};

/**
 * Register all identity macros
 */
export function registerIdentityMacros(): void {
  registerMacros([
    charMacro,
    userMacro,
    personaMacro,
    modelMacro,
    charDescriptionMacro,
    charPersonalityMacro,
    groupMacro,
    personaColorMacro,
    personaPaletteMacro,
    personaGradientMacro,
  ]);
}
