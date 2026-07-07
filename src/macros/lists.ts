// ============================================================================
// LIST VALUE CONVENTION
// Macros pass lists between each other as JSON-array strings
// ({{enabled_list}} returns one, {{foreach}}/{{join}}/{{count}} accept one).
// Authors can also write literal `[A, B, C]` lists or plain comma-separated
// text; parseListArg accepts all three.
// ============================================================================

import { MacroVariableValue } from './types';

/**
 * Parse a macro argument into a list of items.
 *
 * Accepted forms, in order:
 *  1. JSON array string: `["a","b"]` or `[1, 2]` (what list-returning
 *     macros emit via formatList)
 *  2. Bracket literal: `[HEARTTHROB, LINGER, SCORIA]` — items split on
 *     commas, trimmed
 *  3. Comma-separated text: `a, b, c`
 *
 * Empty / whitespace-only input → empty list.
 */
export function parseListArg(arg: string): MacroVariableValue[] {
  const trimmed = arg.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Bracket literal, not JSON — split inner content on commas
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    }
  }

  return trimmed.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Format a list for return from a macro, so downstream list-consuming
 * macros can parse it losslessly.
 */
export function formatList(items: MacroVariableValue[]): string {
  return JSON.stringify(items);
}

/** Render a single list item as display text. */
export function listItemToString(item: MacroVariableValue): string {
  if (item === null || item === undefined) return '';
  if (typeof item === 'object') return JSON.stringify(item);
  return String(item);
}
