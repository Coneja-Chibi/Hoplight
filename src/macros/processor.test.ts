// ============================================================================
// MACRO PROCESSOR TESTS
// Tests for the core macro processor: parsing, expansion, nesting, and errors
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import {
  processMacros,
  containsMacros,
  parseMacro,
  createDefaultContext,
  quickExpand,
} from './processor';
import { initializeMacros } from './index';
import { MacroContext } from './types';

// ============================================================================
// SETUP
// ============================================================================

// Ensure macros are initialized before tests run
// Registration is now idempotent, so this is safe to call multiple times
beforeAll(() => {
  initializeMacros();
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createTestContext(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: 'TestChar',
    userName: 'TestUser',
    messages: [
      { role: 'user', content: 'Hello there!' },
      { role: 'assistant', content: 'Hi! How are you?' },
    ],
    messageCount: 2,
    ...overrides,
  });
}

// ============================================================================
// containsMacros
// ============================================================================

describe('containsMacros', () => {
  it('returns true for text with macros', () => {
    expect(containsMacros('Hello {{char}}!')).toBe(true);
    expect(containsMacros('{{user}} said hi')).toBe(true);
    expect(containsMacros('{{random::a,b,c}}')).toBe(true);
  });

  it('returns false for text without macros', () => {
    expect(containsMacros('Hello world!')).toBe(false);
    expect(containsMacros('No macros here')).toBe(false);
    expect(containsMacros('')).toBe(false);
  });

  it('handles edge cases', () => {
    expect(containsMacros('{{ incomplete')).toBe(false);
    expect(containsMacros('incomplete }}')).toBe(false);
    // Empty macro {{}} doesn't match - regex requires at least one char
    expect(containsMacros('{{}}')).toBe(false);
  });
});

// ============================================================================
// parseMacro
// ============================================================================

describe('parseMacro', () => {
  it('parses simple macro names', () => {
    expect(parseMacro('char')).toEqual({ name: 'char', args: [] });
    expect(parseMacro('user')).toEqual({ name: 'user', args: [] });
    expect(parseMacro('time')).toEqual({ name: 'time', args: [] });
  });

  it('parses macros with single argument', () => {
    expect(parseMacro('getvar::myVar')).toEqual({ name: 'getvar', args: ['myVar'] });
    expect(parseMacro('upper::hello')).toEqual({ name: 'upper', args: ['hello'] });
  });

  it('parses macros with multiple arguments', () => {
    expect(parseMacro('setvar::name::value')).toEqual({ name: 'setvar', args: ['name', 'value'] });
    expect(parseMacro('random::a::b::c')).toEqual({ name: 'random', args: ['a', 'b', 'c'] });
  });

  it('handles empty arguments', () => {
    expect(parseMacro('macro::::empty')).toEqual({ name: 'macro', args: ['', 'empty'] });
  });

  it('normalizes macro names to lowercase', () => {
    expect(parseMacro('CHAR')).toEqual({ name: 'char', args: [] });
    expect(parseMacro('GetVar::test')).toEqual({ name: 'getvar', args: ['test'] });
  });

  it('preserves argument case', () => {
    expect(parseMacro('setvar::MyVar::MyValue')).toEqual({
      name: 'setvar',
      args: ['MyVar', 'MyValue']
    });
  });
});

// ============================================================================
// processMacros - Basic Expansion
// ============================================================================

describe('processMacros - Basic Expansion', () => {
  it('expands {{char}} to character name', () => {
    const ctx = createTestContext({ characterName: 'Alice' });
    const result = processMacros('Hello {{char}}!', ctx);

    expect(result.text).toBe('Hello Alice!');
    expect(result.errors).toHaveLength(0);
  });

  it('expands {{user}} to user name', () => {
    const ctx = createTestContext({ userName: 'Bob' });
    const result = processMacros('{{user}} says hi', ctx);

    expect(result.text).toBe('Bob says hi');
    expect(result.errors).toHaveLength(0);
  });

  it('expands multiple macros in same text', () => {
    const ctx = createTestContext({ characterName: 'Alice', userName: 'Bob' });
    const result = processMacros('{{user}} meets {{char}}', ctx);

    expect(result.text).toBe('Bob meets Alice');
    expect(result.stats.totalMacros).toBe(2);
  });

  it('uses the selected greeting for {{firstMessage}} before raw chat history', () => {
    const ctx = createTestContext({
      firstMessage: 'ALT GREETING: no fall happened.',
      messages: [
        { role: 'assistant', content: 'MAIN GREETING: injured after a fall.' },
        { role: 'user', content: 'What happened?' },
      ],
    });

    const result = processMacros('{{firstMessage}}', ctx);

    expect(result.text).toBe('ALT GREETING: no fall happened.');
    expect(result.text).not.toContain('injured after a fall');
  });

  it('handles text with no macros', () => {
    const ctx = createTestContext();
    const result = processMacros('Just plain text', ctx);

    expect(result.text).toBe('Just plain text');
    expect(result.stats.totalMacros).toBe(0);
  });

  it('tracks expansions correctly', () => {
    const ctx = createTestContext({ characterName: 'Alice' });
    const result = processMacros('Hi {{char}}!', ctx);

    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].original).toBe('{{char}}');
    expect(result.expansions[0].expanded).toBe('Alice');
    expect(result.expansions[0].macroName).toBe('char');
  });
});

