// ============================================================================
// CONDITIONAL MACROS
// If/else, switch, and comparison operators
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext, LazyMacroArg } from '../types';
import { registerMacros } from '../registry';
import { evaluateConditionExpression } from '../processor';
import { readScopedValue, isEmptyValue } from './state';
import { valueToString } from './variables';

/**
 * Check if a value is "truthy" for conditional purposes
 * - Empty string, "false", "0", "null", "undefined" are falsy
 * - Everything else is truthy
 */
function isTruthy(value: string): boolean {
  const lower = value.toLowerCase().trim();
  return lower !== '' && lower !== 'false' && lower !== '0' && lower !== 'null' && lower !== 'undefined';
}

/**
 * {{if::condition::then}}
 * {{if::condition::then::else}}
 *
 * If condition is truthy, returns then. Otherwise returns else (or empty).
 */
const ifMacro: MacroDefinition = {
  name: 'if',
  aliases: ['either'],
  description: 'Conditional: {{if::condition::then}} or {{if::condition::then::else}}. {{either}} is the read-aloud alias.',
  args: [
    { name: 'condition', description: 'Value to check for truthiness', required: true },
    { name: 'then', description: 'Value if true', required: true },
    { name: 'else', description: 'Value if false (optional)', required: false },
  ],
  category: 'conditional',
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length < 2) {
      return { value: '', success: false, error: 'if requires condition and then value' };
    }

    const condition = args[0];
    const thenValue = args[1];
    const elseValue = args[2] || '';

    return {
      value: isTruthy(condition) ? thenValue : elseValue,
      success: true,
    };
  },
};

/**
 * {{compare::a::op::b}}
 *
 * Compare two values with an operator. Returns "true" or "false".
 *
 * Operators:
 * - == (equal, case-insensitive for strings)
 * - != (not equal)
 * - > (greater than, numeric)
 * - < (less than, numeric)
 * - >= (greater or equal, numeric)
 * - <= (less or equal, numeric)
 * - === (strict equal, case-sensitive)
 * - contains (a contains b)
 * - startswith (a starts with b)
 * - endswith (a ends with b)
 * - matches (a matches regex b)
 */
const compareMacro: MacroDefinition = {
  name: 'compare',
  aliases: ['cmp'],
  description: 'Compare two values. Returns "true" or "false".',
  args: [
    { name: 'a', description: 'First value', required: true },
    { name: 'op', description: 'Operator (==, !=, >, <, >=, <=, contains, startswith, endswith)', required: true },
    { name: 'b', description: 'Second value', required: true },
  ],
  category: 'conditional',
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length < 3) {
      return { value: '', success: false, error: 'compare requires a, operator, and b' };
    }

    const a = args[0];
    const op = args[1].toLowerCase();
    const b = args[2];

    let result: boolean;

    switch (op) {
      case '==':
      case 'eq':
        result = a.toLowerCase() === b.toLowerCase();
        break;

      case '!=':
      case 'ne':
      case 'neq':
        result = a.toLowerCase() !== b.toLowerCase();
        break;

      case '===':
        result = a === b;
        break;

      case '!==':
        result = a !== b;
        break;

      case '>':
      case 'gt':
        result = parseFloat(a) > parseFloat(b);
        break;

      case '<':
      case 'lt':
        result = parseFloat(a) < parseFloat(b);
        break;

      case '>=':
      case 'gte':
      case 'ge':
        result = parseFloat(a) >= parseFloat(b);
        break;

      case '<=':
      case 'lte':
      case 'le':
        result = parseFloat(a) <= parseFloat(b);
        break;

      case 'contains':
      case 'includes':
        result = a.toLowerCase().includes(b.toLowerCase());
        break;

      case 'startswith':
      case 'starts':
        result = a.toLowerCase().startsWith(b.toLowerCase());
        break;

      case 'endswith':
      case 'ends':
        result = a.toLowerCase().endsWith(b.toLowerCase());
        break;

      case 'matches':
      case 'regex':
        try {
          const regex = new RegExp(b, 'i');
          result = regex.test(a);
        } catch {
          return { value: '', success: false, error: `Invalid regex: ${b}` };
        }
        break;

      default:
        return { value: '', success: false, error: `Unknown operator: ${op}` };
    }

    return { value: result ? 'true' : 'false', success: true };
  },
};

