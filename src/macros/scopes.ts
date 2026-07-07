// ============================================================================
// VARIABLE SCOPES
// Resolution of `scope:key` syntax ({{state.set::session:callsign::X}})
// onto the two existing storage maps (chat-local / global).
//
//   session    per-chat (default — bare keys are session keys)
//   character  per-chat, namespaced by character id
//   arc        per-chat, `_arc_` namespace (cleared by arc events — Phase 2)
//   scene      per-chat, `_scene_` namespace (cleared by scene events — Phase 2)
//   global     cross-chat (globalVariables)
//
// Only the prefixes below are treated as scopes; any other `foo:` stays a
// literal part of the variable name, so existing presets are unaffected.
// ============================================================================

import { MacroContext } from './types';

export type VariableScope = 'session' | 'character' | 'arc' | 'scene' | 'global';

const SCOPE_PREFIXES: Record<string, VariableScope> = {
  session: 'session',
  character: 'character',
  char: 'character',
  arc: 'arc',
  scene: 'scene',
  global: 'global',
};

/** Storage namespace prefixes for the per-chat ephemeral scopes. */
export const ARC_KEY_PREFIX = '_arc_';
export const SCENE_KEY_PREFIX = '_scene_';

export interface ResolvedVariableTarget {
  /** The scope the key resolved to */
  scope: VariableScope;
  /** Storage key inside the map (namespace prefix already applied) */
  key: string;
  /** Which storage map holds this variable */
  isGlobal: boolean;
}

/**
 * Resolve a (possibly scope-prefixed) variable key onto its storage map
 * and storage key. Bare keys default to session scope, matching today's
 * setvar/getvar behavior exactly (storage key unchanged).
 *
 * Only the character identity fields are read from the context, so
 * callers without a full MacroContext (the hook runner) can pass a shim.
 */
export function resolveVariableTarget(
  rawKey: string,
  context: Pick<MacroContext, 'characterId' | 'characterName'>
): ResolvedVariableTarget {
  const colonIdx = rawKey.indexOf(':');
  if (colonIdx > 0) {
    const prefix = rawKey.slice(0, colonIdx).trim().toLowerCase();
    const scope = SCOPE_PREFIXES[prefix];
    if (scope) {
      const rest = rawKey.slice(colonIdx + 1).trim();
      switch (scope) {
        case 'session':
          return { scope, key: rest, isGlobal: false };
        case 'character': {
          const charNs = context.characterId || context.characterName || 'unknown';
          return { scope, key: `_char_${charNs}_${rest}`, isGlobal: false };
        }
        case 'arc':
          return { scope, key: `${ARC_KEY_PREFIX}${rest}`, isGlobal: false };
        case 'scene':
          return { scope, key: `${SCENE_KEY_PREFIX}${rest}`, isGlobal: false };
        case 'global':
          return { scope, key: rest, isGlobal: true };
      }
    }
  }
  // No (recognized) scope prefix — session scope, key as-is
  return { scope: 'session', key: rawKey, isGlobal: false };
}

/** The variable map a resolved target lives in. */
export function mapForTarget(
  target: ResolvedVariableTarget,
  context: MacroContext
) {
  return target.isGlobal ? context.globalVariables : context.localVariables;
}

/** Side-effect type names for a resolved target. */
export function effectTypesForTarget(target: ResolvedVariableTarget): {
  set: 'setLocalVar' | 'setGlobalVar';
  del: 'deleteLocalVar' | 'deleteGlobalVar';
} {
  return target.isGlobal
    ? { set: 'setGlobalVar', del: 'deleteGlobalVar' }
    : { set: 'setLocalVar', del: 'deleteLocalVar' };
}