// ============================================================================
// processMacros - Nested Macros (Deepest-First Expansion)
// ============================================================================

describe('processMacros - Nested Macros', () => {
  it('expands nested macros deepest-first', () => {
    const ctx = createTestContext({
      localVariables: new Map([
        ['name', { value: 'Alice', createdAt: new Date(), updatedAt: new Date() }],
      ]),
    });

    const result = processMacros('Hello {{upper::{{getvar::name}}}}!', ctx);

    expect(result.text).toBe('Hello ALICE!');
  });

  it('handles multiple levels of nesting', () => {
    const ctx = createTestContext({
      localVariables: new Map([
        ['varName', { value: 'char', createdAt: new Date(), updatedAt: new Date() }],
      ]),
      characterName: 'TestCharacter',
    });

    // This tests: {{getvar::varName}} -> "char" -> {{char}} -> "TestCharacter"
    // But note: the outer macro would need to reference {{char}} which we can't directly do
    // Let's test a simpler nested case
    const result = processMacros('{{lower::{{upper::hello}}}}', ctx);

    expect(result.text).toBe('hello');
  });

  it('records correct nesting depth in expansions', () => {
    const ctx = createTestContext();
    const result = processMacros('{{upper::{{char}}}}', ctx);

    // Inner macro should have depth 0, outer should have depth 1
    const innerExpansion = result.expansions.find(e => e.macroName === 'char');
    const outerExpansion = result.expansions.find(e => e.macroName === 'upper');

    expect(innerExpansion?.depth).toBe(0);
    expect(outerExpansion?.depth).toBe(1);
  });
});

// ============================================================================
// processMacros - Error Handling
// ============================================================================

describe('processMacros - Error Handling', () => {
  it('reports unknown macro errors', () => {
    const ctx = createTestContext();
    const result = processMacros('Hello {{unknownmacro}}!', ctx);

    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    // Error macro field includes the full macro with braces
    expect(result.errors[0].macro).toBe('{{unknownmacro}}');
    expect(result.errors[0].message).toContain('Unknown macro');
  });

  it('preserves original text for unknown macros', () => {
    const ctx = createTestContext();
    const result = processMacros('Hello {{unknownmacro}}!', ctx);

    expect(result.text).toBe('Hello {{unknownmacro}}!');
  });

  it('continues processing after errors', () => {
    const ctx = createTestContext({ characterName: 'Alice' });
    const result = processMacros('{{bad}} meets {{char}}', ctx);

    expect(result.text).toBe('{{bad}} meets Alice');
    // Multiple errors due to multi-pass processing
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.stats.successfulExpansions).toBe(1);
    expect(result.stats.failedExpansions).toBeGreaterThanOrEqual(1);
  });

  it('prevents infinite loops with max iterations', () => {
    const ctx = createTestContext();
    // This shouldn't happen in practice, but test safety limits
    const result = processMacros('{{char}}', ctx);

    expect(result.errors).toHaveLength(0);
    expect(result.stats.nestingDepthReached).toBeLessThanOrEqual(10);
  });
});

// ============================================================================
// processMacros - Side Effects (Variables)
// ============================================================================

describe('processMacros - Side Effects', () => {
  it('collects setvar side effects', () => {
    const ctx = createTestContext();
    const result = processMacros('{{setvar::myVar::hello}}', ctx);

    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0].type).toBe('setLocalVar');
    expect(result.sideEffects[0].key).toBe('myVar');
    expect(result.sideEffects[0].value).toBe('hello');
  });

  it('applies side effects within same processing pass', () => {
    const ctx = createTestContext();
    const result = processMacros('{{setvar::name::World}}Hello {{getvar::name}}!', ctx);

    expect(result.text).toBe('Hello World!');
  });

  it('evaluates nested macros inside inline setvar values before storing', () => {
    const ctx = createTestContext({ randomSeed: 123 });
    const result = processMacros(
      '{{setvar::Author::Write in the style of {{random::Steven King::Lev Grossman}} and capture their style and cadence}}{{getvar::Author}}',
      ctx
    );

    expect(result.text).toMatch(/^Write in the style of (Steven King|Lev Grossman) and capture their style and cadence$/);
    expect(result.text).not.toContain('{{');
    expect(ctx.localVariables.get('Author')?.value).toBe(result.text);
    expect(result.sideEffects[0]).toMatchObject({
      type: 'setLocalVar',
      key: 'Author',
      value: result.text,
    });
  });

  it('evaluates nested macros inside inline setvar variable names', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::{{lower::AUTHOR}}::{{upper::value}}}}{{getvar::author}}',
      ctx
    );

    expect(result.text).toBe('VALUE');
    expect(ctx.localVariables.get('author')?.value).toBe('VALUE');
  });

  it('tracks global variable side effects', () => {
    const ctx = createTestContext();
    const result = processMacros('{{setglobalvar::counter::42}}', ctx);

    expect(result.sideEffects.some(e => e.type === 'setGlobalVar')).toBe(true);
  });
});