/**
 * {{switch::value::case1:result1::case2:result2::default}}
 *
 * Switch statement. Compares value against cases, returns matching result.
 * Last argument without colon is the default.
 */
const switchMacro: MacroDefinition = {
  name: 'switch',
  description: 'Switch statement: {{switch::value::case1:result1::case2:result2::default}}',
  args: [
    { name: 'value', description: 'Value to match', required: true },
    { name: 'cases', description: 'case:result pairs', required: true },
  ],
  category: 'conditional',
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length < 2) {
      return { value: '', success: false, error: 'switch requires value and at least one case' };
    }

    const value = args[0].toLowerCase();
    let defaultResult = '';

    // Process case:result pairs
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const colonIndex = arg.indexOf(':');

      if (colonIndex === -1) {
        // No colon - this is the default
        defaultResult = arg;
      } else {
        const caseValue = arg.slice(0, colonIndex).toLowerCase();
        const result = arg.slice(colonIndex + 1);

        if (caseValue === value) {
          return { value: result, success: true };
        }
      }
    }

    return { value: defaultResult, success: true };
  },
};

/**
 * {{and::a::b::...}} - Logical AND
 */
const andMacro: MacroDefinition = {
  name: 'and',
  description: 'Logical AND of all arguments. Returns "true" or "false".',
  category: 'conditional',
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length === 0) {
      return { value: 'false', success: true };
    }

    const result = args.every(arg => isTruthy(arg));
    return { value: result ? 'true' : 'false', success: true };
  },
};

/**
 * {{or::a::b::...}} - Logical OR
 */
const orMacro: MacroDefinition = {
  name: 'or',
  description: 'Logical OR of all arguments. Returns "true" or "false".',
  category: 'conditional',
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length === 0) {
      return { value: 'false', success: true };
    }

    const result = args.some(arg => isTruthy(arg));
    return { value: result ? 'true' : 'false', success: true };
  },
};

/**
 * {{eq::a::b}} - Equality test (case-insensitive), returns "true"/"false".
 * Standalone shorthand for {{compare::a::==::b}}; used by Lumiverse presets.
 */
const eqMacro: MacroDefinition = {
  name: 'eq',
  aliases: ['equals'],
  description: 'Equality test: {{eq::a::b}} returns "true" or "false"',
  args: [
    { name: 'a', description: 'First value', required: true },
    { name: 'b', description: 'Second value', required: true },
  ],
  category: 'conditional',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const a = (args[0] ?? '').toLowerCase();
    const b = (args[1] ?? '').toLowerCase();
    return { value: a === b ? 'true' : 'false', success: true };
  },
};

/**
 * {{not::value}} - Logical NOT
 */
const notMacro: MacroDefinition = {
  name: 'not',
  description: 'Logical NOT. Returns "true" or "false".',
  args: [{ name: 'value', description: 'Value to negate', required: true }],
  category: 'conditional',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const value = args[0] || '';
    return { value: isTruthy(value) ? 'false' : 'true', success: true };
  },
};

// -----------------------------------------------------------------------------
// Plain-English conditional shortcuts (macro engine spec, Part VII)
// All content args are lazy: a skipped branch never evaluates, so side
// effects inside it never fire.
// -----------------------------------------------------------------------------

/** Join trailing lazy args back into one content body (may contain ::). */
function lazyBody(args: LazyMacroArg[], from: number): string {
  return args.slice(from).map(a => a.raw).join('::');
}

/**
 * {{when_all::cond1::cond2::content}} - content if ALL conditions truthy.
 * Conditions support comparisons ("{{getvar::x}} >= 3") and bare truthiness.
 */
const whenAllMacro: MacroDefinition = {
  name: 'when_all',
  description: 'Render content when all conditions are truthy. Last arg is the content.',
  category: 'conditional',
  lazyHandler: (args: LazyMacroArg[], _context: MacroContext): MacroResult => {
    if (args.length < 2) {
      return { value: '', success: false, error: 'when_all requires conditions and content' };
    }
    const conditions = args.slice(0, -1).map(a => a.evaluate().trim());
    const pass = conditions.every(c => evaluateConditionExpression(c));
    return { value: pass ? args[args.length - 1].raw : '', success: true };
  },
  handler: (args: string[], _context: MacroContext): MacroResult => {
    if (args.length < 2) {
      return { value: '', success: false, error: 'when_all requires conditions and content' };
    }
    const pass = args.slice(0, -1).every(c => evaluateConditionExpression(c));
    return { value: pass ? args[args.length - 1] : '', success: true };
  },
};

