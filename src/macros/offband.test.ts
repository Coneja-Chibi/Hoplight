// ============================================================================
// OFF-BAND $ MACRO TESTS (macro engine spec Part III.3/III.4)
// ============================================================================

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { processMacros, createDefaultContext } from './processor';
import { initializeMacros } from './index';
import { MacroContext, MacroVariable } from './types';
import {
  resolveOffbandAsks,
  containsOffbandMacros,
  extractOffbandAsks,
  canonicalizePick,
  cacheKeyFor,
  parseOffbandAsk,
  OFFBAND_CACHE_KEY,
  type OffbandExecutor,
} from './offband';

beforeAll(() => {
  initializeMacros();
});

function makeVar(value: MacroVariable['value']): MacroVariable {
  return { value, createdAt: new Date(), updatedAt: new Date() };
}

function ctx(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: 'TestChar',
    characterId: 'char-1',
    userName: 'TestUser',
    messages: [{ role: 'user', content: 'hi' }],
    messageCount: 1,
    ...overrides,
  });
}

/** Executor returning canned answers, recording every call. */
function fakeExecutor(answers: string[] | ((prompt: string) => string)) {
  const calls: Array<{ prompt: string; maxTokens: number; purpose: string }> = [];
  let i = 0;
  const executor: OffbandExecutor = async (req) => {
    calls.push(req);
    return typeof answers === 'function' ? answers(req.prompt) : answers[Math.min(i++, answers.length - 1)];
  };
  return { executor, calls };
}

// ============================================================================
// DETECTION & PARSING
// ============================================================================

describe('detection and parsing', () => {
  it('containsOffbandMacros detects the family, including ! variants', () => {
    expect(containsOffbandMacros('{{pick$::Q::A::B}}')).toBe(true);
    expect(containsOffbandMacros('{{pick$!::Q::A::B}}')).toBe(true);
    expect(containsOffbandMacros('{{ask_model$::Q}}')).toBe(true);
    expect(containsOffbandMacros('{{pick::Q::A}}')).toBe(false); // local pick, no $
    expect(containsOffbandMacros('plain text')).toBe(false);
  });

  it('extracts top-level asks with positions; named into= parsed out', () => {
    const [first] = extractOffbandAsks('before {{pick$::Q::A::B::into=session:x}} after');
    expect(first.ask).toMatchObject({
      kind: 'pick', question: 'Q', options: ['A', 'B'], into: 'session:x', forceFresh: false,
    });
  });

  it('parses every kind per the spec signatures', () => {
    expect(parseOffbandAsk('pick_or_keep$', ['myvar', 'Q', 'A', 'B'], '')).toMatchObject({
      kind: 'pick_or_keep', varName: 'myvar', question: 'Q', options: ['A', 'B'],
    });
    expect(parseOffbandAsk('pick_when$', ['true', 'Q', 'A'], '')).toMatchObject({
      kind: 'pick_when', condition: 'true',
    });
    expect(parseOffbandAsk('pick$!', ['Q', 'A'], '')).toMatchObject({ forceFresh: true });
    expect(parseOffbandAsk('pick$', ['only-question'], '')).toBeNull();
  });
});

describe('canonicalizePick', () => {
  it('matches options case-insensitively and through chatter', () => {
    expect(canonicalizePick('scoria', ['HEARTTHROB', 'SCORIA'])).toBe('SCORIA');
    expect(canonicalizePick('I choose SCORIA.', ['HEARTTHROB', 'SCORIA'])).toBe('SCORIA');
    expect(canonicalizePick('"HEARTTHROB"', ['HEARTTHROB', 'SCORIA'])).toBe('HEARTTHROB');
  });

  it('falls back to the trimmed first line for non-matches', () => {
    expect(canonicalizePick('Something else\nmore', ['A', 'B'])).toBe('Something else');
  });
});

// ============================================================================
// RESOLUTION
// ============================================================================