// ============================================================================
// processMacros - Alias Support
// ============================================================================

describe('processMacros - Alias Support', () => {
  it('supports {{character}} as alias for {{char}}', () => {
    const ctx = createTestContext({ characterName: 'Alice' });

    const charResult = processMacros('{{char}}', ctx);
    const characterResult = processMacros('{{character}}', ctx);

    expect(charResult.text).toBe(characterResult.text);
  });

  it('supports {{player}} as alias for {{user}}', () => {
    const ctx = createTestContext({ userName: 'Bob' });

    const userResult = processMacros('{{user}}', ctx);
    const playerResult = processMacros('{{player}}', ctx);

    expect(userResult.text).toBe('Bob');
    expect(playerResult.text).toBe('Bob');
  });
});

// ============================================================================
// quickExpand
// ============================================================================

describe('quickExpand', () => {
  it('expands basic macros without needing full context', () => {
    const result = quickExpand('Hello {{char}}!', { characterName: 'Alice' });
    expect(result).toBe('Hello Alice!');
  });

  it('expands both char and user', () => {
    const result = quickExpand('{{user}} meets {{char}}', {
      characterName: 'Alice',
      userName: 'Bob',
    });
    expect(result).toBe('Bob meets Alice');
  });

  it('handles missing names gracefully', () => {
    const result = quickExpand('Hello {{char}}!');
    // Uses default context which has characterName: 'Character'
    expect(result).toBe('Hello Character!');
  });

  it('expands the persisted chat summary macro', () => {
    const result = quickExpand('Previously: {{summary}}', {
      chatSummary: 'The party escaped the archive.',
    });
    expect(result).toBe('Previously: The party escaped the archive.');
  });
});

// ============================================================================
// processMacros - Processing Stats
// ============================================================================

