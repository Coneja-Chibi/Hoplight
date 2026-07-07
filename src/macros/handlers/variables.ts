// ============================================================================
// CHAT VARIABLES MACROS
// Local (per-chat), Global (cross-chat), and Structured (objects/arrays)
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext, MacroVariableValue, MacroSideEffect } from '../types';
import { registerMacros } from '../registry';
import { resolveVariableTarget, mapForTarget, effectTypesForTarget, ResolvedVariableTarget } from '../scopes';

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Resolve a (possibly scope-prefixed) variable name to its storage map,
 * storage key, and side-effect types. `{{setvar::global:x::1}}` writes a
 * global; `{{getvar::character:notebook}}` reads the char-namespaced key;
 * bare names behave exactly as before (session scope).
 */
export function resolveVar(name: string, context: MacroContext): {
  target: ResolvedVariableTarget;
  vars: Map<string, { value: MacroVariableValue; createdAt: Date; updatedAt: Date }>;
  setType: 'setLocalVar' | 'setGlobalVar';
  delType: 'deleteLocalVar' | 'deleteGlobalVar';
} {
  const target = resolveVariableTarget(name, context);
  const fx = effectTypesForTarget(target);
  return {
    target,
    vars: mapForTarget(target, context),
    setType: fx.set,
    delType: fx.del,
  };
}

/**
 * Safely get a value from a nested object using dot notation or array access
 * e.g., "stats.strength" or "inventory.0"
 */
export function getNestedValue(obj: MacroVariableValue, key: string): MacroVariableValue | undefined {
  if (typeof obj !== 'object' || obj === null) {
    return undefined;
  }

  const parts = key.split('.');
  let current: MacroVariableValue = obj;

  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = parseInt(part, 10);
      if (isNaN(index) || index < 0 || index >= current.length) {
        return undefined;
      }
      current = current[index];
    } else {
      current = (current as Record<string, MacroVariableValue>)[part];
    }

    if (current === undefined) {
      return undefined;
    }
  }

  return current;
}

/**
 * Safely set a value in a nested object using dot notation
 */
export function setNestedValue(obj: MacroVariableValue, key: string, value: MacroVariableValue): MacroVariableValue {
  if (typeof obj !== 'object' || obj === null) {
    obj = {};
  }

  const parts = key.split('.');
  let current = obj as Record<string, MacroVariableValue>;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, MacroVariableValue>;
  }

  current[parts[parts.length - 1]] = value;
  return obj;
}

/**
 * Convert a MacroVariableValue to string for output
 */
export function valueToString(value: MacroVariableValue | undefined): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Parse a string value to appropriate type
 */
export function parseValue(value: string): MacroVariableValue {
  // Try to parse as number
  const num = parseFloat(value);
  if (!isNaN(num) && isFinite(num) && String(num) === value) {
    return num;
  }

  // Try to parse as boolean
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  // Try to parse as JSON (for objects/arrays)
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    // Not JSON, keep as string
  }

  return value;
}

// -----------------------------------------------------------------------------
// Local Variables (per-chat)
// -----------------------------------------------------------------------------

/**
 * {{getvar::name}} - Get local variable
 * {{getvar::name::key}} - Get nested key from object variable
 */
const getvarMacro: MacroDefinition = {
  name: 'getvar',
  aliases: ['var'],
  description: 'Get a chat-local variable. Use ::key for nested access.',
  args: [
    { name: 'name', description: 'Variable name', required: true },
    { name: 'key', description: 'Nested key (optional)', required: false },
  ],
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const name = args[0];
    if (!name) {
      return { value: '', success: false, error: 'Variable name required' };
    }

    const { vars, target } = resolveVar(name, context);
    const variable = vars.get(target.key);
    if (!variable) {
      return { value: '', success: true }; // Undefined variables return empty
    }

    // If nested key provided
    if (args[1]) {
      const nested = getNestedValue(variable.value, args[1]);
      return { value: valueToString(nested), success: true };
    }

    return { value: valueToString(variable.value), success: true };
  },
};

/**
 * {{setvar::name::value}} - Set local variable
 * {{setvar::name::key::value}} - Set nested key in object variable
 */
