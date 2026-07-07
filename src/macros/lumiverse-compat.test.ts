// ============================================================================
// LUMIVERSE COMPATIBILITY TESTS
// Lumiverse presets (e.g. ThreadBare) use a dialect of the macro language:
// {{if::cond}} block conditionals, {{else if::cond}} chains, {{//if}} as an
// if-terminator, {{trim}} blocks, {{rcounter}}, group-card macros, and
// platform tokens (lumia*, spotify_*). These tests pin RC's native support.
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { processMacros, createDefaultContext, quickExpand } from './processor';
import { initializeMacros } from './index';
import { MacroContext } from './types';

beforeAll(() => {
  initializeMacros();
});

function ctx(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: 'Stella',
    userName: 'Chi',
    ...overrides,
  });
}

function withVar(name: string, value: string, overrides: Partial<MacroContext> = {}): MacroContext {
  const c = ctx(overrides);
  c.localVariables.set(name, { value, createdAt: new Date(), updatedAt: new Date() });
  return c;
}

// ============================================================================
// {{if::cond}} BLOCK CONDITIONALS (Lumiverse colon form)
// ============================================================================

describe('Lumiverse {{if::cond}} block conditionals', () => {
  it('takes the then-branch when the condition is truthy', () => {
    const result = processMacros('{{if::1}}YES{{/if}}', ctx());
    expect(result.text).toBe('YES');
  });

  it('takes the else-branch when the condition is falsy', () => {
    const result = processMacros('{{if::0}}YES{{else}}NO{{/if}}', ctx());
    expect(result.text).toBe('NO');
  });

  it('evaluates a nested getvar condition (ThreadBare pattern)', () => {
    const on = processMacros(
      '{{if::{{getvar::nsfw_on}}}}adult{{else}}clean{{/if}}',
      withVar('nsfw_on', '1'),
    );
    expect(on.text).toBe('adult');

    const off = processMacros(
      '{{if::{{getvar::nsfw_on}}}}adult{{else}}clean{{/if}}',
      withVar('nsfw_on', '0'),
    );
    expect(off.text).toBe('clean');
  });

  it('supports comparison conditions in the colon form', () => {
    const result = processMacros(
      '{{if::{{getvar::mode}} == solo}}SOLO{{else}}GROUP{{/if}}',
      withVar('mode', 'solo'),
    );
    expect(result.text).toBe('SOLO');
  });

  it('treats {{//if}} as an if-terminator (Lumiverse close variant)', () => {
    const result = processMacros('{{if::1}}A{{else}}B{{//if}} tail', ctx());
    expect(result.text).toBe('A tail');
  });

  it('still supports the inline 3-arg form {{if::cond::then::else}}', () => {
    expect(quickExpand('{{if::1::yes::no}}', ctx())).toBe('yes');
    expect(quickExpand('{{if::0::yes::no}}', ctx())).toBe('no');
  });

  it('nests colon-form blocks correctly', () => {
    const result = processMacros(
      '{{if::1}}outer {{if::0}}inner-yes{{else}}inner-no{{/if}}{{/if}}',
      ctx(),
    );
    expect(result.text).toBe('outer inner-no');
  });

  it('mixes colon-form and space-form nesting', () => {
    const result = processMacros(
      '{{if::1}}colon {{if 1}}space{{/if}}{{/if}}',
      ctx(),
    );
    expect(result.text).toBe('colon space');
  });
});

// ============================================================================
// {{else if::cond}} CHAINS
// ============================================================================

