// ============================================================================
// STATE HOOKS & EVENT HANDLERS TESTS (macro engine spec Part I.4/I.5/I.6 + III.1)
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  parseMacroEngineConfig,
  compileEventPattern,
  parseDslLine,
  runMacroHooks,
  runInReplyCaptures,
  IN_REPLY_ASKS_KEY,
  type HookRunVars,
  type InReplyAsk,
} from './hooks';
import type { MacroVariableValue } from './types';

function makeVars(
  local: Record<string, MacroVariableValue> = {},
  global: Record<string, MacroVariableValue> = {}
): HookRunVars {
  return {
    local: new Map(Object.entries(local)),
    global: new Map(Object.entries(global)),
    characterId: 'char-1',
  };
}

// ============================================================================
// CONFIG PARSING
// ============================================================================

describe('parseMacroEngineConfig', () => {
  it('parses the object shape with events as a map', () => {
    const config = parseMacroEngineConfig({
      hooks: [
        { id: 'note', trigger: '\\[NOTE:\\s*(.+?)\\]', action: { type: 'push', key: 'character:notebook', value: '$1' } },
      ],
      events: {
        director_leave: { pattern: '[DIRECTOR-LEAVE]', do: ['unset session:callsign'] },
      },
      event_order: ['director_leave'],
    });
    expect(config).not.toBeNull();
    expect(config!.hooks).toHaveLength(1);
    expect(config!.events).toEqual([
      expect.objectContaining({ id: 'director_leave', pattern: '[DIRECTOR-LEAVE]' }),
    ]);
    expect(config!.eventOrder).toEqual(['director_leave']);
  });

  it('parses the same shape from a YAML string', () => {
    const config = parseMacroEngineConfig(`
events:
  phase_change:
    pattern: "[PHASE: $phase]"
    do:
      - set session:story_phase = $phase
      - set session:phase_turns_ago = 0
    strip: true
`);
    expect(config).not.toBeNull();
    expect(config!.events[0].id).toBe('phase_change');
    expect(config!.events[0].do).toHaveLength(2);
  });

  it('returns null for empty/garbage config', () => {
    expect(parseMacroEngineConfig(null)).toBeNull();
    expect(parseMacroEngineConfig({})).toBeNull();
    expect(parseMacroEngineConfig('not: real: yaml: [')).toBeNull();
    expect(parseMacroEngineConfig({ hooks: [{ id: 'x' }] })).toBeNull();
  });
});

// ============================================================================
// PATTERN & DSL
// ============================================================================

describe('compileEventPattern', () => {
  it('matches literal tags', () => {
    const re = compileEventPattern('[DIRECTOR-LEAVE]');
    expect('before [DIRECTOR-LEAVE] after'.match(re)![0]).toBe('[DIRECTOR-LEAVE]');
  });

  it('captures $name tokens with whitespace tolerance', () => {
    const re = compileEventPattern('[NEXT-DIRECTOR: $name]');
    const m = re.exec('text [NEXT-DIRECTOR:  HEARTTHROB ] more');
    expect(m?.groups?.name).toBe('HEARTTHROB');
  });
});

describe('parseDslLine', () => {
  it('parses set with value', () => {
    expect(parseDslLine('set session:x = hello world'))
      .toEqual({ type: 'set', key: 'session:x', value: 'hello world' });
  });

  it('parses state.-prefixed verbs and aliases', () => {
    expect(parseDslLine('state.unset session:callsign'))
      .toEqual({ type: 'unset', key: 'session:callsign', value: undefined });
    expect(parseDslLine('inc arc:current_beat')!.type).toBe('increment');
    expect(parseDslLine('state.delete session:x')!.type).toBe('unset');
  });

  it('rejects malformed lines', () => {
    expect(parseDslLine('frobnicate session:x')).toBeNull();
    expect(parseDslLine('')).toBeNull();
  });
});

// ============================================================================
// RUNNER — EVENTS
// ============================================================================

describe('runMacroHooks — events', () => {
  it('fires a multi-action event and strips the tag', () => {
    const config = parseMacroEngineConfig({
      events: {
        director_leave: {
          pattern: '[DIRECTOR-LEAVE]',
          do: ['unset session:callsign', 'unset session:active_genre', 'set session:pending = true'],
        },
      },
    })!;
    const vars = makeVars({ callsign: 'SCORIA', active_genre: 'Horror' });
    const result = runMacroHooks('Goodbye. [DIRECTOR-LEAVE]\n\nNext scene.', config, vars);

    expect(result.text).not.toContain('[DIRECTOR-LEAVE]');
    expect(vars.local.has('callsign')).toBe(false);
    expect(vars.local.has('active_genre')).toBe(false);
    expect(vars.local.get('pending')).toBe(true);
    expect(result.firings).toHaveLength(1);
    expect(result.firings[0]).toMatchObject({ id: 'director_leave', kind: 'event' });
    expect(result.mutations.every(m => m.cause === 'event:director_leave')).toBe(true);
  });

  it('substitutes $name captures into values and keys', () => {
    const config = parseMacroEngineConfig({
      events: {
        next_director: { pattern: '[NEXT-DIRECTOR: $name]', do: 'set session:pending_director = $name' },
        state_set: { pattern: '[STATE: $key | $value]', do: 'set session:ledger.$key = $value' },
      },
    })!;
    const vars = makeVars();
    runMacroHooks('[NEXT-DIRECTOR: HEARTTHROB] and [STATE: mood | tense]', config, vars);

    expect(vars.local.get('pending_director')).toBe('HEARTTHROB');
    // Nested keys via hooks land as dotted storage keys; the macro layer
    // reads them back via state.get's nested-path handling.
    expect(vars.local.get('ledger.mood')).toBe('tense');
  });

  it('respects event_order over declaration order', () => {
    const config = parseMacroEngineConfig({
      events: {
        second: { pattern: '[TAG]', do: 'append session:order = b', strip: false },
        first: { pattern: '[TAG]', do: 'append session:order = a', strip: false },
      },
      event_order: ['first', 'second'],
    })!;
    const vars = makeVars();
    runMacroHooks('[TAG]', config, vars);
    expect(vars.local.get('order')).toBe('ab');
  });

  it('fires once per occurrence', () => {
    const config = parseMacroEngineConfig({
      events: { beat: { pattern: '[NEXT-BEAT]', do: 'inc arc:current_beat' } },
    })!;
    const vars = makeVars();
    runMacroHooks('[NEXT-BEAT] middle [NEXT-BEAT]', config, vars);
    expect(vars.local.get('_arc_current_beat')).toBe(2);
  });
});