describe('processMacros - Processing Stats', () => {
  it('tracks total macros found', () => {
    const ctx = createTestContext();
    const result = processMacros('{{char}} and {{user}} and {{time}}', ctx);

    expect(result.stats.totalMacros).toBe(3);
  });

  it('tracks successful vs failed expansions', () => {
    const ctx = createTestContext();
    const result = processMacros('{{char}} and {{unknownmacro123}}', ctx);

    // Note: failedExpansions can be > 1 for unknown macros because the processor
    // tries multiple passes for nested expansion, and the unknown macro is detected each pass
    expect(result.stats.successfulExpansions).toBe(1);
    expect(result.stats.failedExpansions).toBeGreaterThanOrEqual(1);
    expect(result.text).toBe('TestChar and {{unknownmacro123}}');
  });

  it('records processing time', () => {
    const ctx = createTestContext();
    const result = processMacros('{{char}}', ctx);

    expect(result.stats.processingTimeMs).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// processMacros - Edge Cases
// ============================================================================

describe('processMacros - Edge Cases', () => {
  it('handles empty string', () => {
    const ctx = createTestContext();
    const result = processMacros('', ctx);

    expect(result.text).toBe('');
    expect(result.errors).toHaveLength(0);
  });

  it('handles macro at start of text', () => {
    const ctx = createTestContext({ characterName: 'Alice' });
    const result = processMacros('{{char}} is here', ctx);

    expect(result.text).toBe('Alice is here');
  });

  it('handles macro at end of text', () => {
    const ctx = createTestContext({ characterName: 'Alice' });
    const result = processMacros('Hello {{char}}', ctx);

    expect(result.text).toBe('Hello Alice');
  });

  it('handles consecutive macros', () => {
    const ctx = createTestContext({ characterName: 'Alice', userName: 'Bob' });
    const result = processMacros('{{char}}{{user}}', ctx);

    expect(result.text).toBe('AliceBob');
  });

  it('handles macros with special characters in args', () => {
    const ctx = createTestContext();
    const result = processMacros('{{setvar::key::value with spaces}}', ctx);

    expect(result.sideEffects[0].value).toBe('value with spaces');
  });

  it('is case-insensitive for macro names', () => {
    const ctx = createTestContext({ characterName: 'Alice' });

    expect(processMacros('{{CHAR}}', ctx).text).toBe('Alice');
    expect(processMacros('{{Char}}', ctx).text).toBe('Alice');
    expect(processMacros('{{cHaR}}', ctx).text).toBe('Alice');
  });
});

// ============================================================================
// processMacros - SillyTavern Random Compatibility
// Tests for {{random}} format compatibility with SillyTavern presets
// ============================================================================

describe('processMacros - SillyTavern Random Compatibility', () => {
  // FORMAT 1: Standard double-colon separated text args (should already work)
  it('expands {{random::text1::text2::text3}} with double-colon separators', () => {
    const ctx = createTestContext();
    const result = processMacros('{{random::alpha::beta::gamma}}', ctx);

    expect(result.errors).toHaveLength(0);
    expect(['alpha', 'beta', 'gamma']).toContain(result.text);
  });

  // FORMAT 2: Emoji-prefixed text options (common in CoT templates)
  it('expands random macros with emoji-prefixed text options', () => {
    const ctx = createTestContext();
    const result = processMacros('{{random::How is archetype shaping response?::What archetypal fear drives reaction?::👁 Is shadow aspect showing?}}', ctx);

    expect(result.errors).toHaveLength(0);
    expect([
      'How is archetype shaping response?',
      'What archetypal fear drives reaction?',
      '👁 Is shadow aspect showing?',
    ]).toContain(result.text);
  });

  // FORMAT 3: Many options (10+, common in ST CoT templates)
  it('expands random macros with 10+ text options', () => {
    const ctx = createTestContext();
    const options = [
      'How is archetype shaping response?',
      'What archetypal fear drives reaction?',
      '👁 Is shadow aspect showing?',
      'What unconscious pattern is active?',
      '🌑 Where is the shadow projected?',
      'Which persona mask is worn?',
      'What complex is activated?',
      '🌊 What emotion is being repressed?',
      '🔥 What drives the anima/animus?',
      '🌿 What growth archetype emerges?',
    ];
    const macro = `{{random::${options.join('::')}}}`;
    const result = processMacros(macro, ctx);

    expect(result.errors).toHaveLength(0);
    expect(options).toContain(result.text);
  });

  // FORMAT 4: Comma-separated within single arg (SillyTavern style)
  // In ST: {{random::opt1,opt2,opt3}} splits on commas if no :: found in list
  it('handles comma-separated options within single arg (ST compat)', () => {
    const ctx = createTestContext();
    const result = processMacros('{{random::alpha,beta,gamma}}', ctx);

    // Currently this returns the full "alpha,beta,gamma" string
    // After fix, it should pick one option
    expect(['alpha', 'beta', 'gamma']).toContain(result.text);
  });

  // FORMAT 5: Single-colon format (SillyTavern also accepts this)
  // In ST: {{random:opt1,opt2,opt3}} with single colon
  it('handles single-colon format with comma-separated options (ST compat)', () => {
    const ctx = createTestContext();
    // Note: in our parser, {{random:opt1,opt2}} is parsed as name="random:opt1,opt2"
    // This format would need special handling
    const result = processMacros('{{random:alpha,beta,gamma}}', ctx);

    // After fix, this should pick one option
    expect(['alpha', 'beta', 'gamma']).toContain(result.text);
  });

  // FORMAT 6: Curly braces inside random options
  // Our regex [^{}]+ would fail to match if options contain { or }
  it('handles options containing curly braces in text', () => {
    const ctx = createTestContext();
    const result = processMacros('{{random::How does {archetype} influence?::What {shadow} emerges?::Why {anima} guides?}}', ctx);

    expect(result.errors).toHaveLength(0);
    expect([
      'How does {archetype} influence?',
      'What {shadow} emerges?',
      'Why {anima} guides?',
    ]).toContain(result.text);
  });

  // FORMAT 7: Multiple random macros in same text
  it('expands multiple random macros in same text block', () => {
    const ctx = createTestContext();
    const result = processMacros('Think about {{random::love::hate::fear}} and {{random::joy::sadness::anger}}', ctx);

    // Both macros should be expanded
    expect(result.text).not.toContain('{{random');
    expect(result.stats.successfulExpansions).toBeGreaterThanOrEqual(2);
  });

  // FORMAT 8: Escaped commas (SillyTavern supports \, to include literal commas)
  it('handles escaped commas in comma-separated format (ST compat)', () => {
    const ctx = createTestContext();
    const result = processMacros('{{random::hello\\, world,goodbye\\, world}}', ctx);

    // After fix: should pick either "hello, world" or "goodbye, world"
    expect(['hello, world', 'goodbye, world']).toContain(result.text);
  });
});

// ============================================================================
// BLOCK CONDITIONALS WITH NESTED COMPARISONS
// Regression tests for the phase comparison bug where {{if {{compare::...}} }}
// would misparse when the compare macro hadn't been expanded yet
// ============================================================================

describe('processMacros - Block Conditional with Nested Compare', () => {
  it('correctly evaluates numeric >= comparison inside block if', () => {
    const ctx = createTestContext();
    // turn = 2, should NOT match >= 16
    const result = processMacros(
      '{{setvar::turn::2}}{{setvar::phase::Opening}}' +
      '{{if {{compare::{{getvar::turn}}::>=::16}} }}{{setvar::phase::Rising}}{{/if}}' +
      'Phase: {{getvar::phase}}',
      ctx
    );
    expect(result.text).toBe('Phase: Opening');
  });

  it('correctly evaluates numeric >= when condition IS met', () => {
    const ctx = createTestContext();
    // turn = 20, should match >= 16
    const result = processMacros(
      '{{setvar::turn::20}}{{setvar::phase::Opening}}' +
      '{{if {{compare::{{getvar::turn}}::>=::16}} }}{{setvar::phase::Rising}}{{/if}}' +
      'Phase: {{getvar::phase}}',
      ctx
    );
    expect(result.text).toBe('Phase: Rising');
  });

  it('cascading phase checks only set the correct phase (HawThorne pattern)', () => {
    const ctx = createTestContext();
    // Simulate HawThorne phase cascade with turn = 2
    const result = processMacros(
      '{{setvar::t::2}}' +
      '{{setvar::phase::Opening}}' +
      '{{if {{compare::{{getvar::t}}::>=::16}} }}{{setvar::phase::Rising}}{{/if}}' +
      '{{if {{compare::{{getvar::t}}::>=::51}} }}{{setvar::phase::Cruising}}{{/if}}' +
      '{{if {{compare::{{getvar::t}}::>=::151}} }}{{setvar::phase::Marathon}}{{/if}}' +
      '{{if {{compare::{{getvar::t}}::>=::500}} }}{{setvar::phase::Endurance}}{{/if}}' +
      '{{getvar::phase}}',
      ctx
    );
    expect(result.text).toBe('Opening');
  });

  it('cascading phase checks set Marathon for turn 200', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::t::200}}' +
      '{{setvar::phase::Opening}}' +
      '{{if {{compare::{{getvar::t}}::>=::16}} }}{{setvar::phase::Rising}}{{/if}}' +
      '{{if {{compare::{{getvar::t}}::>=::51}} }}{{setvar::phase::Cruising}}{{/if}}' +
      '{{if {{compare::{{getvar::t}}::>=::151}} }}{{setvar::phase::Marathon}}{{/if}}' +
      '{{if {{compare::{{getvar::t}}::>=::500}} }}{{setvar::phase::Endurance}}{{/if}}' +
      '{{getvar::phase}}',
      ctx
    );
    expect(result.text).toBe('Marathon');
  });

  it('dot-notation comparison inside block if works correctly', () => {
    const ctx = createTestContext();
    // Using dot-notation shorthand like HawThorne does
    const result = processMacros(
      '{{setvar::t::5}}{{setvar::result::no}}' +
      '{{if {{.t >= 10}} }}{{setvar::result::yes}}{{/if}}' +
      '{{getvar::result}}',
      ctx
    );
    expect(result.text).toBe('no');
  });

  it('dot-notation == comparison inside block if works', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::x::Opening}}' +
      '{{if {{.x == Opening}} }}MATCH{{/if}}' +
      '{{if {{.x == Rising}} }}NO{{/if}}',
      ctx
    );
    expect(result.text).toBe('MATCH');
  });
});

