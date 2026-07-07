// ============================================================================
// RANDOM & DICE MACROS
// Random number generation, dice rolls, and random selections
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext } from '../types';
import { registerMacros } from '../registry';

/**
 * Simple seeded random number generator
 * Uses a simple LCG (Linear Congruential Generator)
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    // LCG parameters (same as glibc)
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
}

/**
 * Get a random value between 0 and 1
 * Uses seed from context if available, otherwise Math.random()
 */
function getRandom(context: MacroContext): number {
  if (context.randomSeed !== undefined) {
    const rng = new SeededRandom(context.randomSeed);
    // Advance seed for next call
    context.randomSeed = Math.floor(rng.next() * 0x7fffffff);
    return rng.next();
  }
  return Math.random();
}

/**
 * {{random}} - Random number between 0-100
 * {{random::min::max}} - Random number in range
 */
const randomMacro: MacroDefinition = {
  name: 'random',
  aliases: ['rand'],
  description: 'Random integer. {{random}} for 0-100, {{random::min::max}} for range, {{random::opt1::opt2::opt3}} to pick one',
  args: [
    { name: 'min', description: 'Minimum value (default 0)', required: false, defaultValue: '0' },
    { name: 'max', description: 'Maximum value (default 100)', required: false, defaultValue: '100' },
  ],
  category: 'random',
  handler: (args: string[], context: MacroContext): MacroResult => {
    // SillyTavern compat: if single arg contains commas, split on commas
    // Supports escaped commas (\,) to include literal commas in options
    let effectiveArgs = args;
    if (args.length === 1 && args[0].includes(',')) {
      const COMMA_PLACEHOLDER = '\x00COMMA\x00';
      effectiveArgs = args[0]
        .replace(/\\,/g, COMMA_PLACEHOLDER)
        .split(',')
        .map(item => item.trim().replace(new RegExp(COMMA_PLACEHOLDER, 'g'), ','));
    }

    // If 3+ args OR any arg is non-numeric, behave like {{pick}} (SillyTavern compat)
    const isTextMode = effectiveArgs.length >= 3 || (effectiveArgs.length > 0 && effectiveArgs.some(a => isNaN(Number(a))));

    if (isTextMode && effectiveArgs.length > 0) {
      const index = Math.floor(getRandom(context) * effectiveArgs.length);
      return { value: effectiveArgs[index], success: true };
    }

    const min = parseInt(effectiveArgs[0] || '0', 10);
    const max = parseInt(effectiveArgs[1] || '100', 10);

    if (isNaN(min) || isNaN(max)) {
      return { value: '', success: false, error: 'Invalid min/max values' };
    }

    const range = max - min + 1;
    const value = Math.floor(getRandom(context) * range) + min;

    return { value: value.toString(), success: true };
  },
};

/**
 * Generate a deterministic key for a set of pick options.
 * Sorts the options so that {{pick::a::b::c}} and {{pick::c::a::b}} share the same key.
 */
function pickKey(options: string[]): string {
  return '_pick_' + [...options].sort().join('\x01');
}

/**
 * {{pick::option1::option2::option3}} - Random selection from options
 *
 * Picks once per unique option-set per prompt assembly and returns the same
 * value on every subsequent evaluation within the same context (via localVariables).
 * Two different {{pick::a::b::c}} tokens in different positions return the same
 * value because they share the same options key.
 */
const pickMacro: MacroDefinition = {
  name: 'pick',
  aliases: ['choose', 'select'],
  description: 'Pick a random option from the provided list. Same options always return the same pick within one context.',
  args: [{ name: 'options', description: 'Options to pick from (multiple)', required: true }],
  category: 'random',
  handler: (args: string[], context: MacroContext): MacroResult => {
    // SillyTavern compat: if single arg contains commas, split on commas
    let effectiveArgs = args;
    if (args.length === 1 && args[0].includes(',')) {
      const COMMA_PLACEHOLDER = '\x00COMMA\x00';
      effectiveArgs = args[0]
        .replace(/\\,/g, COMMA_PLACEHOLDER)
        .split(',')
        .map(item => item.trim().replace(new RegExp(COMMA_PLACEHOLDER, 'g'), ','));
    }

    if (effectiveArgs.length === 0) {
      return { value: '', success: false, error: 'No options provided' };
    }

    // Check if we already picked for this option-set in this context
    const key = pickKey(effectiveArgs);
    const existing = context.localVariables.get(key);
    if (existing !== undefined) {
      return { value: String(existing.value), success: true };
    }

    // First time: pick randomly using the context seed
    const index = Math.floor(getRandom(context) * effectiveArgs.length);
    const picked = effectiveArgs[index];

    // In read-only mode (historical messages), do not write to localVariables or emit sideEffects
    if (context.readOnly) {
      return { value: picked, success: true };
    }

    // Persist in localVariables and return as a sideEffect for proper tracking
    const now = new Date();
    context.localVariables.set(key, { value: picked, createdAt: now, updatedAt: now });

    return {
      value: picked,
      success: true,
      sideEffects: [{
        type: 'setLocalVar',
        key,
        value: picked,
      }],
    };
  },
};

/**
 * {{roll::NdS}} - Roll dice (e.g., 2d6, 1d20, 3d8+5)
 */
