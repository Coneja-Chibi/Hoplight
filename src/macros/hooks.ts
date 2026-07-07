// ============================================================================
// STATE HOOKS & EVENT HANDLERS (macro engine spec Part I.4 / I.5 / I.6)
//
// LLM-emitted tags → typed state, declaratively — no regex → addvar chains,
// no cleanup pass. A preset declares hooks (regex triggers) and events
// (literal tag patterns with $name captures) under settings.macro_engine:
//
//   {
//     "hooks": [
//       { "id": "director-notebook",
//         "trigger": "\\[DIRECTOR NOTE:\\s*(.+?)\\]",
//         "action": { "type": "push", "key": "character:notebook", "value": "$1" },
//         "strip": true }
//     ],
//     "events": {
//       "director_leave": {
//         "pattern": "[DIRECTOR-LEAVE]",
//         "do": ["unset session:callsign", "unset session:active_genre"],
//         "strip": true },
//       "next_director": {
//         "pattern": "[NEXT-DIRECTOR: $name]",
//         "do": "set session:pending_director = $name",
//         "strip": true }
//     },
//     "event_order": ["director_leave", "next_director"]
//   }
//
// The same shape is accepted as a YAML string (settings.macro_engine_yaml).
//
// This module is PURE: it parses config, matches text, and computes
// mutations against in-memory variable maps. Persistence and pipeline
// placement live in hooks-server.ts. In-reply ask capture (Part III.1)
// also runs here, consuming the __in_reply_asks registry variable.
// ============================================================================

import yaml from 'js-yaml';
import { MacroSideEffect, MacroVariableValue, MacroContext } from './types';
import { resolveVariableTarget } from './scopes';
import { parseValue } from './handlers/variables';

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
// Run types
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

function escapeRegExp(s: string): string {
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
function substituteCaptures(
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

// -----------------------------------------------------------------------------
// Mutation application
// -----------------------------------------------------------------------------

/**
 * Apply one action against the working maps. Returns the side effect, or
 * null when the action is a no-op (e.g. pop on a missing array).
 */
function applyAction(
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

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// In-reply ask capture (spec Part III.1)
// -----------------------------------------------------------------------------

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
