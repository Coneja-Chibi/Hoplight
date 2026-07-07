// ============================================================================
// ITERATION & LIST MACROS
//
//   {{foreach::item in <list>::content}}    iterate, $item / $item.field inside
//   {{foreach_enabled::prefix::content}}    iterate enabled prompts, $prompt.field
//   {{filter::<list>::condition}}           filtered list (JSON)
//   {{filter::<list>::condition::content}}  render content per matching item
//   {{count::<list-or-var>}}                length
//   {{sep::sep::a::b::c}}                   separator BETWEEN items, no dangling
//   {{raw::content}}                        whitespace-preserving render
//
// <list> accepts a JSON array (what {{enabled_list}} returns), a literal
// [A, B, C], or comma-separated text — see lists.ts.
//
// When a list item is a preset prompt identifier, $item.field resolves the
// field from that prompt's metadata, so
// {{foreach::d in {{enabled_list::director}}::- $d.callsign}} works without
// the list having to carry whole objects.
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext, MacroVariableValue, LazyMacroArg, PresetPromptInfo } from '../types';
import { registerMacros } from '../registry';
import { evaluateConditionExpression } from '../processor';
import { parseListArg, formatList, listItemToString } from '../lists';
import { getNestedValue, valueToString, resolveVar } from './variables';
import { promptField } from './preset-introspection';

// -----------------------------------------------------------------------------
// Substitution helpers
// -----------------------------------------------------------------------------

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Find a preset prompt by identifier (for field access on string items). */
function promptByIdentifier(context: MacroContext, identifier: string): PresetPromptInfo | undefined {
  const id = identifier.trim().toLowerCase();
  return context.presetPrompts?.find(p => p.identifier?.toLowerCase() === id || p.id.toLowerCase() === id);
}

/** Resolve `$name.path` for an item: object field, or preset prompt metadata. */
function itemFieldValue(
  item: MacroVariableValue,
  path: string,
  context: MacroContext
): MacroVariableValue | undefined {
  if (item !== null && typeof item === 'object') {
    return getNestedValue(item, path);
  }
  if (typeof item === 'string') {
    const prompt = promptByIdentifier(context, item);
    if (prompt) return promptField(prompt, path);
  }
  return undefined;
}

/**
 * Substitute `$name` / `$name.field` tokens in a template with the item.
 * When `varName` is given only that name matches; otherwise any
 * `$identifier` token is treated as the item variable (filter-style).
 */
function substituteItem(
  template: string,
  varName: string | null,
  item: MacroVariableValue,
  context: MacroContext
): string {
  const namePattern = varName ? escapeRegExp(varName) : '[A-Za-z_][\\w]*';
  const re = new RegExp(`\\$(${namePattern})(?:\\.([\\w.]+))?`, 'g');
  return template.replace(re, (_m, _name: string, path?: string) => {
    if (!path) return listItemToString(item);
    const v = itemFieldValue(item, path, context);
    return v === undefined || v === null ? '' : valueToString(v);
  });
}

/** Join the remaining lazy args back into one body (content may contain ::). */
function bodyFromArgs(args: LazyMacroArg[], from: number): string {
  return args.slice(from).map(a => a.raw).join('::');
}

// -----------------------------------------------------------------------------
// foreach / foreach_enabled / filter
// -----------------------------------------------------------------------------

const FOREACH_HEAD_RE = /^\s*\$?([A-Za-z_][\w]*)\s+in\s+([\s\S]+)$/;

/**
 * {{foreach::item in <list>::content}} - render content once per item.
 * Items render joined by newline; nested macros in content expand per item.
 */
