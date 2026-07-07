// ============================================================================
// MACRO PARSER GOLDEN-MASTER CHARACTERIZATION NET
// ============================================================================
// A behavioral safety net for the clean-room rewrite of the macro PARSING
// front-end (preprocessing + parseNodes + helpers). Every assertion here goes
// through the PUBLIC surface only:
//   - __parseForTest(input)            -> AST (structure)
//   - processMacros(input, ctx)        -> full result (behavior)
//
// We deliberately do NOT test internal helpers (findMatchingClose /
// splitMacroArgs / preprocessDotNotation / etc.). Those get DELETED by the
// rewrite; coupling the net to them would make the net lie. Inputs come from
// CORPUS; the snapshots pin CURRENT behavior so the rewrite cannot drift.
//
// Snapshots strip wall-clock timing (stats.processingTimeMs) so they stay
// deterministic. VOLATILE / random entries are NOT snapshotted exactly —
// instead we assert cacheable===false plus option-set membership.
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import {
  processMacros,
  createDefaultContext,
  __parseForTest,
} from '../processor';
import { initializeMacros } from '../index';
import { MacroContext, MacroProcessResult } from '../types';
import { CORPUS, CorpusEntry } from './corpus';

// ============================================================================
// SETUP
// ============================================================================

beforeAll(() => {
  // Idempotent — safe to call once per file. Evaluator/registry are the real
  // production registrations, so behavior matches the live engine.
  initializeMacros();
});

// Test context per the workflow spec: TestChar / TestUser, EMPTY variable
// maps, readOnly false. createDefaultContext already seeds empty Maps for
// localVariables/globalVariables/userMacros/counters/templates/blockOverrides.
function createTestContext(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: 'TestChar',
    userName: 'TestUser',
    messages: [],
    messageCount: 0,
    readOnly: false,
    ...overrides,
  });
}

// ============================================================================
// SNAPSHOT NORMALIZATION
// ============================================================================
// Project the full MacroProcessResult down to the deterministic, behaviorally
// meaningful shape the spec calls for. Drops timing; keeps everything else
// (including ordering of expansions/errors/sideEffects, which the rewrite must
// preserve). Cause is captured on every side effect.

interface NormalizedResult {
  text: string;
  expansions: Array<{
    original: string;
    expanded: string;
    macroName: string;
    depth: number;
  }>;
  errors: Array<{ macro: string; message: string }>;
  sideEffects: Array<{
    type: string;
    key: string;
    value: unknown;
    cause: string | undefined;
  }>;
  touchedVariables: string[];
  cacheable: boolean;
  stats: {
    totalMacros: number;
    successfulExpansions: number;
    failedExpansions: number;
    nestingDepthReached: number;
  };
}

function normalize(result: MacroProcessResult): NormalizedResult {
  return {
    text: result.text,
    expansions: result.expansions.map(e => ({
      original: e.original,
      expanded: e.expanded,
      macroName: e.macroName,
      depth: e.depth,
    })),
    errors: result.errors.map(e => ({ macro: e.macro, message: e.message })),
    sideEffects: result.sideEffects.map(fx => ({
      type: fx.type,
      key: fx.key,
      value: fx.value,
      cause: fx.cause,
    })),
    touchedVariables: result.touchedVariables,
    cacheable: result.cacheable,
    stats: {
      totalMacros: result.stats.totalMacros,
      successfulExpansions: result.stats.successfulExpansions,
      failedExpansions: result.stats.failedExpansions,
      nestingDepthReached: result.stats.nestingDepthReached,
    },
  };
}

function run(input: string, overrides?: Partial<MacroContext>): MacroProcessResult {
  return processMacros(input, createTestContext(overrides));
}