const setvarMacro: MacroDefinition = {
  name: 'setvar',
  description: 'Set a chat-local variable. Returns empty. Use ::key::value for nested.',
  args: [
    { name: 'name', description: 'Variable name', required: true },
    { name: 'value', description: 'Value to set', required: true },
  ],
  category: 'variables',
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    // No-op in read-only mode (historical messages)
    if (context.readOnly) {
      return { value: '', success: true };
    }

    if (args.length < 2) {
      return { value: '', success: false, error: 'Name and value required' };
    }

    const name = args[0];
    const { vars, target, setType } = resolveVar(name, context);
    let value: MacroVariableValue;

    if (args.length === 2) {
      // Simple set: {{setvar::name::value}}
      value = parseValue(args[1]);
    } else {
      // Nested set: {{setvar::name::key::value}}
      const key = args[1];
      const newValue = parseValue(args[2]);
      const existing = vars.get(target.key)?.value || {};
      value = setNestedValue(existing, key, newValue);
    }

    return {
      value: '', // setvar returns empty
      success: true,
      sideEffects: [{
        type: setType,
        key: target.key,
        value,
      }],
    };
  },
};

/**
 * {{addvar::name::value}} - Add to variable (numeric addition or string concatenation)
 *
 * Auto-detects type: if value is an exact number, adds numerically.
 * Otherwise concatenates as string. This matches SillyTavern behavior where
 * addvar is used for both numeric accumulation and string building
 * (e.g. {{addvar::notebook_X::$1 /// }}).
 */
const addvarMacro: MacroDefinition = {
  name: 'addvar',
  description: 'Add to a variable. Numeric values add numerically, strings concatenate.',
  args: [
    { name: 'name', description: 'Variable name', required: true },
    { name: 'value', description: 'Value to add (number or string)', required: true },
  ],
  category: 'variables',
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    // No-op in read-only mode (historical messages)
    if (context.readOnly) {
      return { value: '', success: true };
    }

    const name = args[0];
    const rawValue = args[1];

    if (!name) {
      return { value: '', success: false, error: 'Variable name required' };
    }
    if (rawValue === undefined || rawValue === null) {
      return { value: '', success: false, error: 'Value required' };
    }

    const { vars, target, setType } = resolveVar(name, context);
    const current = vars.get(target.key)?.value;
    const numericValue = parseFloat(rawValue);

    let newValue: string | number;
    if (!isNaN(numericValue) && isFinite(numericValue) && String(numericValue) === rawValue.trim()) {
      // Exact numeric match — add numerically
      const currentNum = typeof current === 'number' ? current : 0;
      newValue = currentNum + numericValue;
    } else {
      // String concatenation
      const currentStr = typeof current === 'string' ? current : (current != null ? String(current) : '');
      newValue = currentStr + rawValue;
    }

    return {
      value: '',
      success: true,
      sideEffects: [{
        type: setType,
        key: target.key,
        value: newValue,
      }],
    };
  },
};

/**
 * {{incvar::name}} - Increment by 1, return new value
 */
const incvarMacro: MacroDefinition = {
  name: 'incvar',
  description: 'Increment variable by 1. Returns new value.',
  args: [{ name: 'name', description: 'Variable name', required: true }],
  category: 'variables',
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    // No-op in read-only mode (historical messages)
    if (context.readOnly) {
      return { value: '', success: true };
    }

    const name = args[0];
    if (!name) {
      return { value: '', success: false, error: 'Variable name required' };
    }

    const { vars, target, setType } = resolveVar(name, context);
    const current = vars.get(target.key)?.value;
    const currentNum = typeof current === 'number' ? current : 0;
    const newValue = currentNum + 1;

    return {
      value: newValue.toString(),
      success: true,
      sideEffects: [{
        type: setType,
        key: target.key,
        value: newValue,
      }],
    };
  },
};

/**
 * {{decvar::name}} - Decrement by 1, return new value
 */