describe('{{else if::cond}} chains', () => {
  const TEMPLATE =
    '{{if::{{getvar::mode}} == solo}}SOLO' +
    '{{else if::{{getvar::mode}} == swap}}SWAP' +
    '{{else if::{{getvar::mode}} == ensemble}}ENSEMBLE' +
    '{{else}}UNKNOWN{{/if}}';

  it('takes the first matching branch', () => {
    expect(processMacros(TEMPLATE, withVar('mode', 'solo')).text).toBe('SOLO');
  });

  it('takes a middle else-if branch', () => {
    expect(processMacros(TEMPLATE, withVar('mode', 'swap')).text).toBe('SWAP');
  });

  it('takes the last else-if branch', () => {
    expect(processMacros(TEMPLATE, withVar('mode', 'ensemble')).text).toBe('ENSEMBLE');
  });

  it('falls through to else when nothing matches', () => {
    expect(processMacros(TEMPLATE, withVar('mode', 'other')).text).toBe('UNKNOWN');
  });

  it('supports space-form else-if too', () => {
    const result = processMacros(
      '{{if .x == 1}}one{{else if .x == 2}}two{{else}}many{{/if}}',
      withVar('x', '2'),
    );
    expect(result.text).toBe('two');
  });
});

// ============================================================================
// {{trim}} BLOCK + BARE FORMS
// ============================================================================

describe('{{trim}} block and bare forms', () => {
  it('block form trims the enclosed content', () => {
    const result = processMacros('a[{{trim}}  spaced out  {{/trim}}]b', ctx());
    expect(result.text).toBe('a[spaced out]b');
  });

  it('bare {{trim}} collapses surrounding whitespace (ST semantics)', () => {
    const result = processMacros('left  \n {{trim}} \n  right', ctx());
    expect(result.text).toBe('leftright');
  });

  it('inline {{trim::text}} still works', () => {
    expect(quickExpand('{{trim::  x  }}', ctx())).toBe('x');
  });

  it('silently consumes an orphaned {{/trim}}', () => {
    const result = processMacros('a{{/trim}}b', ctx());
    expect(result.text).toBe('ab');
  });
});

// ============================================================================
// {{rcounter::name}}
// ============================================================================

describe('{{rcounter::name}}', () => {
  it('numbers sequentially within one evaluation', () => {
    const result = processMacros(
      'Step {{rcounter::step}}. Step {{rcounter::step}}. Step {{rcounter::step}}.',
      ctx(),
    );
    expect(result.text).toBe('Step 1. Step 2. Step 3.');
  });

  it('tracks separate names independently', () => {
    const result = processMacros(
      '{{rcounter::a}}-{{rcounter::b}}-{{rcounter::a}}',
      ctx(),
    );
    expect(result.text).toBe('1-1-2');
  });

  it('continues across calls sharing one context (multi-block prompt build)', () => {
    const shared = ctx();
    expect(processMacros('{{rcounter::step}}', shared).text).toBe('1');
    expect(processMacros('{{rcounter::step}}', shared).text).toBe('2');
  });

  it('resets with a fresh context (next generation)', () => {
    expect(processMacros('{{rcounter::step}}', ctx()).text).toBe('1');
    expect(processMacros('{{rcounter::step}}', ctx()).text).toBe('1');
  });

  it('poisons result cacheability (volatile)', () => {
    const result = processMacros('{{rcounter::step}}', ctx());
    expect(result.cacheable).toBe(false);
  });
});

// ============================================================================
// {{reasoningPrefix}} / {{reasoningSuffix}}
// ============================================================================

describe('reasoning prefix/suffix macros', () => {
  it('defaults to <think> / </think>', () => {
    expect(quickExpand('{{reasoningPrefix::raw}}', ctx())).toBe('<think>');
    expect(quickExpand('{{reasoningSuffix::raw}}', ctx())).toBe('</think>');
  });

  it('respects context overrides', () => {
    const c = ctx({ reasoningPrefix: '<reasoning>', reasoningSuffix: '</reasoning>' });
    expect(quickExpand('{{reasoningPrefix}}', c)).toBe('<reasoning>');
    expect(quickExpand('{{reasoningSuffix}}', c)).toBe('</reasoning>');
  });
});

// ============================================================================
// GROUP-CARD MACROS
// ============================================================================