// IDs whose output is nondeterministic (random/time/roll family). These are
// exercised by the dedicated volatile suite below, which asserts
// cacheable===false + option-set membership instead of an exact snapshot.
// (Counter-style volatiles like rcounter ARE deterministic given a fresh
// context, so they get exact snapshots + their own sequencing assertions.)
const NONDETERMINISTIC_IDS = new Set<string>([
  'inline-three-arg',
  'inline-two-side-by-side',
  'colon-random',
  'colon-roll',
  'colon-comma-escape',
  'colon-roll-already-canonical',
  // {{random::a::b}} — canonical-:: idempotency case is a 2-option random, so
  // its exact text ("a"/"b") is a coin flip. Exact-snapshotting it flakes ~50%
  // of runs; classify it volatile and assert cacheable=false + membership.
  'colon-idempotent-canonical',
  'space-roll',
  'lazy-volatile-random',
  'lazy-volatile-roll',
  // setvar entries whose VALUE is a {{random}} pick — the stored/echoed value
  // is nondeterministic, so the full-result snapshot would flap. Covered by
  // dedicated membership assertions below instead.
  'setvar-block-nested-macro-value', // {{setvar::a}}{{random::x::y}}{{/setvar}}{{getvar::a}}
  'setvar-inline-nested-value',      // {{setvar::Author::style of {{random::A::B}} text}}...
]);

// ============================================================================
// AST STRUCTURE SNAPSHOTS (input -> AST via __parseForTest)
// ============================================================================
// The AST snapshot pins the parser's structural output. __parseForTest bypasses
// preprocessing and the cache (it calls parseNodes directly), so it captures
// pure parse structure — exactly the layer the rewrite replaces.

describe('AST structure (input -> __parseForTest)', () => {
  for (const entry of CORPUS) {
    it(`AST: ${entry.id}`, () => {
      const ast = __parseForTest(entry.input);
      expect(ast).toMatchSnapshot();
    });
  }
});

// ============================================================================
// FULL RESULT SNAPSHOTS (input -> processMacros), deterministic entries
// ============================================================================

describe('processMacros result (deterministic entries)', () => {
  const deterministic = CORPUS.filter(e => !NONDETERMINISTIC_IDS.has(e.id));
  for (const entry of deterministic) {
    it(`result: ${entry.id}`, () => {
      const result = normalize(run(entry.input));
      expect(result).toMatchSnapshot();
    });
  }
});

// ============================================================================
// VOLATILE / RANDOM entries: cacheable===false + option-set membership
// ============================================================================
// Exact output varies per call, so we assert the invariants that DO hold:
//   - cacheable is false (a volatile macro poisoned the result)
//   - the output is drawn from the known option set

