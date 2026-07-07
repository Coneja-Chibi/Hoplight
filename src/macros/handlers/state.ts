// ============================================================================
// STATE MACROS
// The author-facing state namespace: scoped, typed, side-effect-only.
//
//   {{state.set::scope:key::value}}     set (renders empty)
//   {{state.unset::scope:key}}          delete (renders empty)
//   {{state.get::scope:key}}            read (scope-aware getvar)
//   {{state.show::scope:key}}           pretty-print for inspection (yaml|json)
//   {{silent::...}}                     run mutations inline, render nothing
//   {{show::content}}                   force literal render
//   {{has::key}} / {{is_empty::key}} / {{notempty::key}}   emptiness checks
//
// Scope syntax: `scope:key` with scopes session (default) / character /
// arc / scene / global. Keys support dot-notation for nested values:
// {{state.set::global:user_preferences.font::serif}}.
//
// All mutations render empty and respect MacroContext.readOnly.
// (NB: `empty` was not claimed — it's a long-standing alias of {{noop}};
// use {{is_empty}}.)
// ============================================================================

import yaml from 'js-yaml';
import { MacroDefinition, MacroResult, MacroContext, MacroVariableValue, LazyMacroArg } from '../types';
import { registerMacros } from '../registry';
import { resolveVar, getNestedValue, setNestedValue, parseValue, valueToString } from './variables';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Split a resolved storage key into (variable name, nested path).
 * "notebook.page.1" → ["notebook", "page.1"]; no dot → [key, undefined].
 */
function splitNestedPath(storageKey: string): [string, string | undefined] {
  const dotIdx = storageKey.indexOf('.');
  if (dotIdx === -1) return [storageKey, undefined];
  return [storageKey.slice(0, dotIdx), storageKey.slice(dotIdx + 1)];
}

/** Read a (possibly nested) scoped value. */
export function readScopedValue(rawKey: string, context: MacroContext): MacroVariableValue | undefined {
  const { vars, target } = resolveVar(rawKey, context);
  const [varName, path] = splitNestedPath(target.key);
  const variable = vars.get(varName);
  if (!variable) return undefined;
  return path ? getNestedValue(variable.value, path) : variable.value;
}

/** Emptiness check: undefined/null, '', empty array, empty object. */
export function isEmptyValue(value: MacroVariableValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

// -----------------------------------------------------------------------------
// state.set / state.unset / state.get / state.show
// -----------------------------------------------------------------------------

/**
 * {{state.set::scope:key::value}} - Set a scoped variable. Renders empty.
 */
const stateSetMacro: MacroDefinition = {
  name: 'state.set',
  description: 'Set a scoped variable: {{state.set::session:callsign::HEARTTHROB}}. Renders empty.',
  args: [
    { name: 'key', description: 'scope:key (scopes: session/character/arc/scene/global)', required: true },
    { name: 'value', description: 'Value to set', required: true },
  ],
  category: 'variables',
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (context.readOnly) {
      return { value: '', success: true };
    }
    if (args.length < 2) {
      return { value: '', success: false, error: 'Key and value required' };
    }

    const { vars, target, setType } = resolveVar(args[0], context);
    const [varName, path] = splitNestedPath(target.key);
    const newValue = parseValue(args.slice(1).join('::'));

    let value: MacroVariableValue;
    if (path) {
      const existing = vars.get(varName)?.value || {};
      value = setNestedValue(
        typeof existing === 'object' && existing !== null ? JSON.parse(JSON.stringify(existing)) : {},
        path,
        newValue
      );
    } else {
      value = newValue;
    }

    return {
      value: '',
      success: true,
      sideEffects: [{ type: setType, key: varName, value }],
    };
  },
};

/**
 * {{state.unset::scope:key}} - Delete a scoped variable. Renders empty.
 */
const stateUnsetMacro: MacroDefinition = {
  name: 'state.unset',
  aliases: ['state.delete'],
  description: 'Delete a scoped variable: {{state.unset::session:callsign}}. Renders empty.',
  args: [{ name: 'key', description: 'scope:key', required: true }],
  category: 'variables',
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (context.readOnly) {
      return { value: '', success: true };
    }
    const rawKey = args[0];
    if (!rawKey) {
      return { value: '', success: false, error: 'Key required' };
    }

    const { vars, target, setType, delType } = resolveVar(rawKey, context);
    const [varName, path] = splitNestedPath(target.key);

    if (path) {
      // Nested unset: remove the leaf from the object
      const existing = vars.get(varName)?.value;
      if (typeof existing !== 'object' || existing === null) {
        return { value: '', success: true };
      }
      const copy = JSON.parse(JSON.stringify(existing));
      const segments = path.split('.');
      const leaf = segments.pop()!;
      let cursor: MacroVariableValue | undefined = copy;
      for (const seg of segments) {
        if (typeof cursor !== 'object' || cursor === null) return { value: '', success: true };
        cursor = Array.isArray(cursor)
          ? cursor[parseInt(seg, 10)]
          : (cursor as Record<string, MacroVariableValue>)[seg];
      }
      if (typeof cursor === 'object' && cursor !== null && !Array.isArray(cursor)) {
        delete (cursor as Record<string, MacroVariableValue>)[leaf];
      }
      return {
        value: '',
        success: true,
        sideEffects: [{ type: setType, key: varName, value: copy }],
      };
    }

    return {
      value: '',
      success: true,
      sideEffects: [{ type: delType, key: varName }],
    };
  },
};