const rollMacro: MacroDefinition = {
  name: 'roll',
  aliases: ['dice'],
  description: 'Roll dice in NdS format (e.g., 2d6, 1d20+5)',
  args: [{ name: 'dice', description: 'Dice notation like 2d6 or 1d20+5', required: true }],
  category: 'random',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const diceStr = args[0];
    if (!diceStr) {
      return { value: '', success: false, error: 'No dice notation provided' };
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

    if (numDice < 1 || numDice > 100) {
      return { value: '', success: false, error: 'Number of dice must be between 1 and 100' };
    }
    if (sides < 1 || sides > 99999) {
      return { value: '', success: false, error: 'Dice sides must be between 1 and 99999' };
    }

    let total = modifier;
    for (let i = 0; i < numDice; i++) {
      total += Math.floor(getRandom(context) * sides) + 1;
    }

    return { value: total.toString(), success: true };
  },
};

/**
 * {{range::start::end::step}} - Generate a number from range
 * Actually picks a random number from the range with given step
 */
const rangeMacro: MacroDefinition = {
  name: 'range',
  description: 'Pick a random number from range with optional step',
  args: [
    { name: 'start', description: 'Start of range', required: true },
    { name: 'end', description: 'End of range', required: true },
    { name: 'step', description: 'Step size (default 1)', required: false, defaultValue: '1' },
  ],
  category: 'random',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const start = parseFloat(args[0]);
    const end = parseFloat(args[1]);
    const step = parseFloat(args[2] || '1');

    if (isNaN(start) || isNaN(end) || isNaN(step)) {
      return { value: '', success: false, error: 'Invalid range parameters' };
    }
    if (step <= 0) {
      return { value: '', success: false, error: 'Step must be positive' };
    }

    const numSteps = Math.floor((end - start) / step) + 1;
    const randomStep = Math.floor(getRandom(context) * numSteps);
    const value = start + randomStep * step;

    // Format: remove trailing decimals if whole number
    const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(2);
    return { value: formatted, success: true };
  },
};

/**
 * {{coinflip}} - Heads or Tails
 * {{coinflip::option1::option2}} - Custom binary choice
 */
const coinflipMacro: MacroDefinition = {
  name: 'coinflip',
  aliases: ['coin', 'flip'],
  description: 'Flip a coin (Heads/Tails) or custom binary choice',
  args: [
    { name: 'heads', description: 'Value for heads (default "Heads")', required: false },
    { name: 'tails', description: 'Value for tails (default "Tails")', required: false },
  ],
  category: 'random',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const heads = args[0] || 'Heads';
    const tails = args[1] || 'Tails';
    const value = getRandom(context) < 0.5 ? heads : tails;
    return { value, success: true };
  },
};

/**
 * {{percent}} - Random percentage (0-100)
 * Can be used with conditionals: {{if::{{compare::{{percent}}::>::50}}::high::low}}
 */
const percentMacro: MacroDefinition = {
  name: 'percent',
  aliases: ['pct'],
  description: 'Random percentage from 0 to 100',
  category: 'random',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const value = Math.floor(getRandom(context) * 101);
    return { value: value.toString(), success: true };
  },
};

/**
 * {{shuffle::item1::item2::item3}} - Shuffle and return all items
 * Returns items separated by specified delimiter (default comma)
 */
const shuffleMacro: MacroDefinition = {
  name: 'shuffle',
  description: 'Shuffle items and return all in random order',
  args: [{ name: 'items', description: 'Items to shuffle', required: true }],
  category: 'random',
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length === 0) {
      return { value: '', success: false, error: 'No items to shuffle' };
    }

    // Fisher-Yates shuffle
    const items = [...args];
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(getRandom(context) * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    return { value: items.join(', '), success: true };
  },
};

/**
 * {{weighted::option1::10::option2::30::option3::60}}
 * Pick from weighted options (weights don't need to sum to 100)
 */
const weightedMacro: MacroDefinition = {
  name: 'weighted',
  description: 'Pick from weighted options (item::weight pairs)',
  args: [{ name: 'pairs', description: 'Alternating item::weight pairs', required: true }],
  category: 'random',
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length < 2 || args.length % 2 !== 0) {
      return { value: '', success: false, error: 'Need pairs of item::weight' };
    }

    const items: Array<{ value: string; weight: number }> = [];
    let totalWeight = 0;

    for (let i = 0; i < args.length; i += 2) {
      const value = args[i];
      const weight = parseFloat(args[i + 1]);

      if (isNaN(weight) || weight < 0) {
        return { value: '', success: false, error: `Invalid weight: ${args[i + 1]}` };
      }

      items.push({ value, weight });
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return { value: '', success: false, error: 'Total weight cannot be zero' };
    }

    let roll = getRandom(context) * totalWeight;
    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) {
        return { value: item.value, success: true };
      }
    }

    // Fallback (shouldn't happen)
    return { value: items[items.length - 1].value, success: true };
  },
};

/**
 * Register all random macros
 */
export function registerRandomMacros(): void {
  registerMacros([
    randomMacro,
    pickMacro,
    rollMacro,
    rangeMacro,
    coinflipMacro,
    percentMacro,
    shuffleMacro,
    weightedMacro,
  ]);
}