/**
 * {{when_any::cond1::cond2::content}} - content if ANY condition truthy.
 */
const whenAnyMacro: MacroDefinition = {
  name: 'when_any',
  description: 'Render content when any condition is truthy. Last arg is the content.',
  category: 'conditional',
  lazyHandler: (args: LazyMacroArg[], _context: MacroContext): MacroResult => {
    if (args.length < 2) {
      return { value: '', success: false, error: 'when_any requires conditions and content' };
    }
    const conditions = args.slice(0, -1).map(a => a.evaluate().trim());
    const pass = conditions.some(c => evaluateConditionExpression(c));
    return { value: pass ? args[args.length - 1].raw : '', success: true };
  },
  handler: (args: string[], _context: MacroContext): MacroResult => {
    if (args.length < 2) {
      return { value: '', success: false, error: 'when_any requires conditions and content' };
    }
    const pass = args.slice(0, -1).some(c => evaluateConditionExpression(c));
    return { value: pass ? args[args.length - 1] : '', success: true };
  },
};

/**
 * {{whenempty::var::content}} - content if the variable is unset/empty.
 */
const whenEmptyMacro: MacroDefinition = {
  name: 'whenempty',
  aliases: ['when_empty'],
  description: 'Render content when the variable is unset or empty (scope-aware).',
  category: 'conditional',
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const varName = args[0]?.evaluate().trim() ?? '';
    if (!varName) {
      return { value: '', success: false, error: 'whenempty requires a variable name' };
    }
    if (!isEmptyValue(readScopedValue(varName, context))) {
      return { value: '', success: true };
    }
    return { value: lazyBody(args, 1), success: true };
  },
  handler: (args: string[], context: MacroContext): MacroResult => {
    const varName = args[0] ?? '';
    if (!varName) {
      return { value: '', success: false, error: 'whenempty requires a variable name' };
    }
    const empty = isEmptyValue(readScopedValue(varName, context));
    return { value: empty ? args.slice(1).join('::') : '', success: true };
  },
};

/**
 * {{ifset::var::content}} - content if the variable is set (non-empty).
 * `$var` (and `$<name>`) inside the content resolve to the value.
 */
const ifsetMacro: MacroDefinition = {
  name: 'ifset',
  aliases: ['if_set', 'whenset'],
  description: 'Render content when the variable is set; $var resolves inside.',
  category: 'conditional',
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const varName = args[0]?.evaluate().trim() ?? '';
    if (!varName) {
      return { value: '', success: false, error: 'ifset requires a variable name' };
    }
    const value = readScopedValue(varName, context);
    if (isEmptyValue(value)) {
      return { value: '', success: true };
    }
    const valueStr = valueToString(value);
    // Bare key after any scope prefix, for $<name> substitution
    const bareName = varName.includes(':') ? varName.slice(varName.indexOf(':') + 1) : varName;
    const body = lazyBody(args, 1)
      .replaceAll('$var', valueStr)
      .replaceAll(`$${bareName}`, valueStr);
    return { value: body, success: true };
  },
  handler: (args: string[], context: MacroContext): MacroResult => {
    const varName = args[0] ?? '';
    if (!varName) {
      return { value: '', success: false, error: 'ifset requires a variable name' };
    }
    const value = readScopedValue(varName, context);
    if (isEmptyValue(value)) {
      return { value: '', success: true };
    }
    const valueStr = valueToString(value);
    const bareName = varName.includes(':') ? varName.slice(varName.indexOf(':') + 1) : varName;
    return {
      value: args.slice(1).join('::').replaceAll('$var', valueStr).replaceAll(`$${bareName}`, valueStr),
      success: true,
    };
  },
};

/**
 * Register all conditional macros
 */
export function registerConditionalMacros(): void {
  registerMacros([
    ifMacro,
    compareMacro,
    switchMacro,
    andMacro,
    orMacro,
    notMacro,
    eqMacro,
    whenAllMacro,
    whenAnyMacro,
    whenEmptyMacro,
    ifsetMacro,
  ]);
}