describe('group-card macros', () => {
  it('groupCardMode defaults to solo outside group chats', () => {
    expect(quickExpand('{{groupCardMode}}', ctx())).toBe('solo');
  });

  it('reflects the group mode and focused character in group context', () => {
    const c = ctx({
      groupCardMode: 'swap',
      focusedCharacterName: 'Mira',
      focusedCharacterDescription: 'A sly fox.',
      focusedCharacterPersonality: 'Cunning.',
      groupMembers: [
        { name: 'Stella' },
        { name: 'Mira' },
        { name: 'Juno' },
      ],
    });
    expect(quickExpand('{{groupCardMode}}', c)).toBe('swap');
    expect(quickExpand('{{charGroupFocused}}', c)).toBe('Mira');
    expect(quickExpand('{{charGroupFocusedDescription}}', c)).toBe('A sly fox.');
    expect(quickExpand('{{charGroupFocusedPersonality}}', c)).toBe('Cunning.');
    expect(quickExpand('{{groupOthers}}', c)).toBe('Stella, Juno');
  });

  it('falls back to the active character when no group focus is set', () => {
    const c = ctx({ characterDescription: 'A star.', characterPersonality: 'Bright.' });
    expect(quickExpand('{{charGroupFocused}}', c)).toBe('Stella');
    expect(quickExpand('{{charGroupFocusedDescription}}', c)).toBe('A star.');
    expect(quickExpand('{{charGroupFocusedPersonality}}', c)).toBe('Bright.');
    expect(quickExpand('{{groupOthers}}', c)).toBe('');
  });

  it('drives ThreadBare Character-block branching correctly', () => {
    const template =
      '{{if::{{groupCardMode}} == solo}}SOLO:{{char}}{{else}}FOCUS:{{charGroupFocused}}{{/if}}';
    expect(processMacros(template, ctx()).text).toBe('SOLO:Stella');
    const grouped = ctx({ groupCardMode: 'swap', focusedCharacterName: 'Mira' });
    expect(processMacros(template, grouped).text).toBe('FOCUS:Mira');
  });
});

// ============================================================================
// LUMIVERSE PLATFORM TOKENS (lumia*, spotify_*, etc.)
// ============================================================================

describe('Lumiverse platform tokens', () => {
  it('aliases lumiaDef/lumiaPersonality to RC character fields', () => {
    const c = ctx({ characterDescription: 'Desc here.', characterPersonality: 'Pers here.' });
    expect(quickExpand('{{lumiaDef}}', c)).toBe('Desc here.');
    expect(quickExpand('{{lumiaPersonality}}', c)).toBe('Pers here.');
  });

  it('resolves unavailable platform tokens to empty (not literal text)', () => {
    const tokens = [
      'lumiaCouncilModeActive', 'lumiaCouncilInst', 'lumiaCouncilDeliberation',
      'lumiaStateSynthesis', 'lumiaBehavior', 'lumiaOOC', 'lumiaOOCErotic',
      'lumiaOOCEroticBleed', 'spotify_track_name', 'spotify_artists',
      'spotify_album_art', 'spotify_album_name', 'spotify_has_lyrics',
      'spotify_is_playing', 'spotify_lyrics', 'sim_tracker', 'usercolormode',
      'isnarrator', 'wi_marker',
    ];
    for (const token of tokens) {
      expect(quickExpand(`{{${token}}}`, ctx()), token).toBe('');
    }
  });

  it('supports standalone {{eq::a::b}} (ThreadBare tracker pattern)', () => {
    expect(quickExpand('{{eq::none::none}}', ctx())).toBe('true');
    expect(quickExpand('{{eq::sweat::none}}', ctx())).toBe('false');
    expect(quickExpand('{{eq::None::none}}', ctx())).toBe('true'); // case-insensitive
  });

  it('keeps lumia-gated sections from falsely activating', () => {
    // Before this support, {{lumiaCouncilModeActive}} survived as literal
    // text — a truthy string — wrongly enabling Lumiverse-only sections.
    const result = processMacros(
      '{{if::{{lumiaCouncilModeActive}}}}COUNCIL{{else}}{{/if}}ok',
      ctx(),
    );
    expect(result.text).toBe('ok');
  });
});