describe('volatile entries (cacheable=false + membership)', () => {
  function optionsFor(entry: CorpusEntry): string[] {
    switch (entry.id) {
      case 'inline-three-arg': // {{random::a::b::c}}
      case 'colon-random':     // {{random:a,b,c}}
      case 'lazy-volatile-random':
        return ['a', 'b', 'c'];
      case 'colon-comma-escape': // {{random:hello\, world,goodbye\, world}}
        return ['hello, world', 'goodbye, world'];
      case 'colon-idempotent-canonical': // {{random::a::b}}
        return ['a', 'b'];
      default:
        return [];
    }
  }

  it('inline-three-arg: cacheable false, picks one of a/b/c', () => {
    const r = run('{{random::a::b::c}}');
    expect(r.cacheable).toBe(false);
    expect(['a', 'b', 'c']).toContain(r.text);
  });

  it('colon-random: cacheable false, picks one of a/b/c', () => {
    const r = run('{{random:a,b,c}}');
    expect(r.cacheable).toBe(false);
    expect(['a', 'b', 'c']).toContain(r.text);
  });

  it('lazy-volatile-random: cacheable false, picks one of a/b/c', () => {
    const r = run('{{random::a::b::c}}');
    expect(r.cacheable).toBe(false);
    expect(['a', 'b', 'c']).toContain(r.text);
  });

  it('colon-comma-escape: cacheable false, escaped-comma options survive', () => {
    const r = run('{{random:hello\\, world,goodbye\\, world}}');
    expect(r.cacheable).toBe(false);
    expect(['hello, world', 'goodbye, world']).toContain(r.text);
  });

  it('colon-idempotent-canonical: {{random::a::b}} cacheable false, picks a or b', () => {
    const r = run('{{random::a::b}}');
    expect(r.cacheable).toBe(false);
    expect(['a', 'b']).toContain(r.text);
  });

  it('inline-two-side-by-side: cacheable false, both picks valid', () => {
    const r = run('{{random::a::b}} and {{random::c::d}}');
    expect(r.cacheable).toBe(false);
    expect(r.text).toMatch(/^(a|b) and (c|d)$/);
  });

  it('roll family: cacheable false, numeric in range', () => {
    for (const input of ['{{roll:1d50}}', '{{roll::1d50}}', '{{roll 1d20}}']) {
      const r = run(input);
      expect(r.cacheable).toBe(false);
      const n = Number(r.text);
      expect(Number.isFinite(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
    }
  });

  it('setvar-block-nested-macro-value: cacheable false, stored value is x or y', () => {
    const r = run('{{setvar::a}}{{random::x::y}}{{/setvar}}{{getvar::a}}');
    expect(r.cacheable).toBe(false);
    expect(['x', 'y']).toContain(r.text);
  });

  it('setvar-inline-nested-value: cacheable false, value embeds A or B pick', () => {
    const r = run('{{setvar::Author::style of {{random::A::B}} text}}{{getvar::Author}}');
    expect(r.cacheable).toBe(false);
    expect(['style of A text', 'style of B text']).toContain(r.text);
  });

  // Membership smoke for the remaining single-option volatiles.
  it('option-set membership holds for all enumerated volatile entries', () => {
    for (const entry of CORPUS.filter(e => NONDETERMINISTIC_IDS.has(e.id))) {
      const opts = optionsFor(entry);
      if (opts.length === 0) continue;
      const r = run(entry.input);
      expect(r.cacheable).toBe(false);
      expect(opts).toContain(r.text);
    }
  });
});

// ============================================================================
// EXPLICIT BEHAVIORAL PINS (called out by the workflow spec)
// ============================================================================

describe('explicit: unknown macro reconstruction', () => {
  it('reconstructs unknown with EVALUATED args: {{unknown::{{char}}}} -> {{unknown::TestChar}}', () => {
    const r = run('{{unknown::{{char}}}}');
    // Text preserves the unknown macro, but with the nested arg already evaluated.
    expect(r.text).toBe('{{unknown::TestChar}}');
    // The error record's `macro` field carries the same evaluated reconstruction.
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].macro).toBe('{{unknown::TestChar}}');
    expect(r.errors[0].message).toContain('Unknown macro');
    // No successful expansion for the unknown itself; the inner {{char}} did expand.
    expect(r.errors[0].macro).not.toContain('{{char}}');
  });

  it('bare unknown reconstructs without args and records error', () => {
    const r = run('{{unknown}}');
    expect(r.text).toBe('{{unknown}}');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].macro).toBe('{{unknown}}');
  });

  it('multi-arg unknown reconstructs with all evaluated args', () => {
    const r = run('{{unknown::a::b::c}}');
    expect(r.text).toBe('{{unknown::a::b::c}}');
    expect(r.errors[0].macro).toBe('{{unknown::a::b::c}}');
  });
});

describe('explicit: unknown literal is TRUTHY in {{if}}', () => {
  it('{{if somethingTruthy}}taken{{/if}} takes the then-branch', () => {
    const r = run('{{if somethingTruthy}}taken{{/if}}');
    expect(r.text).toBe('taken');
  });
});

describe('explicit: escaped braces round-trip', () => {
  it('\\{\\{char\\}\\} survives as literal {{char}} (not expanded)', () => {
    const r = run('Use \\{\\{char\\}\\} literally');
    expect(r.text).toBe('Use {{char}} literally');
    // No expansion of char inside the escaped braces.
    expect(r.expansions).toHaveLength(0);
  });

  it('escaped braces adjacent to a real macro: escaped stays literal, real expands', () => {
    const r = run('\\{\\{x\\}\\}{{char}}');
    expect(r.text).toBe('{{x}}TestChar');
  });

  it('escaped braces inside an arg survive as literal braces', () => {
    const r = run('{{upper::\\{\\{x\\}\\}}}');
    expect(r.text).toBe('{{X}}');
  });
});

