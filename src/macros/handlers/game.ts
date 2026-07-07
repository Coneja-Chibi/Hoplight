// ============================================================================
// GAME MECHANICS MACROS
// RPG-style helpers for stats, dice, and game state
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext, MacroVariableValue } from '../types';
import { registerMacros } from '../registry';

/**
 * Get a stat value from the stats object variable
 */
function getStatValue(context: MacroContext, statName: string): number {
  const stats = context.localVariables.get('stats');
  if (!stats || typeof stats.value !== 'object' || stats.value === null) {
    return 0;
  }

  const value = (stats.value as Record<string, MacroVariableValue>)[statName];
  return typeof value === 'number' ? value : 0;
}

/**
 * {{stat::name}} - Get a stat value from {{getvar::stats::name}}
 */
const statMacro: MacroDefinition = {
  name: 'stat',
  description: 'Get stat value (shorthand for {{getvar::stats::name}})',
  args: [{ name: 'name', description: 'Stat name', required: true }],
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const statName = args[0];
    if (!statName) {
      return { value: '', success: false, error: 'Stat name required' };
    }

    const value = getStatValue(context, statName);
    return { value: value.toString(), success: true };
  },
};

/**
 * {{check::stat::DC}} - Roll d20 + stat vs DC, return "Success" or "Failure"
 * {{check::stat::DC::verbose}} - Include roll details
 */
const checkMacro: MacroDefinition = {
  name: 'check',
  aliases: ['skillcheck', 'roll_check'],
  description: 'Roll d20 + stat vs DC. Returns "Success" or "Failure".',
  args: [
    { name: 'stat', description: 'Stat name', required: true },
    { name: 'DC', description: 'Difficulty class', required: true },
    { name: 'verbose', description: 'Include roll details', required: false },
  ],
  category: 'random',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const statName = args[0];
    const dc = parseInt(args[1], 10);
    const verbose = args[2]?.toLowerCase() === 'verbose' || args[2]?.toLowerCase() === 'true';

    if (!statName) {
      return { value: '', success: false, error: 'Stat name required' };
    }
    if (isNaN(dc)) {
      return { value: '', success: false, error: 'Invalid DC' };
    }

    const statValue = getStatValue(context, statName);
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + statValue;
    const success = total >= dc;

    if (verbose) {
      return {
        value: `${success ? 'Success' : 'Failure'} (${roll}+${statValue}=${total} vs DC ${dc})`,
        success: true,
      };
    }

    return { value: success ? 'Success' : 'Failure', success: true };
  },
};

/**
 * {{damage::dice}} - Roll damage dice
 * {{damage::dice::verbose}} - With breakdown
 */
const damageMacro: MacroDefinition = {
  name: 'damage',
  aliases: ['dmg'],
  description: 'Roll damage dice (e.g., 2d6+3)',
  args: [
    { name: 'dice', description: 'Dice notation (e.g., 2d6+3)', required: true },
    { name: 'verbose', description: 'Include breakdown', required: false },
  ],
  category: 'random',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const diceStr = args[0];
    const verbose = args[1]?.toLowerCase() === 'verbose' || args[1]?.toLowerCase() === 'true';

    if (!diceStr) {
      return { value: '', success: false, error: 'Dice notation required' };
    }

    // Parse dice notation: NdS+M or NdS-M or NdS
    const diceRegex = /^(\d+)?d(\d+)([+-]\d+)?$/i;
    const match = diceStr.match(diceRegex);

    if (!match) {
      return { value: '', success: false, error: `Invalid dice notation: ${diceStr}` };
    }

    const numDice = parseInt(match[1] || '1', 10);
    const sides = parseInt(match[2], 10);
    const modifier = parseInt(match[3] || '0', 10);

    const rolls: number[] = [];
    for (let i = 0; i < numDice; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }

    const total = rolls.reduce((a, b) => a + b, 0) + modifier;

    if (verbose) {
      const rollStr = rolls.join('+');
      const modStr = modifier >= 0 ? `+${modifier}` : modifier.toString();
      return {
        value: `${total} damage (${rollStr}${modStr})`,
        success: true,
      };
    }

    return { value: `${total} damage`, success: true };
  },
};

/**
 * {{hp}} - Display current/max HP from hp variable
 * Expects hp to be an object with current and max
 */