// ============================================================================
// RUNNER — HOOKS
// ============================================================================

describe('runMacroHooks — regex hooks', () => {
  it('pushes captures to an array variable and strips', () => {
    const config = parseMacroEngineConfig({
      hooks: [{
        id: 'notebook',
        trigger: '\\[DIRECTOR NOTE:\\s*(.+?)\\]',
        action: { type: 'push', key: 'character:notebook', value: '$1' },
      }],
    })!;
    const vars = makeVars();
    const result = runMacroHooks(
      'Story. [DIRECTOR NOTE: She lies.] More story. [DIRECTOR NOTE: Watch the door.]',
      config, vars
    );
    expect(result.text).not.toContain('DIRECTOR NOTE');
    expect(vars.local.get('_char_char-1_notebook')).toEqual(['She lies.', 'Watch the door.']);
  });

  it('skips hooks for other placements', () => {
    const config = parseMacroEngineConfig({
      hooks: [{
        id: 'input-only',
        trigger: '\\[CMD\\]',
        action: { type: 'set', key: 'session:cmd', value: 'yes' },
        placement: ['user_input'],
      }],
    })!;
    const vars = makeVars();
    const result = runMacroHooks('[CMD]', config, vars, { placement: 'ai_output' });
    expect(vars.local.has('cmd')).toBe(false);
    expect(result.text).toBe('[CMD]');
  });

  it('never crashes on an invalid author regex', () => {
    const config = parseMacroEngineConfig({
      hooks: [{ id: 'bad', trigger: '([unclosed', action: { type: 'set', key: 'session:x', value: '1' } }],
    })!;
    const vars = makeVars();
    expect(() => runMacroHooks('text', config, vars)).not.toThrow();
  });

  it('global variables route to the global map', () => {
    const config = parseMacroEngineConfig({
      events: { pref: { pattern: '[PREF: $v]', do: 'set global:theme = $v' } },
    })!;
    const vars = makeVars();
    const result = runMacroHooks('[PREF: dark]', config, vars);
    expect(vars.global.get('theme')).toBe('dark');
    expect(result.mutations[0].type).toBe('setGlobalVar');
  });
});

// ============================================================================
// IN-REPLY CAPTURE
// ============================================================================

describe('in-reply ask capture', () => {
  const asks: Record<string, InReplyAsk> = {
    CALLSIGN: { into: 'session:callsign', options: ['HEARTTHROB', 'SCORIA'], mode: 'pick' },
  };

  it('commits the answer, strips the tag, and clears the registry', () => {
    const vars = makeVars({ [IN_REPLY_ASKS_KEY]: asks as unknown as MacroVariableValue });
    const result = runInReplyCaptures(
      '[SET CALLSIGN: scoria]\nThe stage darkens.',
      vars
    );
    expect(vars.local.get('callsign')).toBe('SCORIA'); // canonicalized to option casing
    expect(result.text).not.toContain('SET CALLSIGN');
    expect(vars.local.has(IN_REPLY_ASKS_KEY)).toBe(false);
    expect(result.firings[0]).toMatchObject({ id: 'CALLSIGN', kind: 'in_reply' });
  });

  it('keeps unanswered asks pending', () => {
    const vars = makeVars({ [IN_REPLY_ASKS_KEY]: asks as unknown as MacroVariableValue });
    const result = runInReplyCaptures('No tag in this reply.', vars);
    expect(result.mutations).toHaveLength(0);
    expect(vars.local.has(IN_REPLY_ASKS_KEY)).toBe(true);
  });

  it('runs as part of runMacroHooks on ai_output with no preset config', () => {
    const vars = makeVars({
      [IN_REPLY_ASKS_KEY]: {
        MOOD: { into: 'session:mood', mode: 'ask' },
      } as unknown as MacroVariableValue,
    });
    const result = runMacroHooks('[SET MOOD: melancholy]\nRain.', null, vars);
    expect(vars.local.get('mood')).toBe('melancholy');
    expect(result.text.trim()).toBe('Rain.');
  });

  it('non-pick answers commit verbatim; scoped into works', () => {
    const vars = makeVars({
      [IN_REPLY_ASKS_KEY]: {
        NOTE: { into: 'character:last_note', mode: 'ask' },
      } as unknown as MacroVariableValue,
    });
    runInReplyCaptures('[SET NOTE: the door was open]', vars);
    expect(vars.local.get('_char_char-1_last_note')).toBe('the door was open');
  });
});

// ============================================================================
// STRIP TIDINESS
// ============================================================================

describe('strip tidiness', () => {
  it('collapses blank-line runs left by stripped tags', () => {
    const config = parseMacroEngineConfig({
      events: { a: { pattern: '[A]', do: 'set session:a = 1' } },
    })!;
    const vars = makeVars();
    const result = runMacroHooks('Line one.\n\n[A]\n\nLine two.', config, vars);
    expect(result.text).toBe('Line one.\n\nLine two.');
  });
});