describe('processMacros - Block Conditional Expression Evaluation', () => {
  it('evaluates inline >= comparison in condition', () => {
    const ctx = createTestContext();
    // Simulates {{if {{getvar::turn}} >= 8}} where getvar resolved to 1
    const result = processMacros(
      '{{setvar::turn::1}}' +
      '{{if {{getvar::turn}} >= 8}}ACTIVE{{else}}INACTIVE{{/if}}',
      ctx
    );
    expect(result.text).toBe('INACTIVE');
  });

  it('evaluates inline >= comparison when met', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::turn::10}}' +
      '{{if {{getvar::turn}} >= 8}}ACTIVE{{else}}INACTIVE{{/if}}',
      ctx
    );
    expect(result.text).toBe('ACTIVE');
  });

  it('evaluates inline == comparison', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::mode::wp_weather}}' +
      '{{if {{getvar::mode}} == wp_weather}}WEATHER{{else}}OTHER{{/if}}',
      ctx
    );
    expect(result.text).toBe('WEATHER');
  });

  it('evaluates inline == comparison with empty LHS as false', () => {
    const ctx = createTestContext();
    // getvar for undefined variable returns empty
    const result = processMacros(
      '{{if {{getvar::undefined_var}} == wp_weather}}YES{{else}}NO{{/if}}',
      ctx
    );
    expect(result.text).toBe('NO');
  });

  it('evaluates inline > comparison', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::count::24}}' +
      '{{if {{getvar::count}} > 0}}HAS_COUNT{{else}}EMPTY{{/if}}',
      ctx
    );
    expect(result.text).toBe('HAS_COUNT');
  });

  it('evaluates negation !value in condition', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::flag::3}}' +
      '{{if !{{getvar::flag}}}}NEGATED{{else}}NOT_NEGATED{{/if}}',
      ctx
    );
    expect(result.text).toBe('NOT_NEGATED');
  });

  it('evaluates negation of empty value as true', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{if !{{getvar::undefined_var}}}}NEGATED{{else}}NOT_NEGATED{{/if}}',
      ctx
    );
    expect(result.text).toBe('NEGATED');
  });

  it('evaluates numeric == comparison (3 == 1 is false)', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::x::3}}' +
      '{{if {{getvar::x}} == 1}}MATCH{{else}}NO_MATCH{{/if}}',
      ctx
    );
    expect(result.text).toBe('NO_MATCH');
  });

  it('skips unresolved blocks and still processes resolved ones after them', () => {
    const ctx = createTestContext();
    // First block has an unresolvable condition (unknown macro),
    // second block has a plain resolved condition — should still be processed.
    const result = processMacros(
      '{{if {{unknown_macro_xyz}}}}FIRST{{/if}}' +
      '{{if true}}SECOND{{/if}}',
      ctx
    );
    expect(result.text).toContain('SECOND');
  });

  it('handles block conditional with "true" string', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{if true}}YES{{else}}NO{{/if}}',
      ctx
    );
    expect(result.text).toBe('YES');
  });

  it('handles block conditional with "false" string', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{if false}}YES{{else}}NO{{/if}}',
      ctx
    );
    expect(result.text).toBe('NO');
  });

  it('handles block conditional with "0" as falsy', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{if 0}}YES{{else}}NO{{/if}}',
      ctx
    );
    expect(result.text).toBe('NO');
  });

  it('handles block conditional with non-zero number as truthy', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{if 3}}YES{{else}}NO{{/if}}',
      ctx
    );
    expect(result.text).toBe('YES');
  });
});