describe('explicit: \\n{3,} collapses to \\n\\n', () => {
  it('three newlines collapse to two', () => {
    expect(run('a\n\n\nb').text).toBe('a\n\nb');
  });
  it('five newlines collapse to two', () => {
    expect(run('a\n\n\n\n\nb').text).toBe('a\n\nb');
  });
  it('two newlines are preserved', () => {
    expect(run('a\n\nb').text).toBe('a\n\nb');
  });
});

describe('explicit: falsy set in conditions', () => {
  // isBlockTruthy treats 'false', '0', 'null', 'undefined' (case-insensitive,
  // trimmed) as falsy. NOTE: the empty string is NOT exercised here as a
  // condition value — `{{if }}` is not a well-formed block-if opener (the
  // parser needs `if ` followed by content), so it falls out of this family.
  const falsy = ['false', '0', 'null', 'undefined', 'FALSE', 'Null'];
  for (const v of falsy) {
    it(`{{if ${JSON.stringify(v)}}} takes else-branch`, () => {
      const r = run(`{{if ${v}}}YES{{else}}NO{{/if}}`);
      expect(r.text).toBe('NO');
    });
  }
  it('non-falsy literal takes then-branch', () => {
    expect(run('{{if 3}}YES{{else}}NO{{/if}}').text).toBe('YES');
    expect(run('{{if true}}YES{{else}}NO{{/if}}').text).toBe('YES');
  });
});

describe('explicit: MAX_EVAL_DEPTH overflow yields empty string', () => {
  it('a recursive expansion deeper than MAX_EVAL_DEPTH evaluates to ""', () => {
    // {{aliasthatloops}} -> set a var to a self-referential macro and read it.
    // Simpler: deeply self-nested known macro that keeps producing macros.
    // We build a chain of nested upper:: that exceeds the eval-depth guard.
    let s = '{{char}}';
    for (let i = 0; i < 130; i++) {
      s = i % 2 === 0 ? `{{upper::${s}}}` : `{{lower::${s}}}`;
    }
    const r = run(s);
    // Past MAX_EVAL_DEPTH the inner evaluation returns '' and bubbles up.
    expect(r.text).toBe('');
  });
});

describe('explicit: rcounter sequencing + cacheable=false', () => {
  it('{{rcounter::s}} increments across occurrences in one process call', () => {
    const r = run('S{{rcounter::s}}.S{{rcounter::s}}.S{{rcounter::s}}.');
    // Sequence pins exact values; first call snapshot would also catch this,
    // but we assert it explicitly because the rewrite must preserve ordering.
    expect(r.text).toBe('S1.S2.S3.');
    expect(r.cacheable).toBe(false);
  });

  it('independent counter names sequence independently', () => {
    const r = run('{{rcounter::a}}-{{rcounter::b}}-{{rcounter::a}}');
    expect(r.text).toBe('1-1-2');
    expect(r.cacheable).toBe(false);
  });
});

describe('explicit: setvar sideEffects[].cause', () => {
  it('inline setvar records a side effect with cause "setvar"', () => {
    const r = run('{{setvar::name::value}}');
    expect(r.sideEffects).toHaveLength(1);
    expect(r.sideEffects[0]).toMatchObject({
      type: 'setLocalVar',
      key: 'name',
      value: 'value',
      cause: 'setvar',
    });
    // Side effects make the result uncacheable.
    expect(r.cacheable).toBe(false);
  });

  it('block setvar records cause "setvar" and round-trips through getvar', () => {
    const r = run('{{setvar::greeting}}Hello World{{/setvar}}{{getvar::greeting}}');
    expect(r.text).toBe('Hello World');
    const setFx = r.sideEffects.find(fx => fx.key === 'greeting');
    expect(setFx).toBeDefined();
    expect(setFx!.cause).toBe('setvar');
    expect(setFx!.type).toBe('setLocalVar');
  });

  it('setglobalvar inline records cause "setglobalvar"', () => {
    const r = run('{{setglobalvar::counter::42}}');
    const fx = r.sideEffects.find(f => f.key === 'counter');
    expect(fx).toBeDefined();
    expect(fx!.cause).toBe('setglobalvar');
    expect(fx!.type).toBe('setGlobalVar');
  });
});

