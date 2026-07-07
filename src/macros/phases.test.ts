// ============================================================================
// EVALUATION PHASES TESTS (macro engine spec Part VIII)
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { processMacros, createDefaultContext } from './processor';
import { initializeMacros } from './index';
import { MacroContext } from './types';
import { processPhasedBlocks, containsPhaseMacros, type PhasedBlock } from './phases';

beforeAll(() => {
  initializeMacros();
});

function ctx(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: 'TestChar',
    userName: 'TestUser',
    messages: [{ role: 'user', content: 'hi' }],
    messageCount: 1,
    ...overrides,
  });
}

function phased(blocks: PhasedBlock[], context: MacroContext): Map<string, string> {
  return processPhasedBlocks(blocks, (text) => processMacros(text, context).text);
}

describe('containsPhaseMacros', () => {
  it('detects phase-aware macros cheaply', () => {
    expect(containsPhaseMacros('{{phase::pre_render::x}}')).toBe(true);
    expect(containsPhaseMacros('{{defer:: x }}')).toBe(true);
    expect(containsPhaseMacros('{{after::id::x}}')).toBe(true);
    expect(containsPhaseMacros('{{getvar::x}} plain')).toBe(false);
  });
});

describe('processPhasedBlocks', () => {
  it('pre_render runs before earlier blocks render ("init before HEARTTHROB")', () => {
    // Block order: init (reads callsign) comes BEFORE the Director prompt
    // (sets callsign in pre_render). Without phases, init sees stale state.
    const context = ctx();
    const result = phased([
      { id: 'init', text: 'Director: {{getvar::callsign}}' },
      { id: 'heartthrob', text: '{{phase::pre_render::{{state.set::session:callsign::HEARTTHROB}}}}Romance rules.' },
    ], context);

    expect(result.get('init')).toBe('Director: HEARTTHROB');
    expect(result.get('heartthrob')).toBe('Romance rules.');
  });

  it('phase::render is inline sugar (normal order)', () => {
    const context = ctx();
    const result = phased([
      { id: 'a', text: '{{phase::render::{{state.set::session:x::1}}}}x={{getvar::x}}' },
    ], context);
    expect(result.get('a')).toBe('x=1');
  });

  it('post_render and defer see state set by LATER blocks', () => {
    const context = ctx();
    const result = phased([
      { id: 'summary', text: 'Final director: {{defer::{{getvar::callsign}}}}' },
      { id: 'late', text: '{{state.set::session:callsign::SCORIA}}' },
    ], context);
    expect(result.get('summary')).toBe('Final director: SCORIA');
  });

  it('after:: blocks read state from the named (later) prompt', () => {
    const context = ctx();
    const result = phased([
      { id: 'early', text: '{{after::hp_dir_close::Current: {{getvar::callsign}}}}' },
      { id: 'hp_dir_close', text: '{{state.set::session:callsign::VICE}}closing.' },
    ], context);
    expect(result.get('early')).toBe('Current: VICE');
    expect(result.get('hp_dir_close')).toBe('closing.');
  });

  it('evaluation order: pre_render → render → after → post_render → defer', () => {
    const context = ctx();
    phased([
      { id: 'a', text: '{{defer::{{addvar::order::D}}}}{{phase::post_render::{{addvar::order::C}}}}{{addvar::order::B}}' },
      { id: 'b', text: '{{phase::pre_render::{{addvar::order::A}}}}' },
    ], context);
    expect(context.localVariables.get('order')?.value).toBe('ABCD');
  });

  it('blocks without phase macros pass through unchanged', () => {
    const context = ctx();
    const result = phased([
      { id: 'plain', text: 'Hello {{char}}, no phases here.' },
    ], context);
    expect(result.get('plain')).toBe('Hello TestChar, no phases here.');
  });

  it('never leaks sentinel characters', () => {
    const context = ctx();
    const result = phased([
      { id: 'a', text: 'A{{phase::pre_render::{{noop}}}}B{{defer::C}}D' },
    ], context);
    expect(result.get('a')).toBe('ABCD');
    expect(result.get('a')).not.toContain('\x03');
  });
});

describe('inline fallbacks (outside the orchestrator)', () => {
  it('phase/defer/after render their body inline through processMacros', () => {
    const context = ctx();
    expect(processMacros('{{phase::pre_render::hello}}', context).text).toBe('hello');
    expect(processMacros('{{defer::world}}', context).text).toBe('world');
    expect(processMacros('{{after::some_id::content}}', context).text).toBe('content');
    expect(processMacros('{{phase::pre_render::hello}}', context).errors).toHaveLength(0);
  });
});
