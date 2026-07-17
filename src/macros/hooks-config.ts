// ============================================================================
// MACRO ENGINE CONFIG (parse + event patterns + DSL)
//
// Extracted from hooks.ts: pure config types and parsing for settings.macro_engine
// (object or YAML string). No mutation runner here.
// ============================================================================

import yaml from 'js-yaml';
import type { MacroSideEffect, MacroVariableValue } from './types';

// -----------------------------------------------------------------------------
// Config types
// -----------------------------------------------------------------------------

export type HookActionType =
  | 'set' | 'unset' | 'push' | 'pop' | 'shift'
  | 'append' | 'increment' | 'decrement';

export interface HookAction {
  type: HookActionType;
  /** scope:key — may reference captures ($1 / $name) */
  key: string;
  /** value — may reference captures ($1 / $name) */
  value?: string;
}

export interface StateHook {
  id: string;
  /** Regex source matched against the text */
  trigger: string;
  /** Regex flags (default "g"; "s" is added for multiline captures) */
  flags?: string;
  action: HookAction | HookAction[];
  /** Remove matched text (default true — tags are not prose) */
  strip?: boolean;
  /** Where the hook applies (default ["ai_output"]) */
  placement?: Array<'ai_output' | 'user_input'>;
}

export interface MacroEvent {
  id: string;
  /** Literal tag pattern, $name marks a capture: "[NEXT-DIRECTOR: $name]" */
  pattern: string;
  /** DSL lines: "set session:x = $name", "unset session:y", "increment arc:beat" */
  do: string | string[];
  strip?: boolean;
}

export interface MacroEngineConfig {
  hooks: StateHook[];
  events: MacroEvent[];
  eventOrder?: string[];
}

// -----------------------------------------------------------------------------
// Run types (shared by runner + in-reply)
// -----------------------------------------------------------------------------

/** Working variable state the runner reads and mutates in place. */
export interface HookRunVars {
  local: Map<string, MacroVariableValue>;
  global: Map<string, MacroVariableValue>;
  /** For character: scope resolution */
  characterId?: string;
  characterName?: string;
}

export interface HookFiring {
  /** hook id, event id, or in-reply tag */
  id: string;
  kind: 'hook' | 'event' | 'in_reply';
  /** The matched text */
  match: string;
  /** Mutations this firing produced */
  mutations: MacroSideEffect[];
}

export interface HookRunResult {
  /** Text with strip-enabled matches removed */
  text: string;
  /** All mutations, in firing order (working maps already updated) */
  mutations: MacroSideEffect[];
  firings: HookFiring[];
}

// -----------------------------------------------------------------------------
// Config parsing
// -----------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function normalizeActions(raw: unknown): HookAction[] {
  const list = Array.isArray(raw) ? raw : [raw];
  const actions: HookAction[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const type = String(item.type ?? '').toLowerCase() as HookActionType;
    const key = typeof item.key === 'string' ? item.key : undefined;
    if (!key) continue;
    if (!['set', 'unset', 'push', 'pop', 'shift', 'append', 'increment', 'decrement'].includes(type)) continue;
    actions.push({
      type,
      key,
      value: item.value === undefined ? undefined : String(item.value),
    });
  }
  return actions;
}

/**
 * Parse a preset's macro-engine config. Accepts the object shape, a YAML
 * string of the same shape, or null/undefined. Events may be declared as
 * an array (with id fields) or a map keyed by event id (the YAML-friendly
 * shape from the spec). Returns null when there is nothing usable.
 */