describe('resolveOffbandAsks', () => {
  it('substitutes the answer inline and commits into=', async () => {
    const context = ctx();
    const { executor, calls } = fakeExecutor(['SCORIA']);
    const result = await resolveOffbandAsks(
      [{ id: 'b0', text: 'Director: {{pick$::Pick one.::HEARTTHROB::SCORIA::into=session:callsign}}!' }],
      context, executor
    );
    expect(result.get('b0')).toBe('Director: SCORIA!');
    expect(context.localVariables.get('callsign')?.value).toBe('SCORIA');
    expect(calls).toHaveLength(1);
    expect(calls[0].prompt).toContain('- HEARTTHROB');
  });

  it('caches by signature: same ask twice = one call (spec III.4)', async () => {
    const context = ctx();
    const { executor, calls } = fakeExecutor(['SCORIA']);
    const blocks = [
      { id: 'a', text: '{{pick$::Pick.::A::SCORIA}}' },
      { id: 'b', text: '{{pick$::Pick.::A::SCORIA}}' },
    ];
    const result = await resolveOffbandAsks(blocks, context, executor);
    expect(calls).toHaveLength(1);
    expect(result.get('a')).toBe('SCORIA');
    expect(result.get('b')).toBe('SCORIA');
    // cache landed in the context variable the assembler persists
    const cache = context.localVariables.get(OFFBAND_CACHE_KEY)?.value as Record<string, string>;
    expect(Object.values(cache)).toContain('SCORIA');
  });

  it('! forces a re-ask past the cache', async () => {
    const context = ctx();
    const ask = parseOffbandAsk('pick$', ['Pick.', 'A', 'B'], '')!;
    context.localVariables.set(OFFBAND_CACHE_KEY, makeVar({ [cacheKeyFor(ask)]: 'A' }));

    const { executor, calls } = fakeExecutor(['B']);
    const result = await resolveOffbandAsks([{ id: 'x', text: '{{pick$!::Pick.::A::B}}' }], context, executor);
    expect(calls).toHaveLength(1);
    expect(result.get('x')).toBe('B');
  });

  it('pick_or_keep keeps an existing value without calling', async () => {
    const context = ctx({ localVariables: new Map([['callsign', makeVar('VICE')]]) });
    const { executor, calls } = fakeExecutor(['SCORIA']);
    const result = await resolveOffbandAsks(
      [{ id: 'x', text: '{{pick_or_keep$::callsign::Pick.::A::B}}' }],
      context, executor
    );
    expect(result.get('x')).toBe('VICE');
    expect(calls).toHaveLength(0);
  });

  it('pick_when gates on the (macro-expanded) condition', async () => {
    const context = ctx({ localVariables: new Map([['stuck_turns', makeVar(5)]]) });
    const { executor, calls } = fakeExecutor(['B']);

    const skipped = await resolveOffbandAsks(
      [{ id: 'x', text: '{{pick_when$::{{getvar::stuck_turns}} > 9::Switch?::A::B}}' }],
      context, executor
    );
    expect(skipped.get('x')).toBe('');
    expect(calls).toHaveLength(0);

    const fired = await resolveOffbandAsks(
      [{ id: 'y', text: '{{pick_when$::{{getvar::stuck_turns}} > 3::Switch?::A::B}}' }],
      context, executor
    );
    expect(fired.get('y')).toBe('B');
    expect(calls).toHaveLength(1);
  });

  it('macros inside questions and options expand before the call', async () => {
    const context = ctx({ localVariables: new Map([['genre', makeVar('Horror')]]) });
    const { executor, calls } = fakeExecutor(['A']);
    await resolveOffbandAsks(
      [{ id: 'x', text: '{{pick$::Pick a {{getvar::genre}} Director.::A::B}}' }],
      context, executor
    );
    expect(calls[0].prompt).toContain('Pick a Horror Director.');
  });

  it('walkdown chains constrained picks and commits the final answer', async () => {
    const context = ctx();
    const { executor, calls } = fakeExecutor((prompt) =>
      prompt.includes('HORROR') && prompt.includes('ROMANCE') ? 'HORROR' : 'SCORIA'
    );
    const yamlSpec = [
      'level1:',
      '  label: Genre cluster',
      '  options: [HORROR, ROMANCE]',
      'level2:',
      '  label: Director',
      '  options_from: level1',
      '  HORROR: [SCORIA, LINGER]',
      '  ROMANCE: [HEARTTHROB]',
      'commit:',
      '  set: session:callsign',
    ].join('\n');
    const result = await resolveOffbandAsks(
      [{ id: 'x', text: `{{walkdown$::${yamlSpec}}}` }],
      context, executor
    );
    expect(calls).toHaveLength(2);
    expect(result.get('x')).toBe('SCORIA');
    expect(context.localVariables.get('callsign')?.value).toBe('SCORIA');
  });

  it('without an executor: cached answers serve, otherwise empty', async () => {
    const context = ctx();
    const ask = parseOffbandAsk('pick$', ['Pick.', 'A', 'B'], '')!;
    context.localVariables.set(OFFBAND_CACHE_KEY, makeVar({ [cacheKeyFor(ask)]: 'A' }));

    const result = await resolveOffbandAsks(
      [{ id: 'x', text: 'cached: {{pick$::Pick.::A::B}} fresh: {{ask_model$::Other?}}' }],
      context, undefined
    );
    expect(result.get('x')).toBe('cached: A fresh: ');
  });

  it('an executor failure never breaks the block — substitutes empty', async () => {
    const context = ctx();
    const executor: OffbandExecutor = async () => { throw new Error('provider down'); };
    const result = await resolveOffbandAsks(
      [{ id: 'x', text: 'a {{ask_model$::Q}} b' }],
      context, executor
    );
    expect(result.get('x')).toBe('a  b');
  });
});

// ============================================================================
// SYNC FALLBACK HANDLERS
// ============================================================================

describe('sync fallback handlers', () => {
  it('$ macros are known to the registry and render spend-nothing', () => {
    const context = ctx({ localVariables: new Map([['callsign', makeVar('VICE')]]) });
    expect(processMacros('{{pick_or_keep$::callsign::Q::A::B}}', context).text).toBe('VICE');
    const empty = processMacros('{{pick$::Q::A::B}}', context);
    expect(empty.text).toBe('');
    expect(empty.errors).toHaveLength(0);
  });

  it('serves the shared cache; ! variant skips it', () => {
    const context = ctx();
    const ask = parseOffbandAsk('pick$', ['Q', 'A', 'B'], '')!;
    context.localVariables.set(OFFBAND_CACHE_KEY, makeVar({ [cacheKeyFor(ask)]: 'A' }));
    expect(processMacros('{{pick$::Q::A::B}}', context).text).toBe('A');
    expect(processMacros('{{pick$!::Q::A::B}}', context).text).toBe('');
  });
});
