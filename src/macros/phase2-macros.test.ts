// ============================================================================
// MACRO ENGINE PHASE 2 TESTS — in-reply asks + composition/templates
// Spec rev 2, Parts III.1 and V.1/V.2. (Hook/event engine tests live in
// hooks.test.ts.)
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { processMacros, createDefaultContext } from './processor';
import { initializeMacros } from './index';
import { MacroContext, MacroVariable, PresetPromptInfo } from './types';
import { runMacroHooks, IN_REPLY_ASKS_KEY, type InReplyAsk } from './hooks';

beforeAll(() => {
  initializeMacros();
});

function makeVar(value: MacroVariable['value']): MacroVariable {
  return { value, createdAt: new Date(), updatedAt: new Date() };
}

const PROMPTS: PresetPromptInfo[] = [
  {
    id: 'uuid-1', identifier: 'hp_cot_standard', name: 'Standard CoT', enabled: true,
    content: 'Think step by step about {{getvar::callsign}}.',
  },
  { id: 'uuid-2', identifier: 'hp_dir_main', name: 'Main', enabled: true, content: 'Main body' },
];

function ctx(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: 'TestChar',
    characterId: 'char-1',
    userName: 'TestUser',
    messages: [{ role: 'user', content: 'hi' }],
    messageCount: 1,
    presetPrompts: PROMPTS,
    ...overrides,
  });
}

// ============================================================================
// IN-REPLY ASK MACROS
// ============================================================================

describe('pick_in_reply', () => {
  it('renders an instruction and registers the ask', () => {
    const context = ctx();
    const result = processMacros(
      '{{pick_in_reply::Pick the next Director.::HEARTTHROB::SCORIA::into=session:callsign}}',
      context
    );
    expect(result.text).toContain('[SET CALLSIGN:');
    expect(result.text).toContain('HEARTTHROB, SCORIA');
    expect(result.text).toContain('Pick the next Director.');

    const registry = context.localVariables.get(IN_REPLY_ASKS_KEY)?.value as unknown as Record<string, InReplyAsk>;
    expect(registry.CALLSIGN).toMatchObject({
      into: 'callsign',
      mode: 'pick',
      options: ['HEARTTHROB', 'SCORIA'],
    });
  });

  it('full loop: ask renders → reply captured → variable committed', () => {
    const context = ctx();
    processMacros(
      '{{pick_in_reply::Pick the next Director.::HEARTTHROB::SCORIA::into=session:callsign}}',
      context
    );

    // Simulate the post-generation hook pass on the narrator's reply
    const vars = {
      local: new Map([...context.localVariables].map(([k, v]) => [k, v.value])),
      global: new Map(),
      characterId: 'char-1',
    };
    const result = runMacroHooks('[SET CALLSIGN: scoria]\nShe steps onto the stage.', null, vars);

    expect(vars.local.get('callsign')).toBe('SCORIA');
    expect(result.text.trim()).toBe('She steps onto the stage.');
    expect(vars.local.has(IN_REPLY_ASKS_KEY)).toBe(false);
  });

  it('errors without into= or options', () => {
    const context = ctx();
    expect(processMacros('{{pick_in_reply::Question::A::B}}', context).errors).toHaveLength(1);
    expect(processMacros('{{pick_in_reply::Question::into=session:x}}', context).errors).toHaveLength(1);
  });

  it('respects custom tag= and global into', () => {
    const context = ctx();
    processMacros(
      '{{ask_in_reply::Theme?::into=global:theme::tag=THEME_PICK}}',
      context
    );
    const registry = context.localVariables.get(IN_REPLY_ASKS_KEY)?.value as unknown as Record<string, InReplyAsk>;
    expect(registry.THEME_PICK).toMatchObject({ into: 'global:theme', mode: 'ask' });
  });

  it('pick_in_reply_or_keep renders nothing when the variable is set', () => {
    const context = ctx({ localVariables: new Map([['callsign', makeVar('VICE')]]) });
    const result = processMacros(
      '{{pick_in_reply_or_keep::Pick.::A::B::into=session:callsign}}',
      context
    );
    expect(result.text).toBe('');
    expect(context.localVariables.has(IN_REPLY_ASKS_KEY)).toBe(false);
  });

  it('registers nothing in readOnly mode', () => {
    const context = ctx({ readOnly: true });
    const result = processMacros(
      '{{pick_in_reply::Pick.::A::B::into=session:x}}',
      context
    );
    expect(result.text).toBe('');
    expect(context.localVariables.has(IN_REPLY_ASKS_KEY)).toBe(false);
  });

  it('multiple asks accumulate in the registry', () => {
    const context = ctx();
    processMacros('{{pick_in_reply::Director?::A::B::into=session:callsign}}', context);
    processMacros('{{ask_in_reply::Mood?::into=session:mood}}', context);
    const registry = context.localVariables.get(IN_REPLY_ASKS_KEY)?.value as unknown as Record<string, InReplyAsk>;
    expect(Object.keys(registry).sort()).toEqual(['CALLSIGN', 'MOOD']);
  });
});

