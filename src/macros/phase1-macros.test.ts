// ============================================================================
// MACRO ENGINE PHASE 1 TESTS
// Toggle introspection, iteration, scoped state, timing, conditional
// shortcuts, and the lazy-args engine groundwork.
// Spec: macro-engine-unified-spec.md (rev 2), Parts I, II, VI, VII.
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { processMacros, createDefaultContext } from './processor';
import { initializeMacros } from './index';
import { MacroContext, PresetPromptInfo, MacroVariable } from './types';
import { parseListArg, formatList } from './lists';
import { resolveVariableTarget } from './scopes';
import { classifyStorageKey } from './inspector';

beforeAll(() => {
  initializeMacros();
});

// ============================================================================
// HELPERS
// ============================================================================

function makeVar(value: MacroVariable['value']): MacroVariable {
  return { value, createdAt: new Date(), updatedAt: new Date() };
}

const DIRECTOR_PROMPTS: PresetPromptInfo[] = [
  {
    id: 'uuid-1', identifier: 'hp_dir_heartthrob', name: 'HEARTTHROB', enabled: true,
    metadata: { roster: 'director', callsign: 'HEARTTHROB', genre_label: 'Romance' },
  },
  {
    id: 'uuid-2', identifier: 'hp_dir_scoria', name: 'SCORIA', enabled: true,
    metadata: { roster: 'director', callsign: 'SCORIA', genre_label: 'Horror' },
  },
  {
    id: 'uuid-3', identifier: 'hp_dir_vice', name: 'VICE', enabled: false,
    metadata: { roster: 'director', callsign: 'VICE', genre_label: 'Crime' },
  },
  {
    id: 'uuid-4', identifier: 'hp_cw_body_horror', name: 'Body horror', enabled: true,
    metadata: { roster: 'cw', label: 'Body horror' },
  },
  { id: 'uuid-5', identifier: 'main', name: 'Main Prompt', enabled: true },
];

function ctx(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: 'TestChar',
    characterId: 'char-123',
    userName: 'TestUser',
    messages: [
      { role: 'user', content: 'Hello there!' },
      { role: 'assistant', content: 'Hi! How are you?' },
    ],
    messageCount: 2,
    presetPrompts: DIRECTOR_PROMPTS,
    ...overrides,
  });
}

// ============================================================================
// LISTS CONVENTION
// ============================================================================