const hpMacro: MacroDefinition = {
  name: 'hp',
  aliases: ['health', 'hitpoints'],
  description: 'Display HP as current/max',
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const hpVar = context.localVariables.get('hp');

    if (!hpVar) {
      return { value: '0/0', success: true };
    }

    const value = hpVar.value;

    // Handle object format: { current: 45, max: 100 }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const obj = value as Record<string, MacroVariableValue>;
      const current = typeof obj.current === 'number' ? obj.current : 0;
      const max = typeof obj.max === 'number' ? obj.max : 0;
      return { value: `${current}/${max}`, success: true };
    }

    // Handle simple number format
    if (typeof value === 'number') {
      return { value: value.toString(), success: true };
    }

    return { value: String(value), success: true };
  },
};

/**
 * {{progress::current::max}} - Display a text progress bar
 * {{progress::current::max::width}} - With custom width (default 10)
 */
const progressMacro: MacroDefinition = {
  name: 'progress',
  aliases: ['progressbar', 'bar'],
  description: 'Display a text progress bar',
  args: [
    { name: 'current', description: 'Current value', required: true },
    { name: 'max', description: 'Maximum value', required: true },
    { name: 'width', description: 'Bar width in chars (default 10)', required: false },
  ],
  category: 'text',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const current = parseFloat(args[0]);
    const max = parseFloat(args[1]);
    const width = parseInt(args[2] || '10', 10);

    if (isNaN(current) || isNaN(max)) {
      return { value: '', success: false, error: 'Invalid current or max value' };
    }

    if (max <= 0) {
      return { value: '░'.repeat(width) + ' 0%', success: true };
    }

    const ratio = Math.max(0, Math.min(1, current / max));
    const filled = Math.round(ratio * width);
    const empty = width - filled;
    const percent = Math.round(ratio * 100);

    const bar = '▓'.repeat(filled) + '░'.repeat(empty);
    return { value: `${bar} ${percent}%`, success: true };
  },
};

/**
 * {{inventory}} - List inventory array items
 */
const inventoryMacro: MacroDefinition = {
  name: 'inventory',
  aliases: ['inv', 'items'],
  description: 'List inventory items (from inventory variable)',
  args: [{ name: 'separator', description: 'Item separator (default ", ")', required: false }],
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const separator = args[0] || ', ';
    const invVar = context.localVariables.get('inventory');

    if (!invVar) {
      return { value: '', success: true };
    }

    const value = invVar.value;

    if (Array.isArray(value)) {
      return { value: value.map(String).join(separator), success: true };
    }

    return { value: String(value), success: true };
  },
};

/**
 * {{questStatus::name}} - Get quest status
 */
const questStatusMacro: MacroDefinition = {
  name: 'queststatus',
  aliases: ['quest'],
  description: 'Get quest status from quests variable',
  args: [{ name: 'name', description: 'Quest name', required: true }],
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const questName = args[0];
    if (!questName) {
      return { value: '', success: false, error: 'Quest name required' };
    }

    const questsVar = context.localVariables.get('quests');
    if (!questsVar || typeof questsVar.value !== 'object' || questsVar.value === null) {
      return { value: 'Unknown', success: true };
    }

    const quests = questsVar.value as Record<string, MacroVariableValue>;
    const status = quests[questName];

    return { value: status?.toString() || 'Not Started', success: true };
  },
};

/**
 * {{gold}} - Shorthand for {{getvar::gold}}
 */
const goldMacro: MacroDefinition = {
  name: 'gold',
  aliases: ['money', 'coins', 'currency'],
  description: 'Gold/currency amount (shorthand for {{getvar::gold}})',
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const goldVar = context.localVariables.get('gold');
    const value = goldVar?.value;
    return { value: value?.toString() || '0', success: true };
  },
};

/**
 * {{level}} - Character level
 */
const levelMacro: MacroDefinition = {
  name: 'level',
  aliases: ['lvl'],
  description: 'Character level (shorthand for {{getvar::level}})',
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const levelVar = context.localVariables.get('level');
    const value = levelVar?.value;
    return { value: value?.toString() || '1', success: true };
  },
};

/**
 * {{xp}} - Experience points
 */
const xpMacro: MacroDefinition = {
  name: 'xp',
  aliases: ['exp', 'experience'],
  description: 'Experience points (shorthand for {{getvar::xp}})',
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const xpVar = context.localVariables.get('xp');
    const value = xpVar?.value;
    return { value: value?.toString() || '0', success: true };
  },
};

/**
 * Register all game mechanics macros
 */
export function registerGameMacros(): void {
  registerMacros([
    statMacro,
    checkMacro,
    damageMacro,
    hpMacro,
    progressMacro,
    inventoryMacro,
    questStatusMacro,
    goldMacro,
    levelMacro,
    xpMacro,
  ]);
}
