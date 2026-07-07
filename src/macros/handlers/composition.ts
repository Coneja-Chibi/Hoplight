// ============================================================================
// COMPOSITION & TEMPLATE MACROS (macro engine spec Part V.1 / V.2)
//
//   {{template::name::body}}        define a reusable parameterized chunk
//   {{use_template::name::params}}  instantiate with "key: value" lines
//   {{include::prompt_id}}          inline another prompt's content
//   {{partial::name::content}}      alias for template (no params needed)
//   {{block::name::default}}        slot with default content
//   {{override::name::content}}     replace a block's default
//
// Templates and overrides are per-assembly: defined in one prompt, usable
// in any LATER prompt of the same render pass (registry order). Until
// Part VIII phases land, an {{override}} must evaluate before the
// {{block}} it overrides — same constraint authors already live with for
// setvar ordering. {{include}} only references prompts in the same preset
// (spec XI.2 — no file access).
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext, LazyMacroArg } from '../types';
import { registerMacros } from '../registry';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function bodyFromArgs(args: LazyMacroArg[], from: number): string {
  return args.slice(from).map(a => a.raw).join('::');
}

/** Parse "key: value" lines from a use_template params body. */
function parseParams(paramsText: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const line of paramsText.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) params[key] = value;
  }
  return params;
}

/** Substitute $key tokens with params; unknown tokens stay literal. */
function substituteParams(body: string, params: Record<string, string>): string {
  return body.replace(/\$([A-Za-z_][\w]*)/g, (token, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? params[name] : token
  );
}

// -----------------------------------------------------------------------------
// template / use_template / partial
// -----------------------------------------------------------------------------

/**
 * {{template::name::body}} - define a template. Body is stored RAW
 * (macros inside expand at use time, with $params already substituted).
 * Renders empty.
 */
const templateMacro: MacroDefinition = {
  name: 'template',
  aliases: ['partial'],
  description: 'Define a reusable template: {{template::director_register::{{state.set::session:callsign::$callsign}}}}',
  args: [
    { name: 'name', description: 'Template name', required: true },
    { name: 'body', description: 'Template body ($param placeholders)', required: true },
  ],
  category: 'text',
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const name = args[0]?.evaluate().trim().toLowerCase() ?? '';
    if (!name) {
      return { value: '', success: false, error: 'Template name required' };
    }
    if (args.length < 2) {
      return { value: '', success: false, error: 'Template body required' };
    }
    if (!context.templates) {
      return { value: '', success: false, error: 'Templates not available in this context' };
    }
    context.templates.set(name, bodyFromArgs(args, 1));
    return { value: '', success: true };
  },
  handler: (_args: string[], _context: MacroContext): MacroResult => {
    return { value: '', success: false, error: 'template requires lazy evaluation' };
  },
};

/**
 * {{use_template::name::key: value⏎key2: value2}} - instantiate a template.
 * Param values may contain macros (they are evaluated before substitution).
 */
const useTemplateMacro: MacroDefinition = {
  name: 'use_template',
  aliases: ['use'],
  description: 'Instantiate a template with "key: value" lines: {{use_template::director_register::callsign: HEARTTHROB}}',
  args: [
    { name: 'name', description: 'Template name', required: true },
    { name: 'params', description: '"key: value" lines (one per line)', required: false },
  ],
  category: 'text',
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const name = args[0]?.evaluate().trim().toLowerCase() ?? '';
    if (!name) {
      return { value: '', success: false, error: 'Template name required' };
    }
    const body = context.templates?.get(name);
    if (body === undefined) {
      return { value: '', success: false, error: `Unknown template "${name}" — define it with {{template::${name}::...}} earlier in the preset` };
    }
    // Params are evaluated (macros inside values expand), then substituted
    const paramsText = args.slice(1).map(a => a.evaluate()).join('::');
    const params = parseParams(paramsText);
    return { value: substituteParams(body, params), success: true };
  },
  handler: (_args: string[], _context: MacroContext): MacroResult => {
    return { value: '', success: false, error: 'use_template requires lazy evaluation' };
  },
};

// -----------------------------------------------------------------------------
// include
// -----------------------------------------------------------------------------

/**
 * {{include::prompt_id}} - inline another prompt's content. Only prompts
 * of the active preset are reachable; nested macros expand here, in the
 * including prompt's position. Includes count toward the including
 * prompt's token budget at render.
 */
const includeMacro: MacroDefinition = {
  name: 'include',
  description: "Inline another preset prompt's content: {{include::hp_cot_standard}}",
  args: [{ name: 'prompt_id', description: 'Prompt identifier', required: true }],
  category: 'preset',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const id = (args[0] ?? '').trim().toLowerCase();
    if (!id) {
      return { value: '', success: false, error: 'Prompt id required' };
    }
    const prompt = context.presetPrompts?.find(
      p => p.identifier?.toLowerCase() === id || p.id.toLowerCase() === id
    );
    if (!prompt) {
      return { value: '', success: false, error: `Unknown prompt "${args[0]}"` };
    }
    return { value: prompt.content ?? '', success: true };
  },
};

// -----------------------------------------------------------------------------
// block / override
// -----------------------------------------------------------------------------

/**
 * {{block::name::default}} - a named slot. Renders the registered
 * override when one exists, the default otherwise. The untaken branch is
 * never evaluated (lazy).
 */
const blockMacro: MacroDefinition = {
  name: 'block',
  description: 'A named slot with default content; {{override}} replaces it: {{block::cot::standard CoT here}}',
  args: [
    { name: 'name', description: 'Block name', required: true },
    { name: 'default', description: 'Default content', required: false },
  ],
  category: 'text',
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const name = args[0]?.evaluate().trim().toLowerCase() ?? '';
    if (!name) {
      return { value: '', success: false, error: 'Block name required' };
    }
    const override = context.blockOverrides?.get(name);
    if (override !== undefined) {
      return { value: override, success: true };
    }
    return { value: bodyFromArgs(args, 1), success: true };
  },
  handler: (args: string[], context: MacroContext): MacroResult => {
    const name = (args[0] ?? '').trim().toLowerCase();
    if (!name) {
      return { value: '', success: false, error: 'Block name required' };
    }
    const override = context.blockOverrides?.get(name);
    return { value: override !== undefined ? override : args.slice(1).join('::'), success: true };
  },
};

/**
 * {{override::name::content}} - override a block. Must evaluate before
 * the {{block}} it targets (registry order) until phases land. Renders
 * empty.
 */
const overrideMacro: MacroDefinition = {
  name: 'override',
  description: 'Override a named block: {{override::cot::HEARTTHROB-flavored CoT}}. Must appear before the block.',
  args: [
    { name: 'name', description: 'Block name', required: true },
    { name: 'content', description: 'Replacement content', required: true },
  ],
  category: 'text',
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const name = args[0]?.evaluate().trim().toLowerCase() ?? '';
    if (!name) {
      return { value: '', success: false, error: 'Block name required' };
    }
    if (!context.blockOverrides) {
      return { value: '', success: false, error: 'Block overrides not available in this context' };
    }
    context.blockOverrides.set(name, bodyFromArgs(args, 1));
    return { value: '', success: true };
  },
  handler: (_args: string[], _context: MacroContext): MacroResult => {
    return { value: '', success: false, error: 'override requires lazy evaluation' };
  },
};

export function registerCompositionMacros(): void {
  registerMacros([
    templateMacro,
    useTemplateMacro,
    includeMacro,
    blockMacro,
    overrideMacro,
  ]);
}
