// ============================================================================
// PRESET TOGGLE INTROSPECTION MACROS
// "Which prompts are toggled on?" as a first-class primitive.
//
// The toggle-roster pattern: roster member prompts carry their own data as
// metadata fields; roster sections read the live list at render time.
// No registration setvars, no separator hacks, no counters.
//
//   {{enabled::prompt_id}}                  → "true" / "false"
//   {{enabled_any::id1::id2}}               → "true" if ANY enabled
//   {{enabled_all::id1::id2}}               → "true" if ALL enabled
//   {{enabled_count::prefix}}               → number of enabled matches
//   {{enabled_list::prefix}}                → JSON list of identifiers
//   {{enabled_list::prefix::field}}         → JSON list of metadata field values
//   {{join_enabled::prefix::field::sep}}    → joined field values, no dangling sep
//   {{when_enabled::id::content}}           → content only if enabled (lazy)
//
// A selector matches a prompt when it equals the prompt's identifier, is a
// prefix of it, or equals the prompt's `roster` metadata field — so both
// `hp_dir_` prefix conventions and `roster: director` declarations work.
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext, PresetPromptInfo, MacroVariableValue, LazyMacroArg } from '../types';
import { registerMacros } from '../registry';
import { formatList, listItemToString } from '../lists';

// -----------------------------------------------------------------------------
// Matching helpers
// -----------------------------------------------------------------------------

function allPrompts(context: MacroContext): PresetPromptInfo[] {
  return context.presetPrompts ?? [];
}

/** Does this prompt match the selector (exact id, id prefix, or roster name)? */
function matchesSelector(prompt: PresetPromptInfo, selector: string): boolean {
  const sel = selector.trim().toLowerCase();
  if (!sel) return false;
  const identifier = prompt.identifier?.toLowerCase() ?? '';
  if (identifier === sel || identifier.startsWith(sel)) return true;
  if (prompt.id.toLowerCase() === sel) return true;
  const roster = prompt.metadata?.roster;
  return typeof roster === 'string' && roster.trim().toLowerCase() === sel;
}

/** Enabled prompts matching the selector. */
export function enabledMatching(context: MacroContext, selector: string): PresetPromptInfo[] {
  return allPrompts(context).filter(p => p.enabled && matchesSelector(p, selector));
}

/** Is the prompt with this exact identifier (or uuid) enabled? */
function isPromptEnabled(context: MacroContext, idOrIdentifier: string): boolean {
  const sel = idOrIdentifier.trim().toLowerCase();
  return allPrompts(context).some(
    p => p.enabled && (p.identifier?.toLowerCase() === sel || p.id.toLowerCase() === sel)
  );
}

/**
 * Read a field from a prompt: metadata first, then the built-ins
 * (id, identifier, name).
 */
export function promptField(prompt: PresetPromptInfo, field: string): MacroVariableValue | undefined {
  const meta = prompt.metadata?.[field];
  if (meta !== undefined) return meta;
  switch (field) {
    case 'id': return prompt.id;
    case 'identifier': return prompt.identifier;
    case 'name': return prompt.name;
    default: return undefined;
  }
}

// -----------------------------------------------------------------------------
// Macros
// -----------------------------------------------------------------------------

/**
 * {{enabled::prompt_id}} - Is the named prompt currently toggled on?
 */
const enabledMacro: MacroDefinition = {
  name: 'enabled',
  aliases: ['is_enabled', 'prompt_enabled'],
  description: 'Is the named preset prompt currently toggled on? Returns "true"/"false".',
  args: [{ name: 'prompt_id', description: 'Prompt identifier', required: true }],
  category: 'preset',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const id = args[0];
    if (!id) {
      return { value: '', success: false, error: 'Prompt id required' };
    }
    return { value: isPromptEnabled(context, id) ? 'true' : 'false', success: true };
  },
};

/**
 * {{enabled_any::id1::id2::...}} - true if ANY of the prompts are enabled
 */
const enabledAnyMacro: MacroDefinition = {
  name: 'enabled_any',
  description: 'True if ANY of the named prompts are enabled.',
  category: 'preset',
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length === 0) {
      return { value: 'false', success: true };
    }
    const any = args.some(id => isPromptEnabled(context, id));
    return { value: any ? 'true' : 'false', success: true };
  },
};

/**
 * {{enabled_all::id1::id2::...}} - true if ALL of the prompts are enabled
 */
const enabledAllMacro: MacroDefinition = {
  name: 'enabled_all',
  description: 'True if ALL of the named prompts are enabled.',
  category: 'preset',
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length === 0) {
      return { value: 'false', success: true };
    }
    const all = args.every(id => isPromptEnabled(context, id));
    return { value: all ? 'true' : 'false', success: true };
  },
};

/**
 * {{enabled_count::prefix}} - number of enabled prompts matching prefix/roster
 */
