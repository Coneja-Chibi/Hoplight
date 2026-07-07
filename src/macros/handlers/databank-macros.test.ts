// ============================================================================
// DATABANK MACRO POPULATION TESTS
// ============================================================================
// Guards the macros a "Databank" preset prompt relies on ({{user}}, {{persona}},
// {{char}}, {{group}}, {{personality}}, {{description}}, {{scenario}}). The
// context shape mirrors what prompt-assembly.ts builds at the createDefaultContext
// call site, so these tests prove the macros resolve against the same fields the
// real prompt pipeline populates — not just that the handlers exist.

import { describe, it, expect, beforeAll } from 'vitest';
import { processMacros, createDefaultContext } from '../processor';
import { initializeMacros } from '../index';
import { MacroContext } from '../types';

beforeAll(() => {
  initializeMacros();
});

// Mirrors prompt-assembly.ts:917 — the fields the assembler feeds into the macro
// context. userPersona is set later (persona load) but is part of the same object.
function createDatabankContext(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: 'Seraphina',
    characterDescription: 'A tall knight with a sun-scarred face and a quiet voice.',
    characterPersonality: 'Stoic, protective, dryly funny.',
    scenario: 'The travelers shelter from a storm in a ruined chapel.',
    userName: 'Aldric',
    userPersona: '<persona>A wandering cartographer, curious and soft-spoken.</persona>',
    ...overrides,
  });
}

const expand = (text: string, ctx: MacroContext) => processMacros(text, ctx).text;

describe('Databank macros populate from the prompt-assembly context', () => {
  it('{{user}} resolves to the user name', () => {
    expect(expand('{{user}}', createDatabankContext())).toBe('Aldric');
  });

  it('{{persona}} resolves to the loaded persona content', () => {
    expect(expand('{{persona}}', createDatabankContext())).toBe(
      '<persona>A wandering cartographer, curious and soft-spoken.</persona>'
    );
  });

  it('{{char}} resolves to the character name', () => {
    expect(expand('{{char}}', createDatabankContext())).toBe('Seraphina');
  });

  it('{{personality}} resolves to the character personality field', () => {
    expect(expand('{{personality}}', createDatabankContext())).toBe(
      'Stoic, protective, dryly funny.'
    );
  });

  it('{{description}} resolves to the character description field', () => {
    expect(expand('{{description}}', createDatabankContext())).toBe(
      'A tall knight with a sun-scarred face and a quiet voice.'
    );
  });

  it('{{scenario}} resolves to the scenario field', () => {
    expect(expand('{{scenario}}', createDatabankContext())).toBe(
      'The travelers shelter from a storm in a ruined chapel.'
    );
  });
});

describe('{{group}} falls back to the character name outside a group chat', () => {
  it('uses the character name when no group is set (solo chat)', () => {
    expect(expand('{{group}}', createDatabankContext())).toBe('Seraphina');
  });

  it('matches {{char}} in a solo chat', () => {
    const ctx = createDatabankContext();
    expect(expand('{{group}}', ctx)).toBe(expand('{{char}}', ctx));
  });

  it('uses the group name when one is set (group chat)', () => {
    const ctx = createDatabankContext({ groupName: 'The Stormwatch Party' });
    expect(expand('{{group}}', ctx)).toBe('The Stormwatch Party');
  });
});

describe('A full Databank-style block expands every field', () => {
  it('substitutes user, persona, character, and scenario fields together', () => {
    const template = [
      'Name: {{user}}',
      'Info: {{persona}}',
      'Name: {{group}}',
      'Personality: {{personality}}',
      'Full Info: {{description}}',
      '{{scenario}}',
    ].join('\n');

    const result = expand(template, createDatabankContext());

    expect(result).toBe(
      [
        'Name: Aldric',
        'Info: <persona>A wandering cartographer, curious and soft-spoken.</persona>',
        'Name: Seraphina',
        'Personality: Stoic, protective, dryly funny.',
        'Full Info: A tall knight with a sun-scarred face and a quiet voice.',
        'The travelers shelter from a storm in a ruined chapel.',
      ].join('\n')
    );
    // No macro should survive unexpanded.
    expect(result).not.toContain('{{');
  });
});
