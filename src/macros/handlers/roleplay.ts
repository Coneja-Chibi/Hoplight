// ============================================================================
// ROLEPLAY-SPECIFIC MACROS
// Convenience aliases for common roleplay variables
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext } from '../types';
import { registerMacros } from '../registry';

/**
 * These are all convenience aliases that map to {{getvar::X}}.
 * They make common roleplay patterns more discoverable and readable.
 *
 * Instead of: {{getvar::mood}}
 * Users write: {{mood}}
 *
 * The lorebook Side Effects feature can set these automatically when entries trigger.
 */

/**
 * {{mood}} - Current mood (alias for {{getvar::mood}})
 */
const moodMacro: MacroDefinition = {
  name: 'mood',
  description: 'Current mood variable (shorthand for {{getvar::mood}})',
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const variable = context.localVariables.get('mood');
    return { value: variable?.value?.toString() || '', success: true };
  },
};

/**
 * {{relationship}} - Current relationship status
 */
const relationshipMacro: MacroDefinition = {
  name: 'relationship',
  aliases: ['rel'],
  description: 'Relationship status variable (shorthand for {{getvar::relationship}})',
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const variable = context.localVariables.get('relationship');
    return { value: variable?.value?.toString() || '', success: true };
  },
};

/**
 * {{location}} - Current scene location
 */
const locationMacro: MacroDefinition = {
  name: 'location',
  aliases: ['loc', 'place'],
  description: 'Current location variable (shorthand for {{getvar::location}})',
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const variable = context.localVariables.get('location');
    return { value: variable?.value?.toString() || '', success: true };
  },
};

/**
 * {{timeOfDay}} - In-story time of day
 */
const timeOfDayMacro: MacroDefinition = {
  name: 'timeofday',
  aliases: ['tod', 'storytime'],
  description: 'In-story time of day variable (shorthand for {{getvar::timeOfDay}})',
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const variable = context.localVariables.get('timeOfDay');
    return { value: variable?.value?.toString() || '', success: true };
  },
};

/**
 * {{trust}} - Trust level (common in relationship RPs)
 */
const trustMacro: MacroDefinition = {
  name: 'trust',
  description: 'Trust level variable (shorthand for {{getvar::trust}})',
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const variable = context.localVariables.get('trust');
    return { value: variable?.value?.toString() || '', success: true };
  },
};

/**
 * {{affection}} - Affection level
 */
const affectionMacro: MacroDefinition = {
  name: 'affection',
  aliases: ['love'],
  description: 'Affection level variable (shorthand for {{getvar::affection}})',
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const variable = context.localVariables.get('affection');
    return { value: variable?.value?.toString() || '', success: true };
  },
};

/**
 * {{tension}} - Scene tension level
 */
const tensionMacro: MacroDefinition = {
  name: 'tension',
  description: 'Scene tension variable (shorthand for {{getvar::tension}})',
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const variable = context.localVariables.get('tension');
    return { value: variable?.value?.toString() || '', success: true };
  },
};

/**
 * {{weather}} - Current weather in scene
 */
const weatherMacro: MacroDefinition = {
  name: 'weather',
  description: 'Weather variable (shorthand for {{getvar::weather}})',
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const variable = context.localVariables.get('weather');
    return { value: variable?.value?.toString() || '', success: true };
  },
};

/**
 * Register all roleplay-specific macros
 */
export function registerRoleplayMacros(): void {
  registerMacros([
    moodMacro,
    relationshipMacro,
    locationMacro,
    timeOfDayMacro,
    trustMacro,
    affectionMacro,
    tensionMacro,
    weatherMacro,
  ]);
}
