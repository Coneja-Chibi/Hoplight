// ============================================================================
// TIMING & FREQUENCY MACROS
//
//   {{first_turn::content}}     render only on turn 1
//   {{once::id::content}}       render only the first time this id is seen
//   {{every::N::content}}       render every N turns
//   {{after_turn::N::content}}  render on or after turn N
//   {{before_turn::N::content}} render before turn N
//
// "Turn" = the user exchange being responded to: the number of user
// messages in the chat so far (minimum 1). The greeting-only state and the
// first user message are both turn 1.
//
// All of these are lazy: skipped content never evaluates, so side-effect
// macros inside it never fire.
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext, MacroVariableValue, LazyMacroArg } from '../types';
import { registerMacros } from '../registry';

/** Hidden state variable recording which {{once::id}} blocks have fired. */
const ONCE_STATE_KEY = '__once_fired';

/** Current turn number (1-based). */
export function currentTurn(context: MacroContext): number {
  const userMessages = context.messages.filter(m => m.role === 'user').length;
  return Math.max(1, userMessages);
}

function bodyFromArgs(args: LazyMacroArg[], from: number): string {
  return args.slice(from).map(a => a.raw).join('::');
}

/**
 * {{first_turn::content}} - render only on turn 1.
 */
const firstTurnMacro: MacroDefinition = {
  name: 'first_turn',
  aliases: ['on_first_turn'],
  description: 'Render content only on the first turn.',
  args: [{ name: 'content', description: 'Content for turn 1', required: true }],
  category: 'chat',
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    if (currentTurn(context) !== 1) {
      return { value: '', success: true };
    }
    return { value: bodyFromArgs(args, 0), success: true };
  },
  handler: (args: string[], context: MacroContext): MacroResult => {
    return { value: currentTurn(context) === 1 ? args.join('::') : '', success: true };
  },
};

/**
 * {{once::id::content}} - render only the first time this id is
 * encountered in the chat. Fired ids are recorded in a hidden chat
 * variable, so "first time" survives across turns.
 */
const onceMacro: MacroDefinition = {
  name: 'once',
  description: 'Render content only the first time this id fires in the chat.',
  args: [
    { name: 'id', description: 'Unique id for this once-block', required: true },
    { name: 'content', description: 'Content to render once', required: true },
  ],
  category: 'chat',
  hasSideEffects: true,
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const id = args[0]?.evaluate().trim() ?? '';
    if (!id) {
      return { value: '', success: false, error: 'once requires an id' };
    }

    const fired = context.localVariables.get(ONCE_STATE_KEY)?.value;
    const firedMap: Record<string, MacroVariableValue> =
      fired !== null && typeof fired === 'object' && !Array.isArray(fired)
        ? (fired as Record<string, MacroVariableValue>)
        : {};

    if (firedMap[id]) {
      return { value: '', success: true };
    }

    const body = bodyFromArgs(args, 1);
    if (context.readOnly) {
      // Historical replay: render, but don't re-record
      return { value: body, success: true };
    }
    return {
      value: body,
      success: true,
      sideEffects: [{
        type: 'setLocalVar',
        key: ONCE_STATE_KEY,
        value: { ...firedMap, [id]: true },
      }],
    };
  },
  handler: (_args: string[], _context: MacroContext): MacroResult => {
    return { value: '', success: false, error: 'once requires lazy evaluation' };
  },
};

/**
 * {{every::N::content}} - render every N turns (turns divisible by N).
 */
const everyMacro: MacroDefinition = {
  name: 'every',
  description: 'Render content every N turns.',
  args: [
    { name: 'n', description: 'Interval in turns', required: true },
    { name: 'content', description: 'Content to render', required: true },
  ],
  category: 'chat',
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const n = parseInt(args[0]?.evaluate().trim() ?? '', 10);
    if (isNaN(n) || n < 1) {
      return { value: '', success: false, error: 'every requires a positive interval' };
    }
    if (currentTurn(context) % n !== 0) {
      return { value: '', success: true };
    }
    return { value: bodyFromArgs(args, 1), success: true };
  },
  handler: (args: string[], context: MacroContext): MacroResult => {
    const n = parseInt(args[0] ?? '', 10);
    if (isNaN(n) || n < 1) {
      return { value: '', success: false, error: 'every requires a positive interval' };
    }
    return { value: currentTurn(context) % n === 0 ? args.slice(1).join('::') : '', success: true };
  },
};

/**
 * {{after_turn::N::content}} - render on or after turn N.
 */
const afterTurnMacro: MacroDefinition = {
  name: 'after_turn',
  description: 'Render content on or after turn N.',
  args: [
    { name: 'n', description: 'Turn number', required: true },
    { name: 'content', description: 'Content to render', required: true },
  ],
  category: 'chat',
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const n = parseInt(args[0]?.evaluate().trim() ?? '', 10);
    if (isNaN(n)) {
      return { value: '', success: false, error: 'after_turn requires a turn number' };
    }
    if (currentTurn(context) < n) {
      return { value: '', success: true };
    }
    return { value: bodyFromArgs(args, 1), success: true };
  },
  handler: (args: string[], context: MacroContext): MacroResult => {
    const n = parseInt(args[0] ?? '', 10);
    if (isNaN(n)) {
      return { value: '', success: false, error: 'after_turn requires a turn number' };
    }
    return { value: currentTurn(context) >= n ? args.slice(1).join('::') : '', success: true };
  },
};

/**
 * {{before_turn::N::content}} - render only before turn N.
 */
const beforeTurnMacro: MacroDefinition = {
  name: 'before_turn',
  description: 'Render content only before turn N.',
  args: [
    { name: 'n', description: 'Turn number', required: true },
    { name: 'content', description: 'Content to render', required: true },
  ],
  category: 'chat',
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const n = parseInt(args[0]?.evaluate().trim() ?? '', 10);
    if (isNaN(n)) {
      return { value: '', success: false, error: 'before_turn requires a turn number' };
    }
    if (currentTurn(context) >= n) {
      return { value: '', success: true };
    }
    return { value: bodyFromArgs(args, 1), success: true };
  },
  handler: (args: string[], context: MacroContext): MacroResult => {
    const n = parseInt(args[0] ?? '', 10);
    if (isNaN(n)) {
      return { value: '', success: false, error: 'before_turn requires a turn number' };
    }
    return { value: currentTurn(context) < n ? args.slice(1).join('::') : '', success: true };
  },
};

/**
 * Register all timing macros
 */
export function registerTimingMacros(): void {
  registerMacros([
    firstTurnMacro,
    onceMacro,
    everyMacro,
    afterTurnMacro,
    beforeTurnMacro,
  ]);
}