describe('list value convention', () => {
  it('parses JSON arrays', () => {
    expect(parseListArg('["a","b","c"]')).toEqual(['a', 'b', 'c']);
    expect(parseListArg('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('parses bracket literals', () => {
    expect(parseListArg('[HEARTTHROB, LINGER, SCORIA]')).toEqual(['HEARTTHROB', 'LINGER', 'SCORIA']);
  });

  it('parses comma-separated text', () => {
    expect(parseListArg('a, b, c')).toEqual(['a', 'b', 'c']);
  });

  it('round-trips through formatList', () => {
    expect(parseListArg(formatList(['x', 'y']))).toEqual(['x', 'y']);
  });

  it('handles empty input', () => {
    expect(parseListArg('')).toEqual([]);
    expect(parseListArg('[]')).toEqual([]);
  });
});

// ============================================================================
// SCOPES
// ============================================================================

describe('variable scopes', () => {
  it('defaults bare keys to session scope, key unchanged', () => {
    const t = resolveVariableTarget('callsign', ctx());
    expect(t).toMatchObject({ scope: 'session', key: 'callsign', isGlobal: false });
  });

  it('strips the session: prefix', () => {
    const t = resolveVariableTarget('session:callsign', ctx());
    expect(t).toMatchObject({ scope: 'session', key: 'callsign', isGlobal: false });
  });

  it('namespaces character: by character id', () => {
    const t = resolveVariableTarget('character:notebook', ctx());
    expect(t).toMatchObject({ scope: 'character', key: '_char_char-123_notebook', isGlobal: false });
  });

  it('routes global: to the global map', () => {
    const t = resolveVariableTarget('global:theme', ctx());
    expect(t).toMatchObject({ scope: 'global', key: 'theme', isGlobal: true });
  });

  it('namespaces arc: and scene:', () => {
    expect(resolveVariableTarget('arc:current_beat', ctx()).key).toBe('_arc_current_beat');
    expect(resolveVariableTarget('scene:mood', ctx()).key).toBe('_scene_mood');
  });

  it('leaves unknown prefixes as literal key text', () => {
    const t = resolveVariableTarget('notascope:foo', ctx());
    expect(t).toMatchObject({ scope: 'session', key: 'notascope:foo' });
  });

  it('setvar/getvar agree across scope syntax', () => {
    const context = ctx();
    processMacros('{{setvar::session:foo::bar}}', context);
    expect(processMacros('{{getvar::foo}}', context).text).toBe('bar');
    expect(processMacros('{{getvar::session:foo}}', context).text).toBe('bar');
  });

  it('setvar with global: scope writes a global side effect', () => {
    const context = ctx();
    const result = processMacros('{{setvar::global:theme::dark}}', context);
    expect(result.sideEffects).toEqual([
      expect.objectContaining({ type: 'setGlobalVar', key: 'theme', value: 'dark' }),
    ]);
    expect(processMacros('{{getglobalvar::theme}}', context).text).toBe('dark');
  });
});

// ============================================================================
// STATE NAMESPACE
// ============================================================================

describe('state.* macros', () => {
  it('state.set renders empty and applies the value', () => {
    const context = ctx();
    const result = processMacros('{{state.set::session:callsign::HEARTTHROB}}', context);
    expect(result.text).toBe('');
    expect(context.localVariables.get('callsign')?.value).toBe('HEARTTHROB');
  });

  it('state.set supports nested dot-notation keys', () => {
    const context = ctx();
    processMacros('{{state.set::global:user_preferences.font::serif}}', context);
    expect(context.globalVariables.get('user_preferences')?.value).toEqual({ font: 'serif' });
  });

  it('state.unset deletes the variable', () => {
    const context = ctx({ localVariables: new Map([['callsign', makeVar('X')]]) });
    processMacros('{{state.unset::session:callsign}}', context);
    expect(context.localVariables.has('callsign')).toBe(false);
  });

  it('state.get reads scoped values', () => {
    const context = ctx({ localVariables: new Map([['callsign', makeVar('SCORIA')]]) });
    expect(processMacros('{{state.get::session:callsign}}', context).text).toBe('SCORIA');
  });

  it('state.show pretty-prints objects (yaml default, json on request)', () => {
    const context = ctx({
      localVariables: new Map([['ledger', makeVar({ phase: 'rising', beat: 2 })]]),
    });
    const yaml = processMacros('{{state.show::ledger}}', context).text;
    expect(yaml).toContain('phase: rising');
    expect(yaml).toContain('beat: 2');
    const json = processMacros('{{state.show::ledger::json}}', context).text;
    expect(JSON.parse(json)).toEqual({ phase: 'rising', beat: 2 });
  });

  it('mutations are no-ops in readOnly mode', () => {
    const context = ctx({ readOnly: true });
    processMacros('{{state.set::session:x::1}}', context);
    expect(context.localVariables.has('x')).toBe(false);
  });

  it('silent applies side effects but renders nothing', () => {
    const context = ctx();
    const result = processMacros(
      '{{silent::{{state.set::session:a::1}}{{state.set::session:b::2}}}}',
      context
    );
    expect(result.text).toBe('');
    expect(context.localVariables.get('a')?.value).toBe(1);
    expect(context.localVariables.get('b')?.value).toBe(2);
  });

  it('has / is_empty / notempty', () => {
    const context = ctx({
      localVariables: new Map([
        ['filled', makeVar('yes')],
        ['blank', makeVar('')],
        ['emptyList', makeVar([])],
      ]),
    });
    expect(processMacros('{{has::filled}}', context).text).toBe('true');
    expect(processMacros('{{has::blank}}', context).text).toBe('false');
    expect(processMacros('{{has::emptyList}}', context).text).toBe('false');
    expect(processMacros('{{has::missing}}', context).text).toBe('false');
    expect(processMacros('{{is_empty::blank}}', context).text).toBe('true');
    expect(processMacros('{{notempty::filled}}', context).text).toBe('true');
  });

  it('shiftvar removes and returns the first element', () => {
    const context = ctx({ localVariables: new Map([['queue', makeVar(['a', 'b', 'c'])]]) });
    expect(processMacros('{{shiftvar::queue}}', context).text).toBe('a');
    expect(context.localVariables.get('queue')?.value).toEqual(['b', 'c']);
  });
});

// ============================================================================
// TOGGLE INTROSPECTION
// ============================================================================

describe('toggle introspection', () => {
  it('{{enabled::id}} answers per effective state', () => {
    const context = ctx();
    expect(processMacros('{{enabled::hp_dir_heartthrob}}', context).text).toBe('true');
    expect(processMacros('{{enabled::hp_dir_vice}}', context).text).toBe('false');
    expect(processMacros('{{enabled::nonexistent}}', context).text).toBe('false');
  });

  it('{{enabled_any}} / {{enabled_all}}', () => {
    const context = ctx();
    expect(processMacros('{{enabled_any::hp_dir_vice::hp_dir_scoria}}', context).text).toBe('true');
    expect(processMacros('{{enabled_all::hp_dir_vice::hp_dir_scoria}}', context).text).toBe('false');
    expect(processMacros('{{enabled_all::hp_dir_heartthrob::hp_dir_scoria}}', context).text).toBe('true');
  });

  it('{{enabled_count::prefix}} counts enabled matches only', () => {
    const context = ctx();
    expect(processMacros('{{enabled_count::hp_dir_}}', context).text).toBe('2');
    expect(processMacros('{{enabled_count::hp_cw_}}', context).text).toBe('1');
  });

  it('{{enabled_list}} returns identifiers or metadata fields', () => {
    const context = ctx();
    expect(JSON.parse(processMacros('{{enabled_list::hp_dir_}}', context).text))
      .toEqual(['hp_dir_heartthrob', 'hp_dir_scoria']);
    expect(JSON.parse(processMacros('{{enabled_list::hp_dir_::callsign}}', context).text))
      .toEqual(['HEARTTHROB', 'SCORIA']);
  });

  it('matches by roster declaration, not just prefix', () => {
    const context = ctx();
    expect(processMacros('{{enabled_count::director}}', context).text).toBe('2');
    expect(JSON.parse(processMacros('{{enabled_list::director::callsign}}', context).text))
      .toEqual(['HEARTTHROB', 'SCORIA']);
  });

  it('{{join_enabled}} keeps separator whitespace, no dangling separator', () => {
    const context = ctx();
    expect(processMacros('{{join_enabled::hp_dir_::callsign::, }}', context).text)
      .toBe('HEARTTHROB, SCORIA');
  });

  it('{{when_enabled}} renders content only when enabled, lazily', () => {
    const context = ctx();
    expect(processMacros('{{when_enabled::hp_dir_heartthrob::Romance active}}', context).text)
      .toBe('Romance active');
    // Disabled branch: content (including side effects) must not run
    const result = processMacros(
      '{{when_enabled::hp_dir_vice::{{state.set::session:leak::oops}}}}',
      context
    );
    expect(result.text).toBe('');
    expect(context.localVariables.has('leak')).toBe(false);
  });

  it('returns empty/zero gracefully without preset context', () => {
    const context = ctx({ presetPrompts: undefined });
    expect(processMacros('{{enabled::anything}}', context).text).toBe('false');
    expect(processMacros('{{enabled_count::x}}', context).text).toBe('0');
    expect(processMacros('{{join_enabled::x::label::, }}', context).text).toBe('');
  });
});

// ============================================================================
// ITERATION
// ============================================================================

describe('iteration macros', () => {
  it('{{foreach}} iterates a literal list with $item', () => {
    const context = ctx();
    const result = processMacros('{{foreach::d in [A, B, C]::- $d}}', context);
    expect(result.text).toBe('- A\n- B\n- C');
  });

  it('{{foreach}} over {{enabled_list}} resolves prompt metadata fields', () => {
    const context = ctx();
    const result = processMacros(
      '{{foreach::d in {{enabled_list::director}}::- $d.callsign ($d.genre_label)}}',
      context
    );
    expect(result.text).toBe('- HEARTTHROB (Romance)\n- SCORIA (Horror)');
  });

  it('{{foreach_enabled}} iterates prompts directly', () => {
    const context = ctx();
    const result = processMacros(
      '{{foreach_enabled::director::* $prompt.callsign}}',
      context
    );
    expect(result.text).toBe('* HEARTTHROB\n* SCORIA');
  });

  it('{{filter}} returns the filtered list without content', () => {
    const context = ctx();
    const result = processMacros(
      '{{filter::{{enabled_list::director::callsign}}::$c != HEARTTHROB}}',
      context
    );
    expect(JSON.parse(result.text)).toEqual(['SCORIA']);
  });

  it('{{filter}} renders content per matching item', () => {
    const context = ctx();
    const result = processMacros(
      '{{filter::{{enabled_list::director}}::$d.genre_label == Horror::- $d.callsign}}',
      context
    );
    expect(result.text).toBe('- SCORIA');
  });

  it('{{count}} works on lists and array variables', () => {
    const context = ctx({ localVariables: new Map([['pool', makeVar(['x', 'y', 'z'])]]) });
    expect(processMacros('{{count::[a, b]}}', context).text).toBe('2');
    expect(processMacros('{{count::pool}}', context).text).toBe('3');
    expect(processMacros('{{count::{{enabled_list::director}}}}', context).text).toBe('2');
  });

  it('{{sep}} keeps separator whitespace and skips empties', () => {
    const context = ctx();
    expect(processMacros('{{sep::, ::alpha::beta::gamma}}', context).text).toBe('alpha, beta, gamma');
    expect(processMacros('{{sep:: | ::a::::c}}', context).text).toBe('a | c');
  });

  it('{{join}} list-aware form joins parsed lists; legacy form unchanged', () => {
    const context = ctx();
    expect(processMacros('{{join::["a","b","c"]::-}}', context).text).toBe('a-b-c');
    expect(processMacros('{{join::-::x::y}}', context).text).toBe('x-y');
  });

  it('{{raw}} preserves whitespace', () => {
    const context = ctx();
    expect(processMacros('A{{raw:: spaced }}B', context).text).toBe('A spaced B');
  });

  it('nested macros in foreach bodies expand per item', () => {
    const context = ctx();
    const result = processMacros(
      '{{foreach::x in [a, b]::{{upper::$x}}}}',
      context
    );
    expect(result.text).toBe('A\nB');
  });
});

// ============================================================================
// TIMING
// ============================================================================

describe('timing macros', () => {
  const turn1Messages = [{ role: 'user' as const, content: 'hi' }];
  const turn3Messages = [
    { role: 'user' as const, content: '1' },
    { role: 'assistant' as const, content: 'r1' },
    { role: 'user' as const, content: '2' },
    { role: 'assistant' as const, content: 'r2' },
    { role: 'user' as const, content: '3' },
  ];

  it('{{first_turn}} renders only on turn 1', () => {
    expect(processMacros('{{first_turn::Welcome!}}', ctx({ messages: turn1Messages })).text).toBe('Welcome!');
    expect(processMacros('{{first_turn::Welcome!}}', ctx({ messages: turn3Messages })).text).toBe('');
    // Greeting-only chat (no user messages yet) counts as turn 1
    expect(processMacros('{{first_turn::Welcome!}}', ctx({ messages: [] })).text).toBe('Welcome!');
  });

  it('skipped {{first_turn}} content fires no side effects', () => {
    const context = ctx({ messages: turn3Messages });
    processMacros('{{first_turn::{{state.set::session:boot::yes}}}}', context);
    expect(context.localVariables.has('boot')).toBe(false);
  });

  it('{{every::N}} renders on divisible turns', () => {
    expect(processMacros('{{every::3::tick}}', ctx({ messages: turn3Messages })).text).toBe('tick');
    expect(processMacros('{{every::2::tick}}', ctx({ messages: turn3Messages })).text).toBe('');
  });

  it('{{after_turn}} / {{before_turn}}', () => {
    expect(processMacros('{{after_turn::3::late}}', ctx({ messages: turn3Messages })).text).toBe('late');
    expect(processMacros('{{after_turn::4::late}}', ctx({ messages: turn3Messages })).text).toBe('');
    expect(processMacros('{{before_turn::4::early}}', ctx({ messages: turn3Messages })).text).toBe('early');
    expect(processMacros('{{before_turn::3::early}}', ctx({ messages: turn3Messages })).text).toBe('');
  });

  it('{{once::id}} fires once and records state', () => {
    const context = ctx();
    expect(processMacros('{{once::boot::Booted}}', context).text).toBe('Booted');
    // The hidden state var now records the firing; second render skips
    expect(processMacros('{{once::boot::Booted}}', context).text).toBe('');
    expect(processMacros('{{once::other::Other}}', context).text).toBe('Other');
  });
});

// ============================================================================
// CONDITIONAL SHORTCUTS
// ============================================================================

describe('conditional shortcuts', () => {
  it('{{when_all}} requires every condition', () => {
    const context = ctx({ localVariables: new Map([['x', makeVar(5)]]) });
    expect(processMacros('{{when_all::{{getvar::x}} >= 3::true::yes}}', context).text).toBe('yes');
    expect(processMacros('{{when_all::{{getvar::x}} >= 9::true::yes}}', context).text).toBe('');
  });

  it('{{when_any}} requires one condition', () => {
    const context = ctx();
    expect(processMacros('{{when_any::false::true::yes}}', context).text).toBe('yes');
    expect(processMacros('{{when_any::false::0::yes}}', context).text).toBe('');
  });

  it('{{whenempty}} renders when the variable is empty', () => {
    const context = ctx({ localVariables: new Map([['filled', makeVar('v')]]) });
    expect(processMacros('{{whenempty::missing::fallback}}', context).text).toBe('fallback');
    expect(processMacros('{{whenempty::filled::fallback}}', context).text).toBe('');
  });

  it('{{ifset}} renders with $var substitution', () => {
    const context = ctx({ localVariables: new Map([['callsign', makeVar('SCORIA')]]) });
    expect(processMacros('{{ifset::callsign::Director: $var}}', context).text).toBe('Director: SCORIA');
    expect(processMacros('{{ifset::callsign::Director: $callsign}}', context).text).toBe('Director: SCORIA');
    expect(processMacros('{{ifset::missing::Director: $var}}', context).text).toBe('');
  });

  it('{{either}} is a readable ternary', () => {
    const context = ctx();
    expect(processMacros('{{either::true::day::night}}', context).text).toBe('day');
    expect(processMacros('{{either::::day::night}}', context).text).toBe('night');
  });

  it('skipped branches fire no side effects', () => {
    const context = ctx();
    processMacros('{{whenempty::{{noop}}x-not-a-var-but-filled::content}}', context);
    processMacros('{{when_all::false::{{state.set::session:leak2::x}}}}', context);
    expect(context.localVariables.has('leak2')).toBe(false);
  });
});

// ============================================================================
// DEBUG TRACE (state inspector plumbing)
// ============================================================================

describe('side-effect cause attribution', () => {
  it('annotates side effects with the causing macro name', () => {
    const context = ctx();
    const result = processMacros(
      '{{state.set::session:a::1}}{{incvar::counter}}{{delvar::a}}',
      context
    );
    expect(result.sideEffects.map(fx => fx.cause)).toEqual(['state.set', 'incvar', 'delvar']);
  });

  it('annotates effects fired inside lazy bodies', () => {
    const context = ctx();
    const result = processMacros(
      '{{silent::{{state.set::session:x::5}}}}',
      context
    );
    const setEffect = result.sideEffects.find(fx => fx.key === 'x');
    expect(setEffect?.cause).toBe('state.set');
  });

  it('annotates block setvar', () => {
    const context = ctx();
    const result = processMacros('{{setvar::note}}hello{{/setvar}}', context);
    expect(result.sideEffects[0]).toMatchObject({ key: 'note', cause: 'setvar' });
  });
});

describe('inspector key classification', () => {
  it('classifies plain keys as session', () => {
    expect(classifyStorageKey('callsign')).toEqual({ scope: 'session', displayKey: 'callsign' });
  });

  it('classifies namespace prefixes back to scopes', () => {
    expect(classifyStorageKey('_char_char-123_notebook'))
      .toEqual({ scope: 'character', displayKey: 'notebook', characterNs: 'char-123' });
    expect(classifyStorageKey('_arc_current_beat'))
      .toEqual({ scope: 'arc', displayKey: 'current_beat' });
    expect(classifyStorageKey('_scene_mood'))
      .toEqual({ scope: 'scene', displayKey: 'mood' });
  });

  it('classifies engine bookkeeping as internal', () => {
    expect(classifyStorageKey('__once_fired').scope).toBe('internal');
  });

  it('round-trips with the scope resolver storage keys', () => {
    const context = ctx();
    const stored = resolveVariableTarget('character:notebook', context);
    const classified = classifyStorageKey(stored.key);
    expect(classified.scope).toBe('character');
    expect(classified.displayKey).toBe('notebook');
  });
});

// ============================================================================
// BACKWARD COMPATIBILITY GUARDRAILS
// ============================================================================

describe('backward compatibility', () => {
  it('legacy macros keep their return values', () => {
    const context = ctx();
    expect(processMacros('{{incvar::counter}}', context).text).toBe('1');
    expect(processMacros('{{pushvar::arr::a}}', context).text).toBe('1');
    expect(processMacros('{{popvar::arr}}', context).text).toBe('a');
  });

  it('plain setvar/getvar still work with bare keys', () => {
    const context = ctx();
    processMacros('{{setvar::mood::tense}}', context);
    expect(processMacros('{{getvar::mood}}', context).text).toBe('tense');
  });

  it('{{empty}} stays a noop alias', () => {
    const context = ctx();
    expect(processMacros('a{{empty}}b', context).text).toBe('ab');
  });

  it('block if/else still works', () => {
    const context = ctx({ localVariables: new Map([['flag', makeVar('yes')]]) });
    expect(processMacros('{{if .flag}}on{{else}}off{{/if}}', context).text).toBe('on');
  });
});
