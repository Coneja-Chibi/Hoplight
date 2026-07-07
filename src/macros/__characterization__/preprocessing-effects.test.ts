// ============================================================================
// PREPROCESSING EFFECTS CHARACTERIZATION NET
// ============================================================================
// Pins the OBSERVABLE behavior of every preprocessing transform that runs
// inside processMacros() BEFORE the AST parse:
//
//   - dot-notation shorthand        ({{.v++}} -> incvar, {{.v -= 2}} -> addvar,
//                                     {{.v == 5}} -> compare, {{.v = 5}} -> setvar, …)
//   - dollar global shorthand       ({{$g}} -> getglobalvar) vs positional ({{$1}})
//   - space-form normalization      ({{getvar x}} -> getvar::x) vs non-allowlisted
//   - single-colon normalization    ({{getvar:x}} -> getvar::x) vs non-allowlisted
//   - comma re-split + \, escape    ({{random:a\, b,c}})
//   - legacy angle tokens           (<bot> -> char, <user> -> user)
//   - ORDERING interactions         (escaped braces vs dot-notation; char output
//                                     that looks like a macro is NOT re-expanded)
//
// CRITICAL: these are BEHAVIORAL assertions. The effect of each transform is
// observed through the PUBLIC surface only — the macro node that processMacros
// actually expanded (expansion.original / .macroName), the recorded side
// effects, the produced text, and (for the canonical TARGET form) the AST shape
// via __parseForTest. We do NOT call the internal preprocess*/split*/find*
// helpers — they get DELETED by the rewrite, so coupling to them would defeat
// the safety net.
//
// The observable proof that "input X was rewritten to macro Y" is that
// processMacros expanded a macro NAMED Y whose reconstructed `original` is the
// canonical `{{Y::…}}` form — even though raw __parseForTest(X) (which bypasses
// preprocessing) parses X as a single literal macro named after X's raw inner
// text. Both facts are pinned below so the rewrite cannot silently change the
// mapping.
//
// Tests must stay GREEN against the CURRENT implementation.
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import {
  __parseForTest,
  processMacros,
  createDefaultContext,
  type ASTNode,
  type MacroCallNode,
} from '../processor';
import { initializeMacros } from '../index';
import type { MacroContext } from '../types';

beforeAll(() => {
  initializeMacros();
});

// ----------------------------------------------------------------------------
// Helpers (test-local; do NOT reach into parser internals)
// ----------------------------------------------------------------------------

function ctx(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: 'TestChar',
    userName: 'TestUser',
    ...overrides,
  });
}

/** Context with a single local var `name=value` already set. */
function withLocal(name: string, value: string): MacroContext {
  const c = ctx();
  c.localVariables.set(name, { value, createdAt: new Date(), updatedAt: new Date() });
  return c;
}

/** Context with a single global var `name=value` already set. */
function withGlobal(name: string, value: string): MacroContext {
  const c = ctx();
  c.globalVariables.set(name, { value, createdAt: new Date(), updatedAt: new Date() });
  return c;
}

/** The macro names processMacros actually expanded, in order. */
function expandedNames(input: string, context: MacroContext): string[] {
  return processMacros(input, context).expansions.map(e => e.macroName);
}

/** The reconstructed `original` text of each expansion, in order. */
function expandedOriginals(input: string, context: MacroContext): string[] {
  return processMacros(input, context).expansions.map(e => e.original);
}

/** Assert the top-level AST is exactly one inline macro and return it. */
function soleMacro(input: string): MacroCallNode {
  const nodes: ASTNode[] = __parseForTest(input);
  expect(nodes).toHaveLength(1);
  expect(nodes[0].type).toBe('macro');
  return nodes[0] as MacroCallNode;
}

// ============================================================================
// DOT-NOTATION SHORTHAND -> variable macros
// ============================================================================
// Each {{.v <op>}} form must preprocess into a specific canonical macro. The
// observable proof is the macro processMacros expanded (name + reconstructed
// original) and the side effect it produced. We ALSO pin the AST shape of the
// canonical target via __parseForTest so the rewrite's output node is fixed.