const decvarMacro: MacroDefinition = {
  name: 'decvar',
  description: 'Decrement variable by 1. Returns new value.',
  args: [{ name: 'name', description: 'Variable name', required: true }],
  category: 'variables',
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    // No-op in read-only mode (historical messages)
    if (context.readOnly) {
      return { value: '', success: true };
    }

    const name = args[0];
    if (!name) {
      return { value: '', success: false, error: 'Variable name required' };
    }

    const { vars, target, setType } = resolveVar(name, context);
    const current = vars.get(target.key)?.value;
    const currentNum = typeof current === 'number' ? current : 0;
    const newValue = currentNum - 1;

    return {
      value: newValue.toString(),
      success: true,
      sideEffects: [{
        type: setType,
        key: target.key,
        value: newValue,
      }],
    };
  },
};

/**
 * {{hasvar::name}} - Check if variable exists
 */
const hasvarMacro: MacroDefinition = {
  name: 'hasvar',
  description: 'Check if variable exists. Returns "true" or "false".',
  args: [{ name: 'name', description: 'Variable name', required: true }],
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const name = args[0];
    if (!name) {
      return { value: 'false', success: true };
    }

    const { vars, target } = resolveVar(name, context);
    const exists = vars.has(target.key);
    return { value: exists ? 'true' : 'false', success: true };
  },
};

/**
 * {{delvar::name}} - Delete variable
 */
const delvarMacro: MacroDefinition = {
  name: 'delvar',
  description: 'Delete a variable. Returns empty.',
  args: [{ name: 'name', description: 'Variable name', required: true }],
  category: 'variables',
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    // No-op in read-only mode (historical messages)
    if (context.readOnly) {
      return { value: '', success: true };
    }

    const name = args[0];
    if (!name) {
      return { value: '', success: false, error: 'Variable name required' };
    }

    const { target, delType } = resolveVar(name, context);
    return {
      value: '',
      success: true,
      sideEffects: [{
        type: delType,
        key: target.key,
      }],
    };
  },
};

// -----------------------------------------------------------------------------
// Global Variables (cross-chat)
// -----------------------------------------------------------------------------

/**
 * {{getglobalvar::name}} - Get global variable
 */
const getglobalvarMacro: MacroDefinition = {
  name: 'getglobalvar',
  aliases: ['globalvar', 'gvar'],
  description: 'Get a global variable (persists across chats).',
  args: [
    { name: 'name', description: 'Variable name', required: true },
    { name: 'key', description: 'Nested key (optional)', required: false },
  ],
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const name = args[0];
    if (!name) {
      return { value: '', success: false, error: 'Variable name required' };
    }

    const variable = context.globalVariables.get(name);
    if (!variable) {
      return { value: '', success: true };
    }

    if (args[1]) {
      const nested = getNestedValue(variable.value, args[1]);
      return { value: valueToString(nested), success: true };
    }

    return { value: valueToString(variable.value), success: true };
  },
};

/**
 * {{setglobalvar::name::value}} - Set global variable
 */
const setglobalvarMacro: MacroDefinition = {
  name: 'setglobalvar',
  aliases: ['setgvar'],
  description: 'Set a global variable (persists across chats). Returns empty.',
  args: [
    { name: 'name', description: 'Variable name', required: true },
    { name: 'value', description: 'Value to set', required: true },
  ],
  category: 'variables',
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    // No-op in read-only mode (historical messages)
    if (context.readOnly) {
      return { value: '', success: true };
    }

    if (args.length < 2) {
      return { value: '', success: false, error: 'Name and value required' };
    }

    const name = args[0];
    let value: MacroVariableValue;

    if (args.length === 2) {
      value = parseValue(args[1]);
    } else {
      const key = args[1];
      const newValue = parseValue(args[2]);
      const existing = context.globalVariables.get(name)?.value || {};
      value = setNestedValue(existing, key, newValue);
    }

    return {
      value: '',
      success: true,
      sideEffects: [{
        type: 'setGlobalVar',
        key: name,
        value,
      }],
    };
  },
};

/**
 * {{addglobalvar::name::value}} - Add to global variable (numeric or string)
 */
