// ============================================================================
// IN-REPLY ASK CAPTURE (spec Part III.1)
//
// Consume pending __in_reply_asks registry entries against [SET TAG: answer]
// lines in AI output. Extracted from hooks.ts.
// ============================================================================

import type { MacroSideEffect, MacroVariableValue } from './types';
import { applyAction } from './hooks-apply';
import { escapeRegExp, type HookAction, type HookFiring, type HookRunResult, type HookRunVars } from './hooks-config';

/** Registry variable the in-reply macros write and this runner consumes. */
export const IN_REPLY_ASKS_KEY = '__in_reply_asks';

export interface InReplyAsk {
  /** scope:key the answer commits to */
  into: string;
  /** Options for pick-mode asks */
  options?: string[];
  mode: 'pick' | 'ask';
  /** Keep the tag visible in the reply instead of stripping */
  visible?: boolean;
}

function readAsks(vars: HookRunVars): Record<string, InReplyAsk> {
  const raw = vars.local.get(IN_REPLY_ASKS_KEY);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  return raw as unknown as Record<string, InReplyAsk>;
}

/**
 * Consume pending in-reply asks: find their `[SET <TAG>: answer]` lines in
 * the reply, commit answers to the target variables, strip the tags, and
 * remove the answered asks from the registry.
 */
export function runInReplyCaptures(
  text: string,
  vars: HookRunVars
): HookRunResult {
  const asks = readAsks(vars);
  const tags = Object.keys(asks);
  if (tags.length === 0) {
    return { text, mutations: [], firings: [] };
  }

  const mutations: MacroSideEffect[] = [];
  const firings: HookFiring[] = [];
  let working = text;
  const remaining: Record<string, InReplyAsk> = { ...asks };
  let consumedAny = false;

  for (const tag of tags) {
    const ask = asks[tag];
    if (!ask || typeof ask.into !== 'string') {
      delete remaining[tag];
      consumedAny = true;
      continue;
    }
    const regex = new RegExp(`\\[SET\\s+${escapeRegExp(tag)}\\s*:\\s*([^\\[\\]\\n]+?)\\s*\\]`, 'i');
    const match = regex.exec(working);
    if (!match) continue; // not answered this reply — ask stays pending

    let answer = match[1].trim();
    if (ask.mode === 'pick' && Array.isArray(ask.options) && ask.options.length > 0) {
      const canonical = ask.options.find(o => o.toLowerCase() === answer.toLowerCase());
      if (canonical) answer = canonical;
    }

    const action: HookAction = { type: 'set', key: ask.into, value: answer };
    const effect = applyAction(action, vars, `in_reply:${tag}`);
    const fired = effect ? [effect] : [];
    mutations.push(...fired);
    firings.push({ id: tag, kind: 'in_reply', match: match[0], mutations: fired });

    if (!ask.visible) {
      working = working.replace(regex, '');
    }
    delete remaining[tag];
    consumedAny = true;
  }

  if (consumedAny) {
    const effect: MacroSideEffect = Object.keys(remaining).length > 0
      ? { type: 'setLocalVar', key: IN_REPLY_ASKS_KEY, value: remaining as unknown as MacroVariableValue, cause: 'in_reply' }
      : { type: 'deleteLocalVar', key: IN_REPLY_ASKS_KEY, cause: 'in_reply' };
    if (effect.type === 'deleteLocalVar') {
      vars.local.delete(IN_REPLY_ASKS_KEY);
    } else {
      vars.local.set(IN_REPLY_ASKS_KEY, effect.value as MacroVariableValue);
    }
    mutations.push(effect);
  }

  return { text: working, mutations, firings };
}