describe('dot-notation: {{.v++}} -> incvar::v', () => {
  it('expands an incvar macro (not a literal ".v++" macro)', () => {
    const result = processMacros('{{.v++}}', withLocal('v', '5'));
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].macroName).toBe('incvar');
    expect(result.expansions[0].original).toBe('{{incvar::v}}');
    // Current behavior: incvar emits the incremented value (the seed read path
    // yields 1 here). We pin the OBSERVED value so the rewrite can't drift it.
    expect(result.text).toBe('1');
  });

  it('records an incvar-caused setLocalVar side effect on v', () => {
    const result = processMacros('{{.v++}}', withLocal('v', '5'));
    expect(result.sideEffects).toEqual([
      expect.objectContaining({ type: 'setLocalVar', key: 'v', cause: 'incvar' }),
    ]);
  });

  it('canonical target {{incvar::v}} parses to an incvar node with arg [v]', () => {
    const node = soleMacro('{{incvar::v}}');
    expect(node.name).toBe('incvar');
    expect(node.rawContent).toBe('incvar::v');
    expect(node.args).toHaveLength(1);
    expect(node.args[0]).toEqual([{ type: 'text', value: 'v' }]);
  });
});

describe('dot-notation: {{.v--}} -> decvar::v', () => {
  it('expands a decvar macro and decrements', () => {
    const result = processMacros('{{.v--}}', withLocal('v', '5'));
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].macroName).toBe('decvar');
    expect(result.expansions[0].original).toBe('{{decvar::v}}');
    expect(result.text).toBe('-1');
    expect(result.sideEffects).toEqual([
      expect.objectContaining({ type: 'setLocalVar', key: 'v', cause: 'decvar' }),
    ]);
  });
});

describe('dot-notation: {{.v += 2}} -> addvar::v::2', () => {
  it('expands an addvar macro with the positive delta', () => {
    const result = processMacros('{{.v += 2}}', withLocal('v', '5'));
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].macroName).toBe('addvar');
    expect(result.expansions[0].original).toBe('{{addvar::v::2}}');
    expect(result.sideEffects).toEqual([
      expect.objectContaining({ type: 'setLocalVar', key: 'v', cause: 'addvar' }),
    ]);
  });
});

describe('dot-notation: {{.v -= 2}} -> addvar::v::-2 (NEGATED delta)', () => {
  it('expands an addvar macro whose second arg is the negated value', () => {
    const result = processMacros('{{.v -= 2}}', withLocal('v', '5'));
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].macroName).toBe('addvar');
    // The key behavior: -= becomes addvar with a NEGATED literal, not subvar.
    expect(result.expansions[0].original).toBe('{{addvar::v::-2}}');
    expect(result.sideEffects).toEqual([
      expect.objectContaining({ type: 'setLocalVar', key: 'v', cause: 'addvar' }),
    ]);
  });

  it('canonical target {{addvar::v::-2}} parses to addvar node with args [v, -2]', () => {
    const node = soleMacro('{{addvar::v::-2}}');
    expect(node.name).toBe('addvar');
    expect(node.args).toHaveLength(2);
    expect(node.args[0]).toEqual([{ type: 'text', value: 'v' }]);
    expect(node.args[1]).toEqual([{ type: 'text', value: '-2' }]);
  });
});

describe('dot-notation: {{.v = 5}} -> setvar::v::5', () => {
  it('expands a setvar macro (single =, not compare)', () => {
    const result = processMacros('{{.v = 5}}', withLocal('v', '1'));
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].macroName).toBe('setvar');
    expect(result.expansions[0].original).toBe('{{setvar::v::5}}');
    expect(result.sideEffects).toEqual([
      expect.objectContaining({ type: 'setLocalVar', key: 'v', value: 5, cause: 'setvar' }),
    ]);
  });
});

describe('dot-notation: {{.v == 5}} -> compare over getvar', () => {
  it('rewrites to compare with a NESTED getvar LHS (two expansions: getvar then compare)', () => {
    const result = processMacros('{{.v == 5}}', withLocal('v', '5'));
    // Observable: the inner getvar fires first, then compare with the resolved value.
    expect(result.expansions.map(e => e.macroName)).toEqual(['getvar', 'compare']);
    expect(result.expansions[0].original).toBe('{{getvar::v}}');
    expect(result.expansions[1].original).toBe('{{compare::5::==::5}}');
    expect(result.text).toBe('true');
    expect(result.sideEffects).toEqual([]);
  });

  it('compare yields false when the values differ', () => {
    const result = processMacros('{{.v == 9}}', withLocal('v', '5'));
    expect(result.expansions.map(e => e.macroName)).toEqual(['getvar', 'compare']);
    expect(result.text).toBe('false');
  });

  for (const op of ['!=', '>=', '<=', '>', '<', '===', '!=='] as const) {
    it(`comparison operator ${op} routes through compare`, () => {
      const result = processMacros(`{{.v ${op} 5}}`, withLocal('v', '5'));
      expect(result.expansions.map(e => e.macroName)).toEqual(['getvar', 'compare']);
      expect(result.expansions[1].original).toBe(`{{compare::5::${op}::5}}`);
    });
  }
});