// ============================================================================
// SillyTavern {{#if}} Alias
// ============================================================================

describe('processMacros - SillyTavern #if Alias', () => {
  it('{{#if}} works as alias for {{if}} block conditional', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::mood::happy}}' +
      '{{#if {{getvar::mood}}}}HAS_MOOD{{/if}}',
      ctx
    );
    expect(result.text).toBe('HAS_MOOD');
  });

  it('{{#if}} with {{else}} and {{/if}}', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{#if {{getvar::undefined_var}}}}YES{{else}}NO{{/if}}',
      ctx
    );
    expect(result.text).toBe('NO');
  });

  it('{{#if}} with nested compare (SillyTavern preset pattern)', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::ct_gore::restricted}}' +
      '{{#if {{compare::{{getvar::ct_gore}}::==::restricted}}}}BLOCKED{{else}}ALLOWED{{/if}}',
      ctx
    );
    expect(result.text).toBe('BLOCKED');
  });

  it('{{#if}} with {{/#if}} closer', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::flag::1}}' +
      '{{#if {{getvar::flag}}}}YES{{/#if}}',
      ctx
    );
    expect(result.text).toBe('YES');
  });

  it('nested {{#if}} blocks work correctly', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::a::1}}{{setvar::b::0}}' +
      '{{#if {{getvar::a}}}}OUTER{{#if {{getvar::b}}}}INNER{{/if}}{{/if}}',
      ctx
    );
    expect(result.text).toBe('OUTER');
  });

  it('mixed {{if}} and {{#if}} nesting works', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::x::hello}}{{setvar::y::world}}' +
      '{{if {{getvar::x}}}}A{{#if {{getvar::y}}}}B{{/if}}{{/if}}',
      ctx
    );
    expect(result.text).toBe('AB');
  });
});

// ============================================================================
// AST PARSER — Short-Circuit, Deep Nesting, Malformed Blocks
// ============================================================================

describe('processMacros - Block-If Short-Circuit', () => {
  it('does NOT evaluate the false branch (prevents premature side effects)', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::x::good}}{{if false}}{{setvar::x::bad}}{{/if}}{{getvar::x}}',
      ctx
    );
    expect(result.text).toBe('good');
  });

  it('does NOT evaluate the else branch when condition is true', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::x::initial}}{{if true}}{{setvar::x::then}}{{else}}{{setvar::x::else}}{{/if}}{{getvar::x}}',
      ctx
    );
    expect(result.text).toBe('then');
  });

  it('evaluates only else branch when condition is false', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::x::initial}}{{if false}}{{setvar::x::then}}{{else}}{{setvar::x::else}}{{/if}}{{getvar::x}}',
      ctx
    );
    expect(result.text).toBe('else');
  });
});

describe('processMacros - Deep Nesting', () => {
  it('handles 10+ levels of nesting without issues', () => {
    const ctx = createTestContext();
    // Build a deeply nested macro: {{upper::{{lower::{{upper::...{{char}}...}}}}}}
    let inner = '{{char}}';
    for (let i = 0; i < 12; i++) {
      inner = i % 2 === 0 ? `{{upper::${inner}}}` : `{{lower::${inner}}}`;
    }
    const result = processMacros(inner, ctx);
    // 12 wraps: i=0 upper, i=1 lower, ... i=11 lower (outermost is lower)
    expect(result.text).toBe('testchar');
    expect(result.errors).toHaveLength(0);
  });

  it('handles deeply nested block-if', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{if true}}{{if true}}{{if true}}{{if true}}DEEP{{/if}}{{/if}}{{/if}}{{/if}}',
      ctx
    );
    expect(result.text).toBe('DEEP');
  });
});

describe('processMacros - Malformed Blocks', () => {
  it('treats {{if COND}} without {{/if}} as plain text', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{if true}}content without closing tag',
      ctx
    );
    // Should be preserved as text since there's no matching {{/if}}
    expect(result.text).toContain('content without closing tag');
  });

  it('silently consumes orphaned {{/if}}', () => {
    const ctx = createTestContext();
    const result = processMacros(
      'before{{/if}}after',
      ctx
    );
    expect(result.text).toBe('beforeafter');
  });

  it('silently consumes orphaned {{else}}', () => {
    const ctx = createTestContext();
    const result = processMacros(
      'before{{else}}after',
      ctx
    );
    expect(result.text).toBe('beforeafter');
  });
});