// ============================================================================
// TEMPLATES & COMPOSITION
// ============================================================================

describe('template / use_template', () => {
  it('defines silently and instantiates with $param substitution', () => {
    const context = ctx();
    const defResult = processMacros(
      '{{template::greet::Hello $name, welcome to $place!}}',
      context
    );
    expect(defResult.text).toBe('');

    const useResult = processMacros(
      '{{use_template::greet::name: Levi\nplace: the stage}}',
      context
    );
    expect(useResult.text).toBe('Hello Levi, welcome to the stage!');
  });

  it('macros inside the template body expand at use time', () => {
    const context = ctx();
    processMacros(
      '{{template::director_register::{{state.set::session:callsign::$callsign}}{{state.set::session:genre_label::$genre_label}}}}',
      context
    );
    const result = processMacros(
      '{{use_template::director_register::callsign: HEARTTHROB\ngenre_label: Romance}}',
      context
    );
    expect(result.text).toBe('');
    expect(context.localVariables.get('callsign')?.value).toBe('HEARTTHROB');
    expect(context.localVariables.get('genre_label')?.value).toBe('Romance');
  });

  it('defining a template does NOT fire macros inside its body', () => {
    const context = ctx();
    processMacros('{{template::trap::{{state.set::session:fired::yes}}}}', context);
    expect(context.localVariables.has('fired')).toBe(false);
  });

  it('unknown template is a reported error', () => {
    const context = ctx();
    const result = processMacros('{{use_template::missing::a: b}}', context);
    expect(result.errors).toHaveLength(1);
  });
});

describe('include', () => {
  it("inlines another prompt's content and expands its macros", () => {
    const context = ctx({ localVariables: new Map([['callsign', makeVar('SCORIA')]]) });
    const result = processMacros('Before. {{include::hp_cot_standard}} After.', context);
    expect(result.text).toBe('Before. Think step by step about SCORIA. After.');
  });

  it('unknown prompt id is a reported error', () => {
    const result = processMacros('{{include::nope}}', ctx());
    expect(result.errors).toHaveLength(1);
  });
});

describe('block / override', () => {
  it('renders the default when no override exists', () => {
    const context = ctx();
    expect(processMacros('{{block::cot::standard CoT}}', context).text).toBe('standard CoT');
  });

  it('renders the override when registered earlier', () => {
    const context = ctx();
    processMacros('{{override::cot::HEARTTHROB CoT}}', context);
    expect(processMacros('{{block::cot::standard CoT}}', context).text).toBe('HEARTTHROB CoT');
  });

  it('the untaken default branch never fires side effects', () => {
    const context = ctx();
    processMacros('{{override::cot::clean}}', context);
    processMacros('{{block::cot::{{state.set::session:leak::oops}}}}', context);
    expect(context.localVariables.has('leak')).toBe(false);
  });
});