/**
 * {{state.get::scope:key}} - Read a scoped variable (scope-aware getvar).
 */
const stateGetMacro: MacroDefinition = {
  name: 'state.get',
  description: 'Read a scoped variable: {{state.get::session:callsign}}.',
  args: [{ name: 'key', description: 'scope:key', required: true }],
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const rawKey = args[0];
    if (!rawKey) {
      return { value: '', success: false, error: 'Key required' };
    }
    return { value: valueToString(readScopedValue(rawKey, context)), success: true };
  },
};

/**
 * {{state.show::scope:key}} - Pretty-print a variable for state inspection.
 * {{state.show::scope:key::json}} - pick the format (yaml is default).
 */
const stateShowMacro: MacroDefinition = {
  name: 'state.show',
  aliases: ['showvar'],
  description: 'Pretty-print a variable (yaml default, ::json for JSON).',
  args: [
    { name: 'key', description: 'scope:key', required: true },
    { name: 'format', description: 'yaml | json (default yaml)', required: false },
  ],
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const rawKey = args[0];
    if (!rawKey) {
      return { value: '', success: false, error: 'Key required' };
    }
    const value = readScopedValue(rawKey, context);
    if (value === undefined || value === null) {
      return { value: '', success: true };
    }

    const format = (args[1] || 'yaml').toLowerCase();
    if (typeof value !== 'object') {
      return { value: String(value), success: true };
    }
    if (format === 'json') {
      return { value: JSON.stringify(value, null, 2), success: true };
    }
    try {
      return { value: yaml.dump(value, { lineWidth: 100 }).trimEnd(), success: true };
    } catch {
      return { value: JSON.stringify(value, null, 2), success: true };
    }
  },
};

// -----------------------------------------------------------------------------
// silent / show
// -----------------------------------------------------------------------------

/**
 * {{silent::...}} - Run everything inside (side effects apply), render
 * nothing. The macro-level escape hatch for inline mutation batches.
 */
const silentMacro: MacroDefinition = {
  name: 'silent',
  description: 'Evaluate content for side effects, render nothing.',
  args: [{ name: 'content', description: 'Content to evaluate silently', required: true }],
  category: 'variables',
  hasSideEffects: true,
  lazyHandler: (args: LazyMacroArg[], _context: MacroContext): MacroResult => {
    for (const arg of args) {
      arg.evaluate(); // side effects fire, output discarded
    }
    return { value: '', success: true };
  },
  handler: (_args: string[], _context: MacroContext): MacroResult => {
    // Eager fallback: args were already evaluated (side effects applied);
    // discard the rendered text.
    return { value: '', success: true };
  },
};

/**
 * {{show::content}} - Force literal render of content (inverse of silent).
 */
const showMacro: MacroDefinition = {
  name: 'show',
  description: 'Force literal render of content (inverse of {{silent}}).',
  args: [{ name: 'content', description: 'Content to render', required: true }],
  category: 'variables',
  handler: (args: string[], _context: MacroContext): MacroResult => {
    return { value: args.join('::'), success: true };
  },
};

// -----------------------------------------------------------------------------
// has / is_empty / notempty
// -----------------------------------------------------------------------------

/**
 * {{has::key}} - true if the variable is set and non-empty.
 */
const hasMacro: MacroDefinition = {
  name: 'has',
  description: 'True if the variable is set and non-empty (scope-aware).',
  args: [{ name: 'key', description: 'scope:key', required: true }],
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const rawKey = args[0];
    if (!rawKey) {
      return { value: 'false', success: true };
    }
    return { value: isEmptyValue(readScopedValue(rawKey, context)) ? 'false' : 'true', success: true };
  },
};

/**
 * {{is_empty::key}} - inverse of {{has}}.
 * (Named is_empty because {{empty}} is a legacy alias of {{noop}}.)
 */
const isEmptyMacro: MacroDefinition = {
  name: 'is_empty',
  description: 'True if the variable is unset or empty (inverse of {{has}}).',
  args: [{ name: 'key', description: 'scope:key', required: true }],
  category: 'variables',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const rawKey = args[0];
    if (!rawKey) {
      return { value: 'true', success: true };
    }
    return { value: isEmptyValue(readScopedValue(rawKey, context)) ? 'true' : 'false', success: true };
  },
};

/**
 * {{notempty::key}} - alias semantics of {{has}}.
 */
const notEmptyMacro: MacroDefinition = {
  name: 'notempty',
  description: 'True if the variable is set and non-empty (alias of {{has}}).',
  args: [{ name: 'key', description: 'scope:key', required: true }],
  category: 'variables',
  handler: hasMacro.handler,
};

/**
 * Register all state macros
 */
export function registerStateMacros(): void {
  registerMacros([
    stateSetMacro,
    stateUnsetMacro,
    stateGetMacro,
    stateShowMacro,
    silentMacro,
    showMacro,
    hasMacro,
    isEmptyMacro,
    notEmptyMacro,
  ]);
}