const addglobalvarMacro: MacroDefinition = {
  name: 'addglobalvar',
  aliases: ['addgvar'],
  description: 'Add to a global variable. Numeric values add numerically, strings concatenate.',
  args: [
    { name: 'name', description: 'Variable name', required: true },
    { name: 'value', description: 'Value to add (number or string)', required: true },
  ],
  category: 'variables',
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    // No-op in read-only mode (historical messages)
    if (context.readOnly) {
      return { value: '', success: true };
    }

    const name = args[0];
    const rawValue = args[1];

    if (!name) {
      return { value: '', success: false, error: 'Variable name required' };
    }
    if (rawValue === undefined || rawValue === null) {
      return { value: '', success: false, error: 'Value required' };
    }

    const current = context.globalVariables.get(name)?.value;
    const numericValue = parseFloat(rawValue);

    let newValue: string | number;
    if (!isNaN(numericValue) && isFinite(numericValue) && String(numericValue) === rawValue.trim()) {
      const currentNum = typeof current === 'number' ? current : 0;
      newValue = currentNum + numericValue;
    } else {
      const currentStr = typeof current === 'string' ? current : (current != null ? String(current) : '');
      newValue = currentStr + rawValue;
    }

    return {
      value: String(newValue),
      success: true,
      sideEffects: [{
        type: 'setGlobalVar',
        key: name,
        value: newValue,
      }],
    };
  },
};

/**
 * {{incglobalvar::name}} - Increment global variable by 1
 */
const incglobalvarMacro: MacroDefinition = {
  name: 'incglobalvar',
  aliases: ['incgvar'],
  description: 'Increment global variable by 1. Returns new value.',
  args: [{ name: 'name', description: 'Variable name', required: true }],
  category: 'variables',
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    // No-op in read-only mode (historical messages)
    if (context.readOnly) {
      return { value: '', success: true };
    }

    const name = args[0];
    if (!name) {
      return { value: '', success: false, error: 'Variable name required' };
    }

    const current = context.globalVariables.get(name)?.value;
    const currentNum = typeof current === 'number' ? current : 0;
    const newValue = currentNum + 1;

    return {
      value: newValue.toString(),
      success: true,
      sideEffects: [{
        type: 'setGlobalVar',
        key: name,
        value: newValue,
      }],
    };
  },
};

/**
 * {{decglobalvar::name}} - Decrement global variable by 1
 */
const decglobalvarMacro: MacroDefinition = {
  name: 'decglobalvar',
  aliases: ['decgvar'],
  description: 'Decrement global variable by 1. Returns new value.',
  args: [{ name: 'name', description: 'Variable name', required: true }],
  category: 'variables',
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    // No-op in read-only mode (historical messages)
    if (context.readOnly) {
      return { value: '', success: true };
    }

    const name = args[0];
    if (!name) {
      return { value: '', success: false, error: 'Variable name required' };
    }

    const current = context.globalVariables.get(name)?.value;
    const currentNum = typeof current === 'number' ? current : 0;
    const newValue = currentNum - 1;

    return {
      value: newValue.toString(),
      success: true,
      sideEffects: [{
        type: 'setGlobalVar',
        key: name,
        value: newValue,
      }],
    };
  },
};

// -----------------------------------------------------------------------------
// Structured Variables (arrays, objects)
// -----------------------------------------------------------------------------

/**
 * {{pushvar::name::value}} - Push value to array variable
 */
const pushvarMacro: MacroDefinition = {
  name: 'pushvar',
  description: 'Push value to array variable. Creates array if needed.',
  args: [
    { name: 'name', description: 'Variable name', required: true },
    { name: 'value', description: 'Value to push', required: true },
  ],
  category: 'variables',
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    // No-op in read-only mode (historical messages)
    if (context.readOnly) {
      return { value: '', success: true };
    }

    const name = args[0];
    const value = args[1];

    if (!name || value === undefined) {
      return { value: '', success: false, error: 'Name and value required' };
    }

    const { vars, target, setType } = resolveVar(name, context);
    const current = vars.get(target.key)?.value;
    const arr = Array.isArray(current) ? [...current] : [];
    arr.push(parseValue(value));

    return {
      value: arr.length.toString(), // Return new length
      success: true,
      sideEffects: [{
        type: setType,
        key: target.key,
        value: arr,
      }],
    };
  },
};

/**
 * {{popvar::name}} - Pop last value from array variable
 */