const foreachMacro: MacroDefinition = {
  name: 'foreach',
  aliases: ['for_each'],
  description: 'Iterate a list: {{foreach::d in {{enabled_list::director}}::- $d.callsign}}',
  args: [
    { name: 'head', description: '"name in <list>"', required: true },
    { name: 'content', description: 'Per-item content ($name / $name.field)', required: true },
  ],
  category: 'text',
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    if (args.length < 2) {
      return { value: '', success: false, error: 'foreach requires "name in <list>" and content' };
    }
    const head = args[0].evaluate().trim();
    const headMatch = FOREACH_HEAD_RE.exec(head);
    if (!headMatch) {
      return { value: '', success: false, error: 'foreach head must be "name in <list>"' };
    }
    const [, varName, listExpr] = headMatch;
    const items = parseListArg(listExpr);
    const body = bodyFromArgs(args, 1);

    const rendered = items.map(item => substituteItem(body, varName, item, context));
    return { value: rendered.join('\n'), success: true };
  },
  handler: (args: string[], context: MacroContext): MacroResult => {
    // Eager fallback: body already expanded once, $item substitution still works
    if (args.length < 2) {
      return { value: '', success: false, error: 'foreach requires "name in <list>" and content' };
    }
    const headMatch = FOREACH_HEAD_RE.exec(args[0]);
    if (!headMatch) {
      return { value: '', success: false, error: 'foreach head must be "name in <list>"' };
    }
    const [, varName, listExpr] = headMatch;
    const items = parseListArg(listExpr);
    const body = args.slice(1).join('::');
    return { value: items.map(item => substituteItem(body, varName, item, context)).join('\n'), success: true };
  },
};

/**
 * {{foreach_enabled::prefix::content}} - iterate enabled prompts matching
 * prefix/roster; $prompt and $prompt.field accessible inside.
 */
const foreachEnabledMacro: MacroDefinition = {
  name: 'foreach_enabled',
  description: 'Iterate enabled prompts: {{foreach_enabled::hp_dir_::- $prompt.callsign}}',
  args: [
    { name: 'prefix', description: 'Id prefix or roster name', required: true },
    { name: 'content', description: 'Per-prompt content ($prompt.field)', required: true },
  ],
  category: 'preset',
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    if (args.length < 2) {
      return { value: '', success: false, error: 'foreach_enabled requires prefix and content' };
    }
    const selector = args[0].evaluate().trim();
    const body = bodyFromArgs(args, 1);
    const prompts = (context.presetPrompts ?? []).filter(
      p => p.enabled && selectorMatches(p, selector)
    );

    const rendered = prompts.map(p =>
      body.replace(/\$([A-Za-z_][\w]*)(?:\.([\w.]+))?/g, (_m, _name: string, path?: string) => {
        if (!path) return p.identifier;
        const v = promptField(p, path);
        return v === undefined || v === null ? '' : valueToString(v);
      })
    );
    return { value: rendered.join('\n'), success: true };
  },
  handler: (_args: string[], _context: MacroContext): MacroResult => {
    return { value: '', success: false, error: 'foreach_enabled requires lazy evaluation' };
  },
};

/** Same selector semantics as the enabled_* family. */
function selectorMatches(prompt: PresetPromptInfo, selector: string): boolean {
  const sel = selector.trim().toLowerCase();
  if (!sel) return false;
  const identifier = prompt.identifier?.toLowerCase() ?? '';
  if (identifier === sel || identifier.startsWith(sel)) return true;
  const roster = prompt.metadata?.roster;
  return typeof roster === 'string' && roster.trim().toLowerCase() === sel;
}

/**
 * {{filter::<list>::condition}} - JSON list of matching items.
 * {{filter::<list>::condition::content}} - render content per matching item.
 * Any `$name` / `$name.field` token in the condition stands for the item.
 */