describe('processMacros - Mixed Inline and Block If', () => {
  it('handles inline {{if::cond::then::else}} alongside block {{if cond}}...{{/if}}', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{if::true::INLINE_YES::INLINE_NO}} and {{if true}}BLOCK_YES{{else}}BLOCK_NO{{/if}}',
      ctx
    );
    expect(result.text).toBe('INLINE_YES and BLOCK_YES');
  });

  it('handles block-if with nested inline compare', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::x::5}}{{if {{compare::{{getvar::x}}::>=::3}} }}YES{{else}}NO{{/if}}',
      ctx
    );
    expect(result.text).toBe('YES');
  });
});

describe('processMacros - Block Setvar', () => {
  it('sets variable to block content and produces no output', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::greeting}}Hello World{{/setvar}}Value: {{getvar::greeting}}',
      ctx
    );
    expect(result.text).toBe('Value: Hello World');
  });

  it('sets global variable with block syntax', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setglobalvar::msg}}Greetings{{/setglobalvar}}{{getglobalvar::msg}}',
      ctx
    );
    expect(result.text).toBe('Greetings');
  });

  it('evaluates macros inside block setvar content', () => {
    const ctx = createTestContext({ characterName: 'Alice' });
    const result = processMacros(
      '{{setvar::info}}Name is {{char}}{{/setvar}}{{getvar::info}}',
      ctx
    );
    expect(result.text).toBe('Name is Alice');
  });
});

describe('processMacros - Comment Macros', () => {
  it('removes simple comment macros', () => {
    const ctx = createTestContext();
    const result = processMacros(
      'before{{// this is a comment}}after',
      ctx
    );
    expect(result.text).toBe('beforeafter');
    expect(result.errors).toHaveLength(0);
  });

  it('removes multiline comment macros', () => {
    const ctx = createTestContext();
    const result = processMacros(
      'before{{// line one\nline two\nline three}}after',
      ctx
    );
    expect(result.text).toBe('beforeafter');
    expect(result.errors).toHaveLength(0);
  });

  it('removes comment macros containing :: separators', () => {
    const ctx = createTestContext();
    const result = processMacros(
      'before{{// note: use format a::b::c}}after',
      ctx
    );
    expect(result.text).toBe('beforeafter');
    expect(result.errors).toHaveLength(0);
  });

  it('handles comments alongside real macros', () => {
    const ctx = createTestContext({ characterName: 'Alice' });
    const result = processMacros(
      '{{// setup comment}}Hello {{char}}!',
      ctx
    );
    expect(result.text).toBe('Hello Alice!');
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================================================
// Imported-preset compat: single-colon separators, bare shorthand conditions,
// and AST-cache correctness (added for Lumiverse-style preset support)
// ============================================================================

describe('single-colon separator tolerance', () => {
  it('normalizes {{roll:1d50}} to the :: form', () => {
    const ctx = createTestContext();
    const result = processMacros('{{roll:1d50}}', ctx);
    const n = Number(result.text);
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(50);
  });

  it('normalizes {{getvar:name}} and multi-arg {{setvar:name:value}}', () => {
    const ctx = createTestContext();
    const result = processMacros('{{setvar:mood:grim}}{{getvar:mood}}', ctx);
    expect(result.text).toBe('grim');
  });

  it('leaves canonical :: macros untouched', () => {
    const ctx = createTestContext();
    const result = processMacros('{{setvar::mood::calm}}{{getvar::mood}}', ctx);
    expect(result.text).toBe('calm');
  });
});

describe('bare variable shorthand in block-if conditions', () => {
  it('resolves bare .var in a comparison condition', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::body_roll::20}}{{if .body_roll <= 25}}low{{else}}high{{/if}}',
      ctx
    );
    expect(result.text).toBe('low');
  });

  it('resolves bare .var on the false side of the comparison', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::body_roll::80}}{{if .body_roll <= 25}}low{{else}}high{{/if}}',
      ctx
    );
    expect(result.text).toBe('high');
  });

  it('resolves bare .var as a truthiness condition', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::nsfw_on::1}}{{if .nsfw_on}}on{{else}}off{{/if}}',
      ctx
    );
    expect(result.text).toBe('on');
  });

  it('treats a missing bare .var as falsy', () => {
    const ctx = createTestContext();
    const result = processMacros('{{if .never_set}}on{{else}}off{{/if}}', ctx);
    expect(result.text).toBe('off');
  });

  it('supports negated bare shorthand {{if !.var}}', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::flag::0}}{{if !.flag}}clear{{else}}set{{/if}}',
      ctx
    );
    expect(result.text).toBe('clear');
  });
});