const popvarMacro: MacroDefinition = {
  name: 'popvar',
  description: 'Pop and return last value from array variable.',
  args: [{ name: 'name', description: 'Variable name', required: true }],
  category: 'variables',
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    // No-op in read-only mode (historical messages)
    if (context.readOnly) {
      return { value: '', success: true };
    }

    const name = args[0];
    if (!name) {
      return { value: '', success: false, error: 'Variable name required' };
    }

    const { vars, target, setType } = resolveVar(name, context);
    const current = vars.get(target.key)?.value;
    if (!Array.isArray(current) || current.length === 0) {
      return { value: '', success: true };
    }

    const arr = [...current];
    const popped = arr.pop();

    return {
      value: valueToString(popped),
      success: true,
      sideEffects: [{
        type: setType,
        key: target.key,
        value: arr,
      }],
    };
  },
};

/**
 * {{shiftvar::name}} - Remove and return FIRST value from array variable
 */
const shiftvarMacro: MacroDefinition = {
  name: 'shiftvar',
  description: 'Remove and return first value from array variable.',
  args: [{ name: 'name', description: 'Variable name', required: true }],
  category: 'variables',
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    // No-op in read-only mode (historical messages)
    if (context.readOnly) {
      return { value: '', success: true };
    }

    const name = args[0];
    if (!name) {
      return { value: '', success: false, error: 'Variable name required' };
    }

    const { vars, target, setType } = resolveVar(name, context);
    const current = vars.get(target.key)?.value;
    if (!Array.isArray(current) || current.length === 0) {
      return { value: '', success: true };
    }

    const arr = [...current];
    const shifted = arr.shift();

    return {
      value: valueToString(shifted),
      success: true,
      sideEffects: [{
        type: setType,
        key: target.key,
        value: arr,
      }],
    };
  },
};

/**
 * {{listvar::name}} - List array items as comma-separated string
 */
const listvarMacro: MacroDefinition = {
  name: 'listvar',
  description: 'List array items as comma-separated string.',
  args: [
    { name: 'name', description: 'Variable name', required: true },
    { name: 'separator', description: 'Separator (default: ", ")', required: false },
  ],
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const name = args[0];
    const separator = args[1] || ', ';

    if (!name) {
      return { value: '', success: false, error: 'Variable name required' };
    }

    const { vars, target } = resolveVar(name, context);
    const current = vars.get(target.key)?.value;
    if (!Array.isArray(current)) {
      return { value: '', success: true };
    }

    return {
      value: current.map(v => valueToString(v)).join(separator),
      success: true,
    };
  },
};

/**
 * {{countvar::name}} - Count items in array or keys in object
 */
const countvarMacro: MacroDefinition = {
  name: 'countvar',
  description: 'Count items in array or keys in object.',
  args: [{ name: 'name', description: 'Variable name', required: true }],
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const name = args[0];
    if (!name) {
      return { value: '0', success: true };
    }

    const { vars, target } = resolveVar(name, context);
    const current = vars.get(target.key)?.value;
    if (Array.isArray(current)) {
      return { value: current.length.toString(), success: true };
    }
    if (typeof current === 'object' && current !== null) {
      return { value: Object.keys(current as Record<string, unknown>).length.toString(), success: true };
    }

    return { value: '0', success: true };
  },
};

/**
 * {{allvars}} - Debug: dump all local variables as JSON
 */
const allvarsMacro: MacroDefinition = {
  name: 'allvars',
  aliases: ['dumpvars'],
  description: 'Debug: list all local variables as JSON.',
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const vars: Record<string, MacroVariableValue> = {};
    context.localVariables.forEach((v, k) => {
      vars[k] = v.value;
    });
    return {
      value: JSON.stringify(vars, null, 2),
      success: true,
    };
  },
};

/**
 * Register all variable macros
 */
export function registerVariableMacros(): void {
  registerMacros([
    // Local
    getvarMacro,
    setvarMacro,
    addvarMacro,
    incvarMacro,
    decvarMacro,
    hasvarMacro,
    delvarMacro,
    // Global
    getglobalvarMacro,
    setglobalvarMacro,
    addglobalvarMacro,
    incglobalvarMacro,
    decglobalvarMacro,
    // Structured
    pushvarMacro,
    popvarMacro,
    shiftvarMacro,
    listvarMacro,
    countvarMacro,
    allvarsMacro,
  ]);
}
