// ============================================================================
// STATE INSPECTOR HELPERS
// Classify raw storage keys back into author-facing scopes for display.
// Mirrors the storage conventions in scopes.ts: chat-local variables carry
// namespace prefixes (`_char_<ns>_`, `_arc_`, `_scene_`), engine-internal
// bookkeeping uses a double-underscore prefix (`__once_fired`), everything
// else is plain session state.
// ============================================================================

import { ARC_KEY_PREFIX, SCENE_KEY_PREFIX } from './scopes';

export type InspectorScope = 'session' | 'character' | 'arc' | 'scene' | 'global' | 'internal';

export interface ClassifiedKey {
  scope: InspectorScope;
  /** Author-facing key with the namespace prefix stripped */
  displayKey: string;
  /** Character namespace (id or name), when scope === 'character' */
  characterNs?: string;
}

const CHAR_KEY_RE = /^_char_(.+?)_(.+)$/;

/**
 * Classify a chat-local storage key into its display scope.
 * (Globals come from a different table and are classified by the caller.)
 */
export function classifyStorageKey(storageKey: string): ClassifiedKey {
  if (storageKey.startsWith('__')) {
    return { scope: 'internal', displayKey: storageKey };
  }

  const charMatch = CHAR_KEY_RE.exec(storageKey);
  if (charMatch) {
    return { scope: 'character', displayKey: charMatch[2], characterNs: charMatch[1] };
  }

  if (storageKey.startsWith(ARC_KEY_PREFIX)) {
    return { scope: 'arc', displayKey: storageKey.slice(ARC_KEY_PREFIX.length) };
  }

  if (storageKey.startsWith(SCENE_KEY_PREFIX)) {
    return { scope: 'scene', displayKey: storageKey.slice(SCENE_KEY_PREFIX.length) };
  }

  return { scope: 'session', displayKey: storageKey };
}

/** Pretty-print a variable value for the inspector detail view. */
export function formatInspectorValue(value: unknown): string {
  if (value === null || value === undefined) return '(null)';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/** One-line preview of a variable value for list rows. */
export function previewInspectorValue(value: unknown, maxLength = 60): string {
  const full = typeof value === 'object' && value !== null
    ? JSON.stringify(value)
    : String(value ?? '');
  return full.length > maxLength ? full.substring(0, maxLength) + '…' : full;
}