describe('dot-notation: {{.v}} -> getvar::v', () => {
  it('bare dot form reads the variable via getvar', () => {
    const result = processMacros('{{.v}}', withLocal('v', '42'));
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].macroName).toBe('getvar');
    expect(result.expansions[0].original).toBe('{{getvar::v}}');
    expect(result.text).toBe('42');
  });
});

// ============================================================================
// DOLLAR SHORTHAND: {{$name}} -> getglobalvar  BUT  {{$1}} stays positional
// ============================================================================

describe('dollar shorthand: {{$g}} -> getglobalvar::g', () => {
  it('an alpha-named $var becomes a getglobalvar read', () => {
    const result = processMacros('{{$g}}', withGlobal('g', 'world'));
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].macroName).toBe('getglobalvar');
    expect(result.expansions[0].original).toBe('{{getglobalvar::g}}');
    expect(result.text).toBe('world');
    expect(result.errors).toEqual([]);
  });

  it('canonical target {{getglobalvar::g}} parses to a getglobalvar node', () => {
    const node = soleMacro('{{getglobalvar::g}}');
    expect(node.name).toBe('getglobalvar');
    expect(node.args).toEqual([[{ type: 'text', value: 'g' }]]);
  });
});

describe('dollar positional: {{$1}} / {{$2}} are NOT getglobalvar', () => {
  it('{{$1}} is left as a positional macro (not rewritten) and is unknown by itself', () => {
    const result = processMacros('{{$1}}', ctx());
    // NOT rewritten to getglobalvar — no successful expansion, recorded as unknown.
    expect(result.expansions).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].macro).toBe('{{$1}}');
    // Pure-digit name is preserved verbatim in the output (positional reserved).
    expect(result.text).toBe('{{$1}}');
  });

  it('{{$2}} likewise stays a positional macro', () => {
    const result = processMacros('{{$2}}', ctx());
    expect(result.expansions).toEqual([]);
    expect(result.errors[0].macro).toBe('{{$2}}');
    expect(result.text).toBe('{{$2}}');
  });

  it('raw parse keeps the positional name "$1" verbatim as the macro name', () => {
    const node = soleMacro('{{$1}}');
    expect(node.name).toBe('$1');
    expect(node.args).toEqual([]);
  });
});

// ============================================================================
// SPACE-FORM NORMALIZATION: {{getvar x}} -> getvar::x  (allowlist only)
// ============================================================================

describe('space-form: allowlisted {{getvar x}} -> getvar::x', () => {
  it('one-arg space form normalizes to a getvar macro read', () => {
    const result = processMacros('{{getvar x}}', withLocal('x', 'val'));
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].macroName).toBe('getvar');
    expect(result.expansions[0].original).toBe('{{getvar::x}}');
    expect(result.text).toBe('val');
    expect(result.errors).toEqual([]);
  });

  it('two-arg space form {{setvar x y}} -> setvar::x::y', () => {
    const result = processMacros('{{setvar x y}}', ctx());
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].macroName).toBe('setvar');
    expect(result.expansions[0].original).toBe('{{setvar::x::y}}');
    expect(result.sideEffects).toEqual([
      expect.objectContaining({ type: 'setLocalVar', key: 'x', value: 'y', cause: 'setvar' }),
    ]);
  });

  it('{{roll 1d20}} normalizes to a roll macro (allowlisted, deterministic name)', () => {
    expect(expandedNames('{{roll 1d20}}', ctx())).toEqual(['roll']);
    expect(expandedOriginals('{{roll 1d20}}', ctx())).toEqual(['{{roll::1d20}}']);
  });
});

describe('space-form: NON-allowlisted {{foo x}} is NOT normalized', () => {
  it('a non-allowlisted name keeps the space and is an unknown macro named "foo x"', () => {
    const result = processMacros('{{foo x}}', ctx());
    expect(result.expansions).toEqual([]);
    expect(result.errors).toHaveLength(1);
    // The whole inner (with the space) is the macro name — NOT split into foo::x.
    expect(result.errors[0].macro).toBe('{{foo x}}');
    expect(result.text).toBe('{{foo x}}');
  });

  it('raw parse confirms the macro name retains the embedded space', () => {
    const node = soleMacro('{{foo x}}');
    expect(node.name).toBe('foo x');
    expect(node.args).toEqual([]);
  });
});

