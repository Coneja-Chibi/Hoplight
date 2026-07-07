// ============================================================================
// OFF-BAND $ MACRO FALLBACKS (macro engine spec Part III.3)
//
// The async pre-pass (offband.ts) resolves top-level $ macros before the
// sync processor runs. These registry entries cover everything else:
// $ macros nested inside other macros' args, contexts with no executor
// (previews, display paths), and lint/registry awareness. Behavior is
// spend-nothing: keep an existing value, serve a cached answer, or
// render empty — never a literal {{pick$...}} leaking into a prompt.
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext } from '../types';
import { registerMacros } from '../registry';
import { parseOffbandAsk, cacheKeyFor, OFFBAND_CACHE_KEY } from '../offband';
import { resolveVar } from './variables';

function fallbackResolve(name: string, args: string[], context: MacroContext): MacroResult {
  const ask = parseOffbandAsk(name, args, `{{${name}}}`);
  if (!ask) {
    return { value: '', success: false, error: `${name} is missing required arguments` };
  }

  // Keep an existing value (pick_or_keep)
  if (ask.kind === 'pick_or_keep' && ask.varName) {
    const { vars, target } = resolveVar(ask.varName, context);
    const existing = vars.get(target.key)?.value;
    if (existing !== undefined && existing !== null && String(existing).trim() !== '') {
      return { value: String(existing), success: true };
    }
  }

  // Serve a cached answer
  if (!ask.forceFresh) {
    const raw = context.localVariables.get(OFFBAND_CACHE_KEY)?.value;
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
      const cached = (raw as Record<string, unknown>)[cacheKeyFor(ask)];
      if (typeof cached === 'string') {
        return { value: cached, success: true };
      }
    }
  }

  // No executor in sync context — render empty rather than leak the macro
  return { value: '', success: true };
}

// The `!` variants are separate registrations (not aliases): handlers
// can't see which alias invoked them, and {{pick$!}} must skip the cache.
function defineOffband(name: string, description: string): MacroDefinition[] {
  const make = (n: string): MacroDefinition => ({
    name: n,
    description,
    category: 'preset',
    volatile: true,
    handler: (args: string[], context: MacroContext): MacroResult =>
      fallbackResolve(n, args, context),
  });
  return [make(name), make(`${name}!`)];
}

export function registerOffbandMacros(): void {
  registerMacros([
    ...defineOffband('pick$', 'Off-band LLM pick: {{pick$::question::opt1::opt2}} — one API call; resolved during assembly.'),
    ...defineOffband('pick_or_keep$', 'Keep the variable if set, else off-band pick: {{pick_or_keep$::var::question::opts}}.'),
    ...defineOffband('pick_when$', 'Off-band pick only when the condition is true: {{pick_when$::condition::question::opts}}.'),
    ...defineOffband('ask_model$', 'Freeform off-band LLM answer: {{ask_model$::question}} — one API call.'),
    ...defineOffband('walkdown$', 'Multi-level off-band pick chain from YAML levels (spec III.3).'),
  ]);
}
