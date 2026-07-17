// ============================================================================
// STATE HOOKS & EVENT HANDLERS (macro engine spec Part I.4 / I.5 / I.6)
//
// LLM-emitted tags → typed state, declaratively — no regex → addvar chains,
// no cleanup pass. A preset declares hooks (regex triggers) and events
// (literal tag patterns with $name captures) under settings.macro_engine.
//
// This module is PURE: it matches text and computes mutations against
// in-memory variable maps. Config parsing lives in hooks-config.ts; in-reply
// capture lives in hooks-in-reply.ts. No network or database.
// ============================================================================

import type { MacroSideEffect } from './types';
import { applyAction } from './hooks-apply';
import {
  compileEventPattern,
  parseDslLine,
  substituteCaptures,
  type HookAction,
  type HookFiring,
  type HookRunResult,
  type HookRunVars,
  type MacroEngineConfig,
} from './hooks-config';
import { runInReplyCaptures } from './hooks-in-reply';

// Re-export the public surface so existing `from './hooks'` imports stay stable.
export type {
  HookActionType,
  HookAction,
  StateHook,
  MacroEvent,
  MacroEngineConfig,
  HookRunVars,
  HookFiring,
  HookRunResult,
} from './hooks-config';
export {
  parseMacroEngineConfig,
  compileEventPattern,
  parseDslLine,
  escapeRegExp,
  substituteCaptures,
} from './hooks-config';
export { IN_REPLY_ASKS_KEY, runInReplyCaptures, type InReplyAsk } from './hooks-in-reply';

/** Clean up the holes left by stripped tags. */
function tidyAfterStrip(text: string): string {
  return text
    .replace(/[ \t]+$/gm, '')      // trailing spaces left by inline strips
    .replace(/\n{3,}/g, '\n\n')    // collapse blank-line runs
    .replace(/^\s+/, '');          // leading whitespace at the very start
}

/**
 * Run declared events and hooks over a completed text. Mutates the
 * working maps in `vars`; returns the (possibly stripped) text plus the
 * ordered mutation list for persistence.
 */
export function runMacroHooks(
  text: string,
  config: MacroEngineConfig | null,
  vars: HookRunVars,
  opts: { placement?: 'ai_output' | 'user_input' } = {}
): HookRunResult {
  const placement = opts.placement ?? 'ai_output';
  const mutations: MacroSideEffect[] = [];
  const firings: HookFiring[] = [];
  let working = text;
  let anyStripped = false;

  if (config) {
    // Events first, in event_order then declaration order
    const orderedEvents = [...config.events].sort((a, b) => {
      const order = config.eventOrder ?? [];
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    for (const event of orderedEvents) {
      const regex = compileEventPattern(event.pattern);
      const dslLines = (Array.isArray(event.do) ? event.do : [event.do]);
      working = working.replace(regex, (...args) => {
        const match = args[0] as string;
        const groups = (typeof args[args.length - 1] === 'object' ? args[args.length - 1] : undefined) as
          Record<string, string> | undefined;
        const matchArray = Object.assign([match], { groups, index: 0, input: working }) as unknown as RegExpMatchArray;

        const fired: MacroSideEffect[] = [];
        for (const line of dslLines) {
          const action = parseDslLine(substituteCaptures(line, matchArray));
          if (!action) continue;
          const effect = applyAction(action, vars, `event:${event.id}`);
          if (effect) fired.push(effect);
        }
        mutations.push(...fired);
        firings.push({ id: event.id, kind: 'event', match, mutations: fired });

        if (event.strip !== false) {
          anyStripped = true;
          return '';
        }
        return match;
      });
    }

    // Hooks, declaration order
    for (const hook of config.hooks) {
      const hookPlacement = hook.placement ?? ['ai_output'];
      if (!hookPlacement.includes(placement)) continue;

      let regex: RegExp;
      try {
        const flags = hook.flags ?? 'gs';
        regex = new RegExp(hook.trigger, flags.includes('g') ? flags : flags + 'g');
      } catch {
        continue; // invalid author regex — skip, never crash the pipeline
      }
      const actions = Array.isArray(hook.action) ? hook.action : [hook.action];

      working = working.replace(regex, (...args) => {
        const match = args[0] as string;
        const numbered = args
          .slice(1, -2)
          .filter((a): a is string | undefined => typeof a === 'string' || a === undefined);
        const maybeGroups = args[args.length - 1];
        const groups = (typeof maybeGroups === 'object' && maybeGroups !== null ? maybeGroups : undefined) as
          Record<string, string> | undefined;
        const matchArray = Object.assign([match, ...numbered], { groups, index: 0, input: working }) as unknown as RegExpMatchArray;

        const fired: MacroSideEffect[] = [];
        for (const action of actions) {
          const resolved: HookAction = {
            type: action.type,
            key: substituteCaptures(action.key, matchArray),
            value: action.value === undefined ? undefined : substituteCaptures(action.value, matchArray),
          };
          const effect = applyAction(resolved, vars, `hook:${hook.id}`);
          if (effect) fired.push(effect);
        }
        mutations.push(...fired);
        firings.push({ id: hook.id, kind: 'hook', match, mutations: fired });

        if (hook.strip !== false) {
          anyStripped = true;
          return '';
        }
        return match;
      });
    }
  }

  // In-reply ask captures (only meaningful on AI output)
  if (placement === 'ai_output') {
    const inReply = runInReplyCaptures(working, vars);
    working = inReply.text;
    mutations.push(...inReply.mutations);
    firings.push(...inReply.firings);
    if (inReply.firings.length > 0) anyStripped = true;
  }

  return {
    text: anyStripped ? tidyAfterStrip(working) : working,
    mutations,
    firings,
  };
}