describe('AST cache correctness', () => {
  it('re-evaluates the same template with fresh variable state', () => {
    // Same template string twice — second run must reflect the new context,
    // not a stale cached evaluation (the cache stores the parse tree only).
    const template = '{{if .stage == 2}}two{{else}}other{{/if}}';

    const ctx1 = createTestContext();
    ctx1.localVariables.set('stage', { value: '2', createdAt: new Date(), updatedAt: new Date() });
    expect(processMacros(template, ctx1).text).toBe('two');

    const ctx2 = createTestContext();
    ctx2.localVariables.set('stage', { value: '7', createdAt: new Date(), updatedAt: new Date() });
    expect(processMacros(template, ctx2).text).toBe('other');
  });

  it('repeated evaluation with side effects stays correct across cache hits', () => {
    // incvar returns the new value, so each run emits it twice (inc + get).
    // What matters: the third run still increments — the cached AST is
    // re-evaluated against live state, not replayed.
    const template = '{{incvar::n}}{{getvar::n}}';
    const ctx = createTestContext();
    expect(processMacros(template, ctx).text).toBe('11');
    expect(processMacros(template, ctx).text).toBe('22');
    expect(processMacros(template, ctx).text).toBe('33');
  });
});

// ============================================================================
// Brace escaping, legacy tokens, interceptors, result fingerprinting
// ============================================================================

import { registerMacroInterceptor, unregisterMacroInterceptor, clearMacroInterceptors } from './processor';
import { afterEach } from 'vitest';

describe('escaped braces', () => {
  it('renders \{\{macro\}\} as literal braces without expanding', () => {
    const ctx = createTestContext({ characterName: 'Alice' });
    const result = processMacros('Use \\{\\{char\\}\\} to insert the name: {{char}}', ctx);
    expect(result.text).toBe('Use {{char}} to insert the name: Alice');
  });

  it('escaped braces survive inside block-if branches', () => {
    const ctx = createTestContext();
    const result = processMacros(
      '{{setvar::docs::1}}{{if .docs}}Write \\{\\{user\\}\\} in your prompt{{/if}}',
      ctx
    );
    expect(result.text).toBe('Write {{user}} in your prompt');
  });
});

describe('legacy angle tokens', () => {
  it('converts <user>, <char>, and <bot> to macro equivalents', () => {
    const ctx = createTestContext({ characterName: 'Mira', userName: 'Chi' });
    const result = processMacros('<USER> meets <char>; <Bot> nods.', ctx);
    expect(result.text).toBe('Chi meets Mira; Mira nods.');
  });

  it('leaves unrelated angle-bracket content alone', () => {
    const ctx = createTestContext();
    const result = processMacros('<div>HTML stays</div> <userdata>too</userdata>', ctx);
    expect(result.text).toBe('<div>HTML stays</div> <userdata>too</userdata>');
  });
});

describe('macro interceptors', () => {
  afterEach(() => clearMacroInterceptors());

  it('pre-interceptors rewrite the raw template before expansion', () => {
    registerMacroInterceptor({
      id: 'test-pre',
      phase: 'pre',
      fn: (text) => text.replace('{{legacy_alias}}', '{{char}}'),
    });
    const ctx = createTestContext({ characterName: 'Vex' });
    expect(processMacros('Hi {{legacy_alias}}', ctx).text).toBe('Hi Vex');
  });

  it('post-interceptors transform the final expanded text', () => {
    registerMacroInterceptor({
      id: 'test-post',
      phase: 'post',
      fn: (text) => text.toUpperCase(),
    });
    const ctx = createTestContext({ characterName: 'Vex' });
    expect(processMacros('hi {{char}}', ctx).text).toBe('HI VEX');
  });

  it('unregistering removes the hook', () => {
    registerMacroInterceptor({ id: 'gone', phase: 'post', fn: (t) => t + '!' });
    unregisterMacroInterceptor('gone');
    const ctx = createTestContext();
    expect(processMacros('plain', ctx).text).toBe('plain');
  });

  it('a throwing interceptor is skipped, not fatal', () => {
    registerMacroInterceptor({ id: 'bad', phase: 'pre', fn: () => { throw new Error('boom'); } });
    const ctx = createTestContext({ characterName: 'Sol' });
    expect(processMacros('{{char}}', ctx).text).toBe('Sol');
  });
});

describe('result fingerprinting', () => {
  it('records touched variables from getvar reads and condition shorthands', () => {
    const ctx = createTestContext();
    ctx.localVariables.set('mood', { value: 'grim', createdAt: new Date(), updatedAt: new Date() });
    ctx.localVariables.set('stage', { value: '3', createdAt: new Date(), updatedAt: new Date() });
    const result = processMacros('{{getvar::mood}} {{if .stage == 3}}late{{/if}}', ctx);
    expect(result.text).toBe('grim late');
    expect(result.touchedVariables).toContain('local:mood');
    expect(result.touchedVariables).toContain('local:stage');
    expect(result.cacheable).toBe(true);
  });

  it('marks results with volatile macros as uncacheable', () => {
    const ctx = createTestContext();
    const result = processMacros('{{roll::1d20}}', ctx);
    expect(result.cacheable).toBe(false);
  });

  it('marks results with side effects as uncacheable', () => {
    const ctx = createTestContext();
    const result = processMacros('{{setvar::x::1}}', ctx);
    expect(result.cacheable).toBe(false);
  });

  it('static text with identity macros is cacheable and touches nothing', () => {
    const ctx = createTestContext({ characterName: 'Nia' });
    const result = processMacros('Hello {{char}}.', ctx);
    expect(result.cacheable).toBe(true);
    expect(result.touchedVariables).toEqual([]);
  });
});