// ============================================================================
// SINGLE-COLON NORMALIZATION: {{getvar:x}} -> getvar::x  (allowlist only)
// ============================================================================

describe('single-colon: allowlisted {{getvar:x}} -> getvar::x', () => {
  it('a single colon on an allowlisted name normalizes to ::', () => {
    const result = processMacros('{{getvar:mood}}', withLocal('mood', 'calm'));
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].macroName).toBe('getvar');
    expect(result.expansions[0].original).toBe('{{getvar::mood}}');
    expect(result.text).toBe('calm');
  });

  it('{{setvar:x:5}} normalizes both colons -> setvar::x::5', () => {
    const result = processMacros('{{setvar:x:5}}', ctx());
    expect(result.expansions[0].macroName).toBe('setvar');
    expect(result.expansions[0].original).toBe('{{setvar::x::5}}');
    expect(result.sideEffects).toEqual([
      // setvar coerces a numeric-looking value, so the stored value is 5 (number).
      expect.objectContaining({ type: 'setLocalVar', key: 'x', value: 5, cause: 'setvar' }),
    ]);
  });

  it('canonical :: form {{random::a::b}} is left unchanged (idempotent)', () => {
    // Single-colon normalization must NOT touch already-canonical content: the
    // macro still parses with BOTH options, and the reconstructed original keeps
    // both args (the picked value is one of them).
    const result = processMacros('{{random::a::b}}', ctx());
    expect(result.expansions.map(e => e.macroName)).toEqual(['random']);
    expect(result.expansions[0].original).toBe('{{random::a::b}}');
    expect(['a', 'b']).toContain(result.text);
  });
});

describe('single-colon: NON-allowlisted {{upper:x}} stays a literal name', () => {
  it('upper is not in the colon allowlist, so {{upper:x}} is an unknown macro', () => {
    const result = processMacros('{{upper:x}}', ctx());
    expect(result.expansions).toEqual([]);
    expect(result.errors).toHaveLength(1);
    // The single colon is NOT promoted to :: — the name is the literal "upper:x".
    expect(result.errors[0].macro).toBe('{{upper:x}}');
    expect(result.text).toBe('{{upper:x}}');
  });

  it('raw parse confirms the macro name is the literal "upper:x"', () => {
    const node = soleMacro('{{upper:x}}');
    expect(node.name).toBe('upper:x');
    expect(node.args).toEqual([]);
  });
});

// ============================================================================
// COMMA RE-SPLIT + \, ESCAPE  (single-colon random/pick family)
// ============================================================================

describe('comma re-split with \\, escape', () => {
  it('an allowlisted single-colon {{random:a,b,c}} splits options on commas', () => {
    // Each option is a distinct choice; over the option set the picked value is
    // always one of the three.
    const result = processMacros('{{random:a,b,c}}', ctx());
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].macroName).toBe('random');
    expect(['a', 'b', 'c']).toContain(result.text);
  });

  it('escaped commas \\, keep the comma INSIDE an option (not a split point)', () => {
    // Two options only: "hello, world" and "goodbye, world". The picked text
    // must therefore contain a literal comma-space and end with "world".
    const result = processMacros(
      '{{random:hello\\, world,goodbye\\, world}}',
      ctx(),
    );
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].macroName).toBe('random');
    expect(['hello, world', 'goodbye, world']).toContain(result.text);
    expect(result.text).toContain(', world');
  });
});

// ============================================================================
// LEGACY ANGLE TOKENS: <bot>/<char> -> char ; <user> -> user
// ============================================================================

