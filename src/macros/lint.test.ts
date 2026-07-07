// ============================================================================
// MACRO LINT TESTS (macro engine spec Part IV.7)
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { initializeMacros } from './index';
import { lintMacros, scanMacros, type LintInput } from './lint';

beforeAll(() => {
  initializeMacros();
});

function lint(prompts: LintInput['prompts'], macroEngineConfig?: unknown) {
  return lintMacros({ prompts, macroEngineConfig });
}

describe('scanMacros', () => {
  it('finds nested macros', () => {
    const names = scanMacros('{{upper::{{getvar::x}}}} and {{count::pool}}').map(m => m.name);
    expect(names).toEqual(['upper', 'getvar', 'count']);
  });

  it('ignores comments', () => {
    expect(scanMacros('{{// just a note}}')).toHaveLength(0);
  });
});

describe('lintMacros', () => {
  it('flags unknown macros with a suggestion', () => {
    const findings = lint([
      { identifier: 'main', content: 'Hello {{getvarr::x}}' },
    ]);
    const f = findings.find(f => f.rule === 'unknown-macro');
    expect(f).toBeDefined();
    expect(f!.message).toContain('getvar');
  });

  it('does not flag known macros, block syntax, or user-defined macros', () => {
    const findings = lint([
      { identifier: 'a', content: '{{macro::my_thing::body}} {{if .x}}yes{{else}}no{{/if}}' },
      { identifier: 'b', content: '{{my_thing}} {{state.set::session:x::1}}' },
    ]);
    expect(findings.filter(f => f.rule === 'unknown-macro')).toHaveLength(0);
  });

  it('flags unbalanced if blocks', () => {
    const findings = lint([
      { identifier: 'main', name: 'Main', content: '{{if .flag}}content without closing' },
    ]);
    expect(findings.find(f => f.rule === 'unbalanced-if')?.severity).toBe('error');
  });

  it('flags reads of variables nothing sets, as info', () => {
    const findings = lint([
      { identifier: 'main', content: 'Director: {{getvar::active_dir_sense_res}}' },
    ]);
    const f = findings.find(f => f.rule === 'dangling-read');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('info');
  });

  it('does not flag reads satisfied by writers, hooks, or in-reply asks', () => {
    const findings = lint(
      [
        { identifier: 'writer', content: '{{state.set::session:callsign::X}}{{pick_in_reply::Q::A::B::into=session:next_dir}}' },
        { identifier: 'reader', content: '{{getvar::callsign}} {{getvar::next_dir}} {{getvar::hooked}}' },
      ],
      { events: { e: { pattern: '[E: $v]', do: 'set session:hooked = $v' } } }
    );
    expect(findings.filter(f => f.rule === 'dangling-read')).toHaveLength(0);
  });

  it('warns when the only writer is a disabled prompt', () => {
    const findings = lint([
      { identifier: 'writer', content: '{{setvar::mood::tense}}', enabled: false },
      { identifier: 'reader', content: '{{getvar::mood}}', enabled: true },
    ]);
    expect(findings.find(f => f.rule === 'write-disabled')?.severity).toBe('warning');
  });

  it('flags unknown prompt references but allows prefix selectors', () => {
    const findings = lint([
      { identifier: 'hp_dir_heartthrob', content: 'data' },
      { identifier: 'main', content: '{{when_enabled::hp_dir_::roster}} {{when_enabled::hp_nope::x}} {{include::missing_prompt}}' },
    ]);
    const refs = findings.filter(f => f.rule === 'unknown-prompt-ref');
    expect(refs).toHaveLength(2);
    expect(refs.map(r => r.macro)).toEqual([
      expect.stringContaining('hp_nope'),
      expect.stringContaining('missing_prompt'),
    ]);
  });

  it('flags use_template without a definition', () => {
    const findings = lint([
      { identifier: 'main', content: '{{use_template::director_register::callsign: X}}' },
    ]);
    expect(findings.find(f => f.rule === 'unknown-template')?.severity).toBe('error');
  });

  it('flags override declared after its block', () => {
    const findings = lint([
      { identifier: 'early', content: '{{block::cot::default}}' },
      { identifier: 'late', content: '{{override::cot::custom}}' },
    ]);
    expect(findings.find(f => f.rule === 'override-after-block')).toBeDefined();

    const ok = lint([
      { identifier: 'early', content: '{{override::cot::custom}}' },
      { identifier: 'late', content: '{{block::cot::default}}' },
    ]);
    expect(ok.find(f => f.rule === 'override-after-block')).toBeUndefined();
  });

  it('flags off-band $ call cost as info, skipping disabled prompts', () => {
    const findings = lint([
      { identifier: 'a', content: '{{pick$::Q::A::B}} {{ask_model$::Q2}}', enabled: true },
      { identifier: 'b', content: '{{pick$::Q3::A::B}}', enabled: false },
    ]);
    const f = findings.find(f => f.rule === 'offband-cost');
    expect(f?.severity).toBe('info');
    expect(f?.message).toContain('2 off-band');
  });

  it('clean preset produces no findings', () => {
    const findings = lint([
      { identifier: 'a', content: '{{template::t::Hello $x}}{{setvar::pool::1}}' },
      { identifier: 'b', content: '{{use_template::t::x: world}} {{getvar::pool}} {{char}} {{first_turn::Welcome}}' },
    ]);
    expect(findings).toEqual([]);
  });
});
