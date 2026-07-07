// ============================================================================
// CHARACTER CARD MACROS
// Access to character card fields
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext } from '../types';
import { registerMacros } from '../registry';

/**
 * {{description}} / {{character.description}} - Character's description field
 */
const descriptionMacro: MacroDefinition = {
  name: 'description',
  aliases: ['chardesc', 'chardescription', 'character.description'],
  description: 'The character\'s description field',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return {
      value: context.characterDescription || '',
      success: true,
    };
  },
};

/**
 * {{personality}} / {{character.personality}} - Character's personality field
 */
const personalityMacro: MacroDefinition = {
  name: 'personality',
  aliases: ['charpersonality', 'character.personality'],
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
 * {{scenario}} / {{character.scenario}} - Current scenario
 */
const scenarioMacro: MacroDefinition = {
  name: 'scenario',
  aliases: ['character.scenario'],
  description: 'The current scenario',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return {
      value: (context as CharacterCardContext).scenario || '',
      success: true,
    };
  },
};

/**
 * {{mesExamples}} / {{character.examples}} - Example dialogues (formatted)
 */
const mesExamplesMacro: MacroDefinition = {
  name: 'mesexamples',
  aliases: ['examples', 'exampledialogue', 'character.examples'],
  description: 'Example dialogues, formatted',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as CharacterCardContext;
    if (!ctx.mesExamples || ctx.mesExamples.length === 0) {
      return { value: '', success: true };
    }
    // Format as dialogue
    return {
      value: ctx.mesExamples.join('\n\n'),
      success: true,
    };
  },
};

/**
 * {{mesExamplesRaw}} - Example dialogues (raw, unformatted)
 */
const mesExamplesRawMacro: MacroDefinition = {
  name: 'mesexamplesraw',
  aliases: ['examplesraw'],
  description: 'Example dialogues, raw/unformatted',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as CharacterCardContext;
    if (!ctx.mesExamples || ctx.mesExamples.length === 0) {
      return { value: '', success: true };
    }
    return {
      value: ctx.mesExamples.join('\n'),
      success: true,
    };
  },
};

/**
 * {{charVersion}} - Character card version
 */
const charVersionMacro: MacroDefinition = {
  name: 'charversion',
  aliases: ['cardversion'],
  description: 'The character card version',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as CharacterCardContext;
    return {
      value: ctx.charVersion || '',
      success: true,
    };
  },
};

/**
 * {{firstMessage}} - Character's first message / greeting
 */
const firstMessageMacro: MacroDefinition = {
  name: 'firstmessage',
  aliases: ['greeting'],
  description: 'The character\'s first message / greeting',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as CharacterCardContext;
    return {
      value: ctx.firstMessage || '',
      success: true,
    };
  },
};

/**
 * {{charTags}} - Character's tags as comma-separated list
 */
const charTagsMacro: MacroDefinition = {
  name: 'chartags',
  aliases: ['tags'],
  description: 'The character\'s tags as comma-separated list',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as CharacterCardContext;
    if (!ctx.charTags || ctx.charTags.length === 0) {
      return { value: '', success: true };
    }
    return {
      value: ctx.charTags.join(', '),
      success: true,
    };
  },
};

/**
 * {{charCreator}} - Character's creator username
 */
const charCreatorMacro: MacroDefinition = {
  name: 'charcreator',
  aliases: ['cardcreator'],
  description: 'The character\'s creator username',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as CharacterCardContext;
    return {
      value: ctx.charCreator || '',
      success: true,
    };
  },
};

/**
 * {{charCreatorNotes}} - Creator's notes about the character card
 */
const charCreatorNotesMacro: MacroDefinition = {
  name: 'charcreatornotes',
  aliases: ['creatornotes', 'cardnotes'],
  description: 'Creator\'s notes about the character card',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as CharacterCardContext;
    return {
      value: ctx.charCreatorNotes || '',
      success: true,
    };
  },
};

/**
 * {{charDepthPrompt}} - Character's depth-injected prompt (@ Depth Note)
 * Used for special instructions injected at a specific depth in chat context
 */
const charDepthPromptMacro: MacroDefinition = {
  name: 'chardepthprompt',
  aliases: ['depthnote', 'characterdepthnote'],
  description: 'Character\'s depth-injected prompt (@ Depth Note)',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as CharacterCardContext;
    return {
      value: ctx.charDepthPrompt || '',
      success: true,
    };
  },
};

/**
 * {{charPrompt}} - Character's main prompt override
 * This replaces the main prompt when defined on the character card
 */
const charPromptMacro: MacroDefinition = {
  name: 'charprompt',
  aliases: ['characterprompt'],
  description: 'Character\'s main prompt override',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as CharacterCardContext;
    return {
      value: ctx.charPrompt || '',
      success: true,
    };
  },
};

/**
 * {{charInstruction}} - Character's post-history instructions
 * Also known as jailbreak or post-history prompt specific to the character
 */
const charInstructionMacro: MacroDefinition = {
  name: 'charinstruction',
  aliases: ['charjailbreak', 'characterinstruction'],
  description: 'Character\'s post-history instructions',
  category: 'identity',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as CharacterCardContext;
    return {
      value: ctx.charInstruction || '',
      success: true,
    };
  },
};

/**
 * {{accentcolor}} / {{accent_color}} - Character's accent/theme color (hex)
 */
const accentColorMacro: MacroDefinition = {
  name: 'accentcolor',
  aliases: ['accent_color', 'charcolor', 'character.accent_color'],
  description: "The character's accent/theme color (hex)",
  category: 'identity',
  handler: (_args: string[], context: MacroContext): MacroResult => {
    return {
      value: context.characterAccentColor || '',
      success: true,
    };
  },
};

/**
 * {{palette}} / {{charpalette}} - Character's color palette as JSON
 */
const paletteMacro: MacroDefinition = {
  name: 'palette',
  aliases: ['charpalette', 'character.palette'],
  description: "The character's color palette as JSON array",
  category: 'identity',
  handler: (_args: string[], context: MacroContext): MacroResult => {
    return {
      value: context.characterPalette ? JSON.stringify(context.characterPalette) : '[]',
      success: true,
    };
  },
};

/**
 * {{gradient}} / {{chargradient}} - Character's gradient colors as JSON
 */
const gradientMacro: MacroDefinition = {
  name: 'gradient',
  aliases: ['chargradient', 'character.gradient'],
  description: "The character's gradient accent colors as JSON array",
  category: 'identity',
  handler: (_args: string[], context: MacroContext): MacroResult => {
    return {
      value: context.characterGradient ? JSON.stringify(context.characterGradient) : '[]',
      success: true,
    };
  },
};

/**
 * Extended context interface for character card fields
 * The main MacroContext will be extended with these when available
 */
export interface CharacterCardContext extends MacroContext {
  scenario?: string;
  mesExamples?: string[];
  charVersion?: string;
  firstMessage?: string;
  charTags?: string[];
  charCreator?: string;
  charCreatorNotes?: string;
  charDepthPrompt?: string;
  charPrompt?: string;
  charInstruction?: string;
}

/**
 * Register all character card macros
 */
export function registerCharacterMacros(): void {
  registerMacros([
    descriptionMacro,
    personalityMacro,
    scenarioMacro,
    mesExamplesMacro,
    mesExamplesRawMacro,
    charVersionMacro,
    firstMessageMacro,
    charTagsMacro,
    charCreatorMacro,
    charCreatorNotesMacro,
    charDepthPromptMacro,
    charPromptMacro,
    charInstructionMacro,
    accentColorMacro,
    paletteMacro,
    gradientMacro,
  ]);
}
