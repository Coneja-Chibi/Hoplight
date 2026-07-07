// ============================================================================
// PHASE MACRO FALLBACKS (macro engine spec Part VIII)
//
// In preset prompts, {{phase}}/{{defer}}/{{after}} are extracted and
// orchestrated by processPhasedBlocks (phases.ts) BEFORE the processor
// ever sees them. These handlers exist for every other context — lorebook
// entries, chat messages, single-text expansion — where phased evaluation
// has no meaning: the body renders inline, in normal order. Registering
// them also keeps the linter and error reporting from treating phase
// syntax as unknown macros.
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext, LazyMacroArg } from '../types';
import { registerMacros } from '../registry';

function inlineBody(args: LazyMacroArg[], from: number): string {
  return args.slice(from).map(a => a.raw).join('::');
}

const phaseMacro: MacroDefinition = {
  name: 'phase',
  description: 'Run content in an evaluation phase (pre_render/render/post_render). Phased in preset prompts; renders inline elsewhere.',
  args: [
    { name: 'phase', description: 'pre_render | render | post_render', required: true },
    { name: 'content', description: 'Content for the phase', required: true },
  ],
  category: 'text',
  lazyHandler: (args: LazyMacroArg[], _context: MacroContext): MacroResult => {
    if (args.length < 2) {
      return { value: '', success: false, error: 'phase requires a phase name and content' };
    }
    return { value: inlineBody(args, 1), success: true };
  },
  handler: (args: string[], _context: MacroContext): MacroResult => {
    return { value: args.slice(1).join('::'), success: true };
  },
};

const deferMacro: MacroDefinition = {
  name: 'defer',
  description: 'Evaluate content at the end of the render pass (sees final state). Phased in preset prompts; renders inline elsewhere.',
  args: [{ name: 'content', description: 'Content to defer', required: true }],
  category: 'text',
  lazyHandler: (args: LazyMacroArg[], _context: MacroContext): MacroResult => {
    return { value: inlineBody(args, 0), success: true };
  },
  handler: (args: string[], _context: MacroContext): MacroResult => {
    return { value: args.join('::'), success: true };
  },
};

const afterMacro: MacroDefinition = {
  name: 'after',
  description: 'Evaluate content after the named prompt has rendered. Phased in preset prompts; renders inline elsewhere.',
  args: [
    { name: 'prompt_id', description: 'Prompt this content waits on', required: true },
    { name: 'content', description: 'Content to evaluate', required: true },
  ],
  category: 'text',
  lazyHandler: (args: LazyMacroArg[], _context: MacroContext): MacroResult => {
    if (args.length < 2) {
      return { value: '', success: false, error: 'after requires a prompt id and content' };
    }
    return { value: inlineBody(args, 1), success: true };
  },
  handler: (args: string[], _context: MacroContext): MacroResult => {
    return { value: args.slice(1).join('::'), success: true };
  },
};

export function registerPhaseMacros(): void {
  registerMacros([phaseMacro, deferMacro, afterMacro]);
}