describe('angle tokens: <bot> and <char> -> {{char}}, <user> -> {{user}}', () => {
  it('<bot> becomes the char macro (NOT a literal "<bot>")', () => {
    const result = processMacros('<bot>', ctx());
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].macroName).toBe('char');
    expect(result.expansions[0].original).toBe('{{char}}');
    expect(result.text).toBe('TestChar');
  });

  it('<char> becomes the char macro', () => {
    expect(expandedNames('<char>', ctx())).toEqual(['char']);
    expect(processMacros('<char>', ctx()).text).toBe('TestChar');
  });

  it('<user> becomes the user macro', () => {
    const result = processMacros('<user>', ctx());
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].macroName).toBe('user');
    expect(result.text).toBe('TestUser');
  });

  it('angle tokens are case-insensitive: <Bot> / <USER>', () => {
    expect(processMacros('<Bot>', ctx()).text).toBe('TestChar');
    expect(processMacros('<USER>', ctx()).text).toBe('TestUser');
  });

  it('non-token angle content (<div>) is left untouched as literal text', () => {
    const result = processMacros('<div>x</div>', ctx());
    expect(result.expansions).toEqual([]);
    expect(result.text).toBe('<div>x</div>');
  });

  it('raw parse (pre-preprocess bypass) sees <bot> as plain text', () => {
    const nodes = __parseForTest('<bot>');
    expect(nodes).toEqual([{ type: 'text', value: '<bot>' }]);
  });
});

// ============================================================================
// ORDERING INTERACTIONS
// ============================================================================

describe('ordering: escaped braces adjacent to dot-notation', () => {
  it('escaped \\{\\{.v\\}\\} stays a LITERAL while the adjacent {{.v++}} still expands', () => {
    const result = processMacros('\\{\\{.v\\}\\}{{.v++}}', withLocal('v', '5'));
    // The escaped run must survive as literal "{{.v}}" (no getvar fired for it);
    // only the real macro expands -> incvar.
    expect(result.expansions.map(e => e.macroName)).toEqual(['incvar']);
    expect(result.text).toBe('{{.v}}1');
    expect(result.sideEffects).toEqual([
      expect.objectContaining({ type: 'setLocalVar', key: 'v', cause: 'incvar' }),
    ]);
  });

  it('a fully escaped dot macro alone never expands', () => {
    const result = processMacros('\\{\\{.v++\\}\\}', withLocal('v', '5'));
    expect(result.expansions).toEqual([]);
    expect(result.sideEffects).toEqual([]);
    expect(result.text).toBe('{{.v++}}');
  });
});

describe('ordering: char output that resembles a (preprocessed) token is NOT re-preprocessed', () => {
  it('an angle token inside the char VALUE is NOT re-converted to char', () => {
    // Angle preprocessing runs once over the TEMPLATE, before evaluation. The
    // char macro then resolves to a value that happens to contain "<bot>"; that
    // value must NOT be fed back through angle preprocessing (no second char).
    const result = processMacros('<char>', ctx({ characterName: '<bot> the brave' }));
    expect(result.expansions.map(e => e.macroName)).toEqual(['char']);
    expect(result.text).toBe('<bot> the brave');
  });

  it('a dot-notation-looking string inside the char VALUE IS normalized on re-parse', () => {
    // VVS-609: expansion values normalize sugar (dot/space/single-colon) like
    // top-level text, so a card field surfaced via {{scenario}} whose dot-vars
    // are nested in {{switch}}/{{if}} resolves. A canonical {{setvar::x::5}} in
    // an expansion already re-executed under the old re-parse; this only makes
    // the sugar consistent. Downside: an identity value that literally contains
    // {{.x}} now reads var x (empty here) instead of staying literal — an
    // acceptable edge vs. the reported card-field breakage.
    const result = processMacros('<char>', ctx({ characterName: '{{.x}}' }));
    expect(result.expansions.map(e => e.macroName)).toEqual(['char', 'getvar']);
    expect(result.text).toBe('');
  });

  it('angle-token runs BEFORE dot-notation: <bot> inside a dot value becomes {{char}}', () => {
    // Preprocessing order is observable here: <bot> -> {{char}} happens first,
    // so {{.greeting = <bot>}} becomes {{setvar::greeting::{{char}}}}. The char
    // macro resolves once (to the character name) and getvar reads it back; the
    // resolved value is NOT re-expanded as a further macro.
    const result = processMacros('{{.greeting = <bot>}}{{.greeting}}', ctx());
    expect(result.expansions.map(e => e.macroName)).toEqual(['char', 'setvar', 'getvar']);
    expect(result.expansions[1].original).toBe('{{setvar::greeting::TestChar}}');
    expect(result.expansions[2].original).toBe('{{getvar::greeting}}');
    expect(result.sideEffects).toEqual([
      expect.objectContaining({ type: 'setLocalVar', key: 'greeting', value: 'TestChar', cause: 'setvar' }),
    ]);
    expect(result.text).toBe('TestChar');
  });
});