export function parseMacroEngineConfig(raw: unknown): MacroEngineConfig | null {
  let root: unknown = raw;

  if (typeof root === 'string') {
    try {
      root = yaml.load(root);
    } catch {
      return null;
    }
  }
  if (!isRecord(root)) return null;

  const hooks: StateHook[] = [];
  if (Array.isArray(root.hooks)) {
    for (const h of root.hooks) {
      if (!isRecord(h)) continue;
      const trigger = typeof h.trigger === 'string' ? h.trigger : undefined;
      const id = typeof h.id === 'string' ? h.id : undefined;
      if (!trigger || !id) continue;
      const actions = normalizeActions(h.action);
      if (actions.length === 0) continue;
      hooks.push({
        id,
        trigger,
        flags: typeof h.flags === 'string' ? h.flags : undefined,
        action: actions,
        strip: h.strip !== false,
        placement: Array.isArray(h.placement)
          ? (h.placement.filter(p => p === 'ai_output' || p === 'user_input') as StateHook['placement'])
          : undefined,
      });
    }
  }

  const events: MacroEvent[] = [];
  const rawEvents = root.events;
  if (Array.isArray(rawEvents)) {
    for (const e of rawEvents) {
      if (!isRecord(e) || typeof e.id !== 'string' || typeof e.pattern !== 'string') continue;
      if (typeof e.do !== 'string' && !Array.isArray(e.do)) continue;
      events.push({
        id: e.id,
        pattern: e.pattern,
        do: e.do as MacroEvent['do'],
        strip: e.strip !== false,
      });
    }
  } else if (isRecord(rawEvents)) {
    for (const [id, e] of Object.entries(rawEvents)) {
      if (!isRecord(e) || typeof e.pattern !== 'string') continue;
      if (typeof e.do !== 'string' && !Array.isArray(e.do)) continue;
      events.push({
        id,
        pattern: e.pattern,
        do: e.do as MacroEvent['do'],
        strip: e.strip !== false,
      });
    }
  }

  const eventOrder = Array.isArray(root.event_order)
    ? root.event_order.filter((x): x is string => typeof x === 'string')
    : undefined;

  if (hooks.length === 0 && events.length === 0) return null;
  return { hooks, events, eventOrder };
}

// -----------------------------------------------------------------------------
// Pattern compilation & capture substitution
// -----------------------------------------------------------------------------

/** Escape a string for safe inclusion in a RegExp source. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile an event's literal pattern into a regex. `$name` tokens become
 * named captures; literal whitespace tolerates repetition; whitespace
 * around captures is absorbed so "[PHASE: $phase]" matches "[PHASE:rising]"
 * and "[PHASE:  rising ]" alike.
 */
export function compileEventPattern(pattern: string): RegExp {
  const parts = pattern.split(/(\$[A-Za-z_][\w]*)/g);
  let source = '';
  for (const part of parts) {
    if (/^\$[A-Za-z_][\w]*$/.test(part)) {
      source += `\\s*(?<${part.slice(1)}>[^\\[\\]\\n]+?)\\s*`;
    } else if (part) {
      source += escapeRegExp(part).replace(/\s+/g, '\\s+');
    }
  }
  return new RegExp(source, 'g');
}

/** Substitute $1..$9 and $name capture references in a template string. */
export function substituteCaptures(
  template: string,
  match: RegExpMatchArray
): string {
  return template.replace(/\$([1-9]\d*|[A-Za-z_][\w]*)/g, (token, ref: string) => {
    if (/^\d+$/.test(ref)) {
      const v = match[parseInt(ref, 10)];
      return v === undefined ? token : v.trim();
    }
    const v = match.groups?.[ref];
    return v === undefined ? token : v.trim();
  });
}

// -----------------------------------------------------------------------------
// Event DSL parsing
// -----------------------------------------------------------------------------

const DSL_LINE_RE = /^(?:state\.)?(set|unset|delete|push|pop|shift|append|increment|inc|decrement|dec)\s+(\S+)(?:\s*=\s*(.+))?$/i;

const DSL_TYPE_MAP: Record<string, HookActionType> = {
  set: 'set', unset: 'unset', delete: 'unset',
  push: 'push', pop: 'pop', shift: 'shift', append: 'append',
  increment: 'increment', inc: 'increment',
  decrement: 'decrement', dec: 'decrement',
};

/** Parse one event DSL line into an action, or null if malformed. */
export function parseDslLine(line: string): HookAction | null {
  const m = DSL_LINE_RE.exec(line.trim());
  if (!m) return null;
  return {
    type: DSL_TYPE_MAP[m[1].toLowerCase()],
    key: m[2],
    value: m[3]?.trim(),
  };
}