describe('explicit: \\x04 trim sentinel collapses surrounding whitespace', () => {
  it('bare {{trim}} with neighbors eats the whitespace on both sides', () => {
    // 'left  \n {{trim}} \n  right' -> bare trim emits the \x04 sentinel; the
    // post-processor's /\s*\x04\s*/ collapse removes all neighboring whitespace.
    expect(run('left  \n {{trim}} \n  right').text).toBe('leftright');
  });
  it('bare {{trim}} alone evaluates to empty (sentinel + no neighbors)', () => {
    expect(run('{{trim}}').text).toBe('');
  });
  it('a  {{trim}}  b collapses to ab (sentinel collapse, not \\n{3,})', () => {
    expect(run('a  {{trim}}  b').text).toBe('ab');
  });
  it('block {{trim}}…{{/trim}} trims only the block body, keeps outer text', () => {
    expect(run('a[{{trim}}  spaced out  {{/trim}}]b').text).toBe('a[spaced out]b');
  });
  it('inline {{trim::  x  }} trims its single arg', () => {
    expect(run('{{trim::  x  }}').text).toBe('x');
  });
});

describe('explicit: raw sentinel chars in INPUT (collision hazard)', () => {
  // The engine uses \x01/\x02 as escaped-brace sentinels, \x03 as the phase
  // orchestrator delimiter, and \x04 as the bare-trim sentinel. Feeding those
  // raw control chars in user input collides with the post-processing pass.
  // Pin the CURRENT (observed) outcomes so the rewrite preserves them exactly.
  it('raw \\x01 is restored as a literal "{" (escaped-open sentinel collision)', () => {
    expect(run('raw open sentinel \x01 here').text).toBe('raw open sentinel { here');
  });
  it('raw \\x02 is restored as a literal "}" (escaped-close sentinel collision)', () => {
    expect(run('raw close sentinel \x02 here').text).toBe('raw close sentinel } here');
  });
  it('raw \\x03 (phase delimiter) passes through unchanged', () => {
    expect(run('raw phase sentinel \x03 here').text).toBe('raw phase sentinel \x03 here');
  });
  it('raw \\x04 triggers the trim-sentinel collapse, eating adjacent whitespace', () => {
    expect(run('raw trim sentinel \x04 here').text).toBe('raw trim sentinelhere');
  });
  it('mixed raw sentinels around a real macro: \\x01->{ \\x02->} and \\x04 collapses', () => {
    expect(run('\x01\x02{{char}}\x04').text).toBe('{}TestChar');
  });
});

describe('explicit: touchedVariables fingerprint (non-empty)', () => {
  it('reading a missing var inside a block-if condition records the read', () => {
    // {{if {{getvar::missing}} == wp}}...: getvar reads `missing` (returns ''),
    // so the result fingerprint must list local:missing even though it is unset.
    const r = run('{{if {{getvar::missing}} == wp}}Y{{else}}N{{/if}}');
    expect(r.text).toBe('N');
    expect(r.touchedVariables).toEqual(['local:missing']);
  });

  it('reading two distinct vars records both, sorted; writes are NOT reads', () => {
    const r = run('{{setvar::a::1}}{{getvar::a}}{{getvar::b}}');
    // setvar is a write (no read fingerprint); both getvars read a and b.
    expect(r.touchedVariables).toEqual(['local:a', 'local:b']);
  });

  it('a template with no variable reads has an empty fingerprint', () => {
    expect(run('{{char}} and {{user}}').touchedVariables).toEqual([]);
  });
});

// ============================================================================
// META: corpus integrity (guards against silent corpus edits)
// ============================================================================

describe('meta: corpus integrity', () => {
  it('every corpus id is unique', () => {
    const ids = CORPUS.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('corpus size snapshot (flags additions/removals)', () => {
    expect(CORPUS.length).toMatchSnapshot();
  });
});