const filterMacro: MacroDefinition = {
  name: 'filter',
  description: 'Filter a list: {{filter::{{enabled_list::hp_dir_}}::$d.cluster == HORROR::- $d.callsign}}',
  args: [
    { name: 'list', description: 'List to filter', required: true },
    { name: 'condition', description: 'Condition, $item stands for each item', required: true },
    { name: 'content', description: 'Per-item content (optional; default returns the list)', required: false },
  ],
  category: 'text',
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    if (args.length < 2) {
      return { value: '', success: false, error: 'filter requires a list and a condition' };
    }
    const items = parseListArg(args[0].evaluate());
    const conditionTemplate = args[1].evaluate();

    const matching = items.filter(item =>
      evaluateConditionExpression(substituteItem(conditionTemplate, null, item, context))
    );

    if (args.length < 3) {
      return { value: formatList(matching), success: true };
    }
    const body = bodyFromArgs(args, 2);
    return {
      value: matching.map(item => substituteItem(body, null, item, context)).join('\n'),
      success: true,
    };
  },
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length < 2) {
      return { value: '', success: false, error: 'filter requires a list and a condition' };
    }
    const items = parseListArg(args[0]);
    const matching = items.filter(item =>
      evaluateConditionExpression(substituteItem(args[1], null, item, context))
    );
    if (args.length < 3) {
      return { value: formatList(matching), success: true };
    }
    const body = args.slice(2).join('::');
    return { value: matching.map(item => substituteItem(body, null, item, context)).join('\n'), success: true };
  },
};

// -----------------------------------------------------------------------------
// count / sep / raw
// -----------------------------------------------------------------------------

/**
 * {{count::<list>}} or {{count::varname}} - item count.
 */
const countMacro: MacroDefinition = {
  name: 'count',
  description: 'Count items in a list or array variable.',
  args: [{ name: 'list', description: 'List literal/JSON, or variable name', required: true }],
  category: 'text',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const arg = (args[0] ?? '').trim();
    if (!arg) {
      return { value: '0', success: true };
    }

    if (arg.startsWith('[')) {
      return { value: String(parseListArg(arg).length), success: true };
    }

    // Variable name (scope-aware): array length / object key count
    const { vars, target } = resolveVar(arg, context);
    const value = vars.get(target.key)?.value;
    if (Array.isArray(value)) return { value: String(value.length), success: true };
    if (value !== null && typeof value === 'object') {
      return { value: String(Object.keys(value).length), success: true };
    }
    return { value: '0', success: true };
  },
};

/**
 * {{sep::sep::a::b::c}} - items with separator BETWEEN only. Empty items
 * are skipped, so there is never a dangling separator. Lazy so the
 * separator's whitespace survives (eager args are trimmed).
 */
const sepMacro: MacroDefinition = {
  name: 'sep',
  description: 'Join items with a separator between them only: {{sep::, ::a::b::c}}',
  args: [
    { name: 'sep', description: 'Separator (whitespace preserved)', required: true },
    { name: 'items', description: 'Items (empty ones skipped)', required: true },
  ],
  category: 'text',
  lazyHandler: (args: LazyMacroArg[], _context: MacroContext): MacroResult => {
    if (args.length < 2) {
      return { value: '', success: true };
    }
    const sep = args[0].evaluate();
    const items = args.slice(1).map(a => a.evaluate().trim()).filter(s => s.length > 0);
    return { value: items.join(sep), success: true };
  },
  handler: (args: string[], _context: MacroContext): MacroResult => {
    if (args.length < 2) {
      return { value: '', success: true };
    }
    const [sep, ...items] = args;
    return { value: items.filter(s => s.length > 0).join(sep), success: true };
  },
};

/**
 * {{raw::content}} - render content with whitespace preserved (the eager
 * path trims every evaluated argument; raw is the opt-out).
 */
const rawMacro: MacroDefinition = {
  name: 'raw',
  description: 'Render content with leading/trailing whitespace preserved.',
  args: [{ name: 'content', description: 'Content to render as-is', required: true }],
  category: 'text',
  lazyHandler: (args: LazyMacroArg[], _context: MacroContext): MacroResult => {
    return { value: args.map(a => a.evaluate()).join('::'), success: true };
  },
  handler: (args: string[], _context: MacroContext): MacroResult => {
    return { value: args.join('::'), success: true };
  },
};

/**
 * Register all iteration macros
 */
export function registerIterationMacros(): void {
  registerMacros([
    foreachMacro,
    foreachEnabledMacro,
    filterMacro,
    countMacro,
    sepMacro,
    rawMacro,
  ]);
}
