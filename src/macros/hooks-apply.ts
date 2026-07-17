// ============================================================================
// HOOK MUTATION APPLICATION
//
// Apply one HookAction against working local/global maps. Shared by the
// macro hook runner and in-reply ask capture.
// ============================================================================

import type { MacroSideEffect, MacroVariableValue } from './types';
import { resolveVariableTarget } from './scopes';
import { parseValue } from './handlers/variables';
import type { HookAction, HookRunVars } from './hooks-config';

/**
 * Apply one action against the working maps. Returns the side effect, or
 * null when the action is a no-op (e.g. pop on a missing array).
 */
export function applyAction(
  action: HookAction,
  vars: HookRunVars,
  cause: string
): MacroSideEffect | null {
  const target = resolveVariableTarget(action.key, {
    characterId: vars.characterId,
    characterName: vars.characterName ?? '',
  });
  const map = target.isGlobal ? vars.global : vars.local;
  const setType = target.isGlobal ? 'setGlobalVar' as const : 'setLocalVar' as const;
  const delType = target.isGlobal ? 'deleteGlobalVar' as const : 'deleteLocalVar' as const;
  const current = map.get(target.key);

  let effect: MacroSideEffect | null = null;

  switch (action.type) {
    case 'set':
      effect = { type: setType, key: target.key, value: parseValue(action.value ?? ''), cause };
      break;
    case 'unset':
      if (!map.has(target.key)) return null;
      effect = { type: delType, key: target.key, cause };
      break;
    case 'push': {
      const arr = Array.isArray(current) ? [...current] : [];
      arr.push(parseValue(action.value ?? ''));
      effect = { type: setType, key: target.key, value: arr, cause };
      break;
    }
    case 'pop': {
      if (!Array.isArray(current) || current.length === 0) return null;
      effect = { type: setType, key: target.key, value: current.slice(0, -1), cause };
      break;
    }
    case 'shift': {
      if (!Array.isArray(current) || current.length === 0) return null;
      effect = { type: setType, key: target.key, value: current.slice(1), cause };
      break;
    }
    case 'append': {
      const base = typeof current === 'string' ? current : (current != null ? String(current) : '');
      effect = { type: setType, key: target.key, value: base + (action.value ?? ''), cause };
      break;
    }
    case 'increment':
    case 'decrement': {
      const step = action.value !== undefined && !isNaN(parseFloat(action.value))
        ? Math.abs(parseFloat(action.value))
        : 1;
      const base = typeof current === 'number' ? current : 0;
      const next = action.type === 'increment' ? base + step : base - step;
      effect = { type: setType, key: target.key, value: next, cause };
      break;
    }
  }

  if (!effect) return null;

  // Update the working map so later actions in the same run compose
  if (effect.type === delType) {
    map.delete(effect.key);
  } else {
    map.set(effect.key, effect.value as MacroVariableValue);
  }

  return effect;
}