const enabledCountMacro: MacroDefinition = {
  name: 'enabled_count',
  description: 'Number of enabled prompts whose id starts with prefix (or whose roster matches).',
  args: [{ name: 'prefix', description: 'Id prefix or roster name', required: true }],
  category: 'preset',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const selector = args[0];
    if (!selector) {
      return { value: '0', success: true };
    }
    return { value: String(enabledMatching(context, selector).length), success: true };
  },
};

/**
 * {{enabled_list::prefix}} - list of enabled prompt identifiers
 * {{enabled_list::prefix::field}} - list of a metadata field from each
 */
const enabledListMacro: MacroDefinition = {
  name: 'enabled_list',
  description: 'List enabled prompts matching prefix/roster. Optional ::field pulls a metadata field.',
  args: [
    { name: 'prefix', description: 'Id prefix or roster name', required: true },
    { name: 'field', description: 'Metadata field to pull (optional)', required: false },
  ],
  category: 'preset',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const selector = args[0];
    if (!selector) {
      return { value: '', success: false, error: 'Prefix or roster name required' };
    }
    const matched = enabledMatching(context, selector);

    if (args[1]) {
      const field = args[1];
      const values = matched
        .map(p => promptField(p, field))
        .filter((v): v is MacroVariableValue => v !== undefined);
      return { value: formatList(values), success: true };
    }

    return { value: formatList(matched.map(p => p.identifier)), success: true };
  },
};

/**
 * {{join_enabled::prefix::field::sep}} - the roster one-liner.
 * Joined field values of all enabled matching prompts, separator BETWEEN
 * items only.
 */
const joinEnabledMacro: MacroDefinition = {
  name: 'join_enabled',
  description: 'Join a metadata field of all enabled prompts matching prefix/roster. {{join_enabled::hp_cw_::label::, }}',
  args: [
    { name: 'prefix', description: 'Id prefix or roster name', required: true },
    { name: 'field', description: 'Metadata field (use "identifier" for ids)', required: false },
    { name: 'sep', description: 'Separator (default ", ")', required: false },
  ],
  category: 'preset',
  // Lazy so the separator keeps its whitespace (eager args are trimmed:
  // ", " would become ",").
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const selector = args[0]?.evaluate().trim() ?? '';
    if (!selector) {
      return { value: '', success: false, error: 'Prefix or roster name required' };
    }
    const field = args[1]?.evaluate().trim() || 'identifier';
    const sep = args.length > 2 ? args[2].evaluate() : ', ';

    const values = enabledMatching(context, selector)
      .map(p => promptField(p, field))
      .filter((v): v is MacroVariableValue => v !== undefined)
      .map(listItemToString)
      .filter(s => s.length > 0);

    return { value: values.join(sep), success: true };
  },
  handler: (args: string[], context: MacroContext): MacroResult => {
    // Eager fallback (direct getMacroHandler callers): trimmed separator.
    const selector = args[0] ?? '';
    const field = args[1] || 'identifier';
    const sep = args[2] ?? ', ';
    const values = enabledMatching(context, selector)
      .map(p => promptField(p, field))
      .filter((v): v is MacroVariableValue => v !== undefined)
      .map(listItemToString)
      .filter(s => s.length > 0);
    return { value: values.join(sep), success: true };
  },
};

/**
 * {{when_enabled::prompt_id::content}} - render content only when the
 * prompt is enabled. Lazy: a skipped branch never runs (no side effects).
 */
const whenEnabledMacro: MacroDefinition = {
  name: 'when_enabled',
  description: 'Render content only if the named prompt is enabled.',
  args: [
    { name: 'prompt_id', description: 'Prompt identifier', required: true },
    { name: 'content', description: 'Content to render when enabled', required: true },
  ],
  category: 'preset',
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const id = args[0]?.evaluate().trim() ?? '';
    if (!id) {
      return { value: '', success: false, error: 'Prompt id required' };
    }
    if (!isPromptEnabled(context, id)) {
      return { value: '', success: true };
    }
    // Join remaining raw parts back: content may itself contain `::`.
    const content = args.slice(1).map(a => a.raw).join('::');
    return { value: content, success: true };
  },
  handler: (args: string[], context: MacroContext): MacroResult => {
    const id = args[0] ?? '';
    if (!id || !isPromptEnabled(context, id)) {
      return { value: '', success: true };
    }
    return { value: args.slice(1).join('::'), success: true };
  },
};

/**
 * Register all preset-introspection macros
 */
export function registerPresetIntrospectionMacros(): void {
  registerMacros([
    enabledMacro,
    enabledAnyMacro,
    enabledAllMacro,
    enabledCountMacro,
    enabledListMacro,
    joinEnabledMacro,
    whenEnabledMacro,
  ]);
}
