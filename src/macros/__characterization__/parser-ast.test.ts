// ============================================================================
// MACRO PARSER CHARACTERIZATION NET (AST + processMacros golden master)
// ============================================================================
// This is the behavioral safety net that guards the clean-room rewrite of the
// parsing front-end (preprocessing + parseNodes + helpers). It asserts BEHAVIOR
// only: input -> AST (via the test-only __parseForTest) and input ->
// processMacros() result. It does NOT touch parser internals
// (findMatchingClose / splitMacroArgs / preprocessDotNotation / etc.) because
// those helpers get DELETED by the rewrite — testing them would couple the net
// to the old implementation.
//
// Two layers of protection per CORPUS entry:
//   1. toMatchSnapshot() of the full parsed tree AND the processMacros result.
//      Snapshots are the broad change-detector: any structural drift trips.
//   2. Explicit, human-readable INVARIANT assertions for the load-bearing
//      classification edges the rewrite is most likely to get wrong (inline vs
//      block, comment body handling, orphan consumption, unterminated braces,
//      raw-content trimming, empty-arg structure, else-if nesting).
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
  type BlockIfNode,
} from '../processor';
import { initializeMacros } from '../index';
import { CORPUS, CORPUS_CATEGORY_COUNTS, type CorpusCategory } from './corpus';

beforeAll(() => {
  initializeMacros();
});

// ----------------------------------------------------------------------------
// Helpers (test-local; do NOT reach into parser internals)
// ----------------------------------------------------------------------------

/** Look up a CORPUS entry's raw input by id (keeps invariant tests readable). */
function inputOf(id: string): string {
  const entry = CORPUS.find(e => e.id === id);
  if (!entry) throw new Error(`CORPUS entry not found: ${id}`);
  return entry.input;
}

/** Parse a CORPUS entry by id. */
function parse(id: string): ASTNode[] {
  return __parseForTest(inputOf(id));
}

/** Run a fresh-context processMacros for a raw input. */
function run(input: string) {
  return processMacros(input, createDefaultContext());
}

/** Narrow assert: node is a macro call with the given (lowercased) name. */
function asMacro(node: ASTNode, name?: string): MacroCallNode {
  expect(node.type).toBe('macro');
  const m = node as MacroCallNode;
  if (name !== undefined) expect(m.name).toBe(name);
  return m;
}

/** Narrow assert: node is a blockIf. */
function asBlockIf(node: ASTNode): BlockIfNode {
  expect(node.type).toBe('blockIf');
  return node as BlockIfNode;
}

// Group the corpus by category so generated tests read in coherent blocks.
const BY_CATEGORY = CORPUS.reduce((acc, e) => {
  (acc[e.category] ??= []).push(e);
  return acc;
}, {} as Record<CorpusCategory, typeof CORPUS>);

const CATEGORY_ORDER: CorpusCategory[] = [
  'text',
  'inline',
  'escaped',
  'angle',
  'dotdollar',
  'spaceform',
  'singlecolon',
  'blockif',
  'trim',
  'setvar',
  'orphan',
  'comment',
  'unknown',
  'unterminated',
  'whitespace',
  'lazyvolatile',
  'template',
];

// ============================================================================
// LAYER 1: Full golden-master snapshots, grouped by CORPUS category
// ============================================================================
// For EVERY corpus entry we snapshot the parsed AST and the processMacros
// result. This is the wide net: it will catch any silent behavioral drift the
// targeted invariants below don't name explicitly.

describe('parser characterization: AST + processMacros snapshots', () => {
  for (const category of CATEGORY_ORDER) {
    const entries = BY_CATEGORY[category] ?? [];

    describe(`category: ${category} (${entries.length})`, () => {
      for (const entry of entries) {
        describe(entry.id, () => {
          it('parses to the golden AST', () => {
            const ast = __parseForTest(entry.input);
            expect(ast).toMatchSnapshot();
          });

          it('processMacros produces the golden result', () => {
            // Nondeterministic macros (random / roll / rcounter / foreach ...)
            // and side-effecting ones (setvar storing a random value) emit
            // values that change run-to-run, so their concrete output can't be a
            // stable golden master. processMacros flags this deterministically
            // via cacheable === false (set by volatileHit OR by any side effect)
            // — that flag does NOT depend on the random value itself, so it's a
            // reliable classifier (unlike comparing text across runs, which can
            // coincide for low-cardinality picks like {{random::a::b}}). For
            // non-cacheable inputs we snapshot only the deterministic SHAPE
            // (counts, names, side-effect keys) with value-bearing fields
            // redacted. Parsing is deterministic, so the AST snapshot above
            // still fully pins parser behavior either way.
            const result = run(entry.input);
            const deterministic = result.cacheable === true;
            const shapedStats = {
              totalMacros: result.stats.totalMacros,
              successfulExpansions: result.stats.successfulExpansions,
              failedExpansions: result.stats.failedExpansions,
              nestingDepthReached: result.stats.nestingDepthReached,
            };
            expect(
              deterministic
                ? {
                    text: result.text,
                    expansions: result.expansions,
                    errors: result.errors,
                    sideEffects: result.sideEffects,
                    touchedVariables: result.touchedVariables,
                    cacheable: result.cacheable,
                    stats: shapedStats,
                  }
                : {
                    volatile: true as const,
                    cacheable: result.cacheable,
                    errors: result.errors,
                    // Redact value-bearing fields; keep deterministic structure.
                    sideEffectShape: result.sideEffects.map(fx => ({
                      type: fx.type,
                      key: fx.key,
                      cause: fx.cause,
                    })),
                    touchedVariables: result.touchedVariables,
                    expandedMacroNames: result.expansions.map(e => e.macroName),
                    stats: shapedStats,
                  },
            ).toMatchSnapshot();
          });
        });
      }
    });
  }
});

// ============================================================================
// LAYER 2: Explicit behavioral invariants
// ============================================================================
// These pin the exact classification decisions the rewrite must preserve. They
// are deliberately redundant with the snapshots: a snapshot diff says "X
// changed", but these say "X changed FROM the contract" in plain English.

describe('parser invariants: inline vs block classification', () => {
  it('inline {{setvar::n::v}} (2 args) is a macro node, NOT blockSetvar', () => {
    const ast = parse('setvar-inline-not-block');
    expect(ast).toHaveLength(1);
    const m = asMacro(ast[0], 'setvar');
    expect(m.type).toBe('macro');
    // 2 args => inline. (name + 2 arg lists)
    expect(m.args).toHaveLength(2);
    // No blockSetvar anywhere.
    expect(ast.some(n => n.type === 'blockSetvar')).toBe(false);
  });

  it('inline {{setglobalvar::counter::42}} (2 args) is a macro node, NOT blockSetvar', () => {
    const ast = parse('setglobalvar-inline');
    expect(ast).toHaveLength(1);
    const m = asMacro(ast[0], 'setglobalvar');
    expect(m.args).toHaveLength(2);
    expect(ast.some(n => n.type === 'blockSetvar')).toBe(false);
  });

  it('block {{setvar::name}}...{{/setvar}} (1 arg + terminator) IS a blockSetvar', () => {
    const ast = parse('setvar-block');
    expect(ast[0].type).toBe('blockSetvar');
  });

  it('multi-arg {{if::true::then::else}} is an inline macro, NOT a blockIf', () => {
    const ast = parse('blockif-inline-ternary');
    expect(ast).toHaveLength(1);
    const m = asMacro(ast[0], 'if');
    // cond + then + else = 3 arg lists
    expect(m.args).toHaveLength(3);
    expect(ast.some(n => n.type === 'blockIf')).toBe(false);
  });

  it('2-arg {{if::1::yes}} is an inline macro, NOT a blockIf', () => {
    const ast = parse('blockif-inline-ternary-2arg');
    expect(ast).toHaveLength(1);
    const m = asMacro(ast[0], 'if');
    expect(m.args).toHaveLength(2);
    expect(ast.some(n => n.type === 'blockIf')).toBe(false);
  });

  it('blockSetvar node carries a parsed varName node list and local scope', () => {
    const ast = parse('setvar-block'); // {{setvar::greeting}}...{{/setvar}}...
    const node = ast[0] as { type: string; scope: string; varName: ASTNode[]; content: ASTNode[] };
    expect(node.type).toBe('blockSetvar');
    expect(node.scope).toBe('local');
    // varName is parsed (a node list), not a raw string.
    expect(Array.isArray(node.varName)).toBe(true);
    expect(node.varName).toEqual([{ type: 'text', value: 'greeting' }]);
    expect(Array.isArray(node.content)).toBe(true);
  });

  it('setglobalvar block has scope "global"', () => {
    const ast = parse('setglobalvar-block');
    const node = ast[0] as { type: string; scope: string };
    expect(node.type).toBe('blockSetvar');
    expect(node.scope).toBe('global');
  });

  it('blockSetvar varName can itself be a nested macro node', () => {
    // {{setvar::{{lower::AUTHOR}}::{{upper::value}}}} is INLINE (2 args), but the
    // block form {{setvar::{{...}}}}{{/setvar}} parses varName recursively.
    const ast = __parseForTest('{{setvar::{{lower::NAME}}}}body{{/setvar}}');
    const node = ast[0] as { type: string; varName: ASTNode[] };
    expect(node.type).toBe('blockSetvar');
    const inner = node.varName.find(n => n.type === 'macro') as MacroCallNode | undefined;
    expect(inner).toBeDefined();
    expect(inner!.name).toBe('lower');
  });

  it('single-arg {{if::1}}...{{/if}} IS a blockIf', () => {
    const ast = parse('blockif-colon');
    expect(ast[0].type).toBe('blockIf');
  });

  it('space-form {{if true}}...{{/if}} IS a blockIf', () => {
    const ast = parse('blockif-space');
    expect(ast[0].type).toBe('blockIf');
  });

  it('colon block-if with no terminator falls through to inline macro', () => {
    // '{{if::1}}no terminator here' => inline {{if::1}} macro + trailing text,
    // never a blockIf.
    const ast = parse('blockif-colon-malformed-no-close');
    asMacro(ast[0], 'if');
    expect(ast.some(n => n.type === 'blockIf')).toBe(false);
  });

  it('space block-if with no terminator becomes literal text (head only)', () => {
    // {{if true}}content without closing tag — head {{if true}} becomes text,
    // the body stays as following text.
    const ast = parse('blockif-malformed-no-close');
    expect(ast.some(n => n.type === 'blockIf')).toBe(false);
    expect(ast.some(n => n.type === 'macro')).toBe(false);
    expect(ast.every(n => n.type === 'text')).toBe(true);
    expect(ast.map(n => (n as { value: string }).value).join('')).toBe(
      inputOf('blockif-malformed-no-close'),
    );
  });
});

describe('parser invariants: else / else-if structure', () => {
  it('BlockIfNode always has then + else arrays, even with no {{else}}', () => {
    const ast = parse('blockif-space'); // {{if true}}YES{{/if}} — no else
    const node = asBlockIf(ast[0]);
    expect(Array.isArray(node.thenBranch)).toBe(true);
    expect(Array.isArray(node.elseBranch)).toBe(true);
    // No else arm => empty else array (not undefined).
    expect(node.elseBranch).toEqual([]);
    expect(node.condition).toBeDefined();
  });

  it('plain {{else}} populates the elseBranch array', () => {
    const ast = parse('blockif-else');
    const node = asBlockIf(ast[0]);
    expect(node.thenBranch.length).toBeGreaterThan(0);
    expect(node.elseBranch.length).toBeGreaterThan(0);
  });

  it('{{else if}} nests a BlockIfNode inside the parent elseBranch', () => {
    const ast = parse('blockif-elseif-2arm');
    const node = asBlockIf(ast[0]);
    // else-if chain lives as a single nested BlockIfNode in the else branch.
    expect(node.elseBranch).toHaveLength(1);
    expect(node.elseBranch[0].type).toBe('blockIf');
  });

  it('chained {{else if}}...{{else if}}...{{else}} nests deeply in elseBranch', () => {
    const ast = parse('blockif-elseif-3arm');
    const outer = asBlockIf(ast[0]);
    expect(outer.elseBranch).toHaveLength(1);
    const second = asBlockIf(outer.elseBranch[0]);
    expect(second.elseBranch).toHaveLength(1);
    const third = asBlockIf(second.elseBranch[0]);
    // third arm has its own then + final else, both arrays.
    expect(Array.isArray(third.thenBranch)).toBe(true);
    expect(Array.isArray(third.elseBranch)).toBe(true);
  });
});

describe('parser invariants: comments', () => {
  it("comment node name is '//' and body is a single unsplit arg (not split on ::)", () => {
    const ast = parse('comment-with-colons');
    // before{{//:: note: a::b::c}}after => [text, macro(//), text]
    const macro = ast.find(n => n.type === 'macro') as MacroCallNode;
    expect(macro).toBeDefined();
    expect(macro.name).toBe('//');
    // Body kept as ONE arg — never split on ::
    expect(macro.args).toHaveLength(1);
    expect(macro.args[0]).toHaveLength(1);
    expect(macro.args[0][0].type).toBe('text');
  });

  it('empty comment {{//}} produces a // macro with no args', () => {
    const ast = parse('comment-empty');
    const macro = ast.find(n => n.type === 'macro') as MacroCallNode;
    expect(macro.name).toBe('//');
    expect(macro.args).toEqual([]);
  });

  it("{{//if}} is an ORPHAN terminator, NOT a comment", () => {
    const ast = parse('comment-doubleslashif-is-orphan');
    // Orphan terminators are silently consumed — no node at all.
    expect(ast).toHaveLength(0);
  });
});

describe('parser invariants: orphan terminators produce NO node', () => {
  const orphanIds = [
    'orphan-slashif',
    'orphan-endif',
    'orphan-doubleslashif',
    'orphan-hashslashif',
    'orphan-else',
    'orphan-elseif',
    'orphan-slashtrim',
    'orphan-slashsetvar',
    'orphan-slashsetglobalvar',
  ];

  for (const id of orphanIds) {
    it(`${id}: terminator is consumed, only surrounding text survives`, () => {
      const ast = parse(id);
      // No macro / block node may come from the orphan terminator.
      expect(ast.some(n => n.type !== 'text')).toBe(false);
      // The terminator tag text must NOT appear in any surviving text node.
      const joined = ast.map(n => (n as { value: string }).value).join('');
      expect(joined).not.toContain('{{');
    });
  }

  it('orphan-multiple: a run of pure terminators yields an empty AST', () => {
    const ast = parse('orphan-multiple');
    expect(ast).toEqual([]);
  });
});

describe('parser invariants: unterminated braces', () => {
  it('unterminated {{ at EOF becomes a single trailing text node', () => {
    const ast = parse('unterm-open-eof'); // 'text {{'
    // 'text ' coalesces with the unmatched '{{' tail into trailing text node(s);
    // crucially there is NO macro node and the final node is text holding '{{'.
    expect(ast.some(n => n.type !== 'text')).toBe(false);
    const last = ast[ast.length - 1] as { type: string; value: string };
    expect(last.type).toBe('text');
    expect(last.value).toContain('{{');
    expect(ast.map(n => (n as { value: string }).value).join('')).toBe(
      inputOf('unterm-open-eof'),
    );
  });

  it('unterminated {{char at EOF becomes trailing text, no macro', () => {
    const ast = parse('unterm-open-name-eof'); // 'text {{char'
    expect(ast.some(n => n.type !== 'text')).toBe(false);
    const last = ast[ast.length - 1] as { type: string; value: string };
    expect(last.type).toBe('text');
    expect(last.value).toContain('{{char');
  });

  it('empty {{}} is parsed (not an unterminated tail) — macro with empty name', () => {
    const ast = parse('unterm-empty-macro'); // '{{}}'
    expect(ast).toHaveLength(1);
    const m = asMacro(ast[0]);
    expect(m.name).toBe('');
    expect(m.args).toEqual([]);
  });
});

describe('parser invariants: MacroCallNode.rawContent is UN-trimmed', () => {
  it('preserves surrounding whitespace in rawContent for {{upper::  hello  }}', () => {
    const ast = parse('inline-arg-whitespace'); // '{{upper::  hello  }}'
    const m = asMacro(ast[0], 'upper');
    // rawContent is the verbatim inner text between {{ and }} — NOT trimmed.
    expect(m.rawContent).toBe('upper::  hello  ');
  });

  it('preserves whitespace-only inner content in rawContent for {{   }}', () => {
    const ast = parse('unterm-whitespace-macro'); // '{{   }}'
    const m = asMacro(ast[0]);
    expect(m.rawContent).toBe('   ');
    // name IS trimmed+lowercased even though rawContent is not.
    expect(m.name).toBe('');
  });
});

describe('parser invariants: empty-arg structure', () => {
  it('{{x::::y}} keeps both delimiters: 2 arg lists, middle empty', () => {
    const ast = parse('inline-empty-both-args'); // '{{x::::y}}'
    const m = asMacro(ast[0], 'x');
    expect(m.args).toHaveLength(2);
    // First arg is empty (parsed from ''), second is 'y'.
    // An empty arg parses to an empty node list.
    expect(m.args[0]).toEqual([]);
    expect(m.args[1]).toHaveLength(1);
    expect(m.args[1][0]).toMatchObject({ type: 'text', value: 'y' });
  });

  it('{{x::a::}} trailing empty arg is preserved as an empty arg list', () => {
    const ast = parse('inline-trailing-empty-arg'); // '{{x::a::}}'
    const m = asMacro(ast[0], 'x');
    expect(m.args).toHaveLength(2);
    expect(m.args[0]).toHaveLength(1);
    expect(m.args[1]).toEqual([]);
  });

  it('{{x::::a}} leading empty arg is preserved as an empty arg list', () => {
    const ast = parse('inline-leading-empty-arg'); // '{{x::::a}}'
    const m = asMacro(ast[0], 'x');
    expect(m.args).toHaveLength(2);
    expect(m.args[0]).toEqual([]);
    expect(m.args[1]).toHaveLength(1);
  });

  it('{{x::::}} both args empty', () => {
    const ast = parse('inline-all-empty-args'); // '{{x::::}}'
    const m = asMacro(ast[0], 'x');
    expect(m.args).toHaveLength(2);
    expect(m.args[0]).toEqual([]);
    expect(m.args[1]).toEqual([]);
  });
});

describe('parser invariants: nesting parses args recursively', () => {
  it('{{a::{{b::c}}}} nests a macro inside the arg AST', () => {
    const ast = parse('inline-nested-in-arg');
    const outer = asMacro(ast[0], 'a');
    expect(outer.args).toHaveLength(1);
    const innerNodes = outer.args[0];
    const inner = innerNodes.find(n => n.type === 'macro') as MacroCallNode;
    expect(inner).toBeDefined();
    expect(inner.name).toBe('b');
  });

  it('macro names are lowercased in the AST', () => {
    const ast = parse('inline-name-uppercase'); // '{{CHAR}}'
    asMacro(ast[0], 'char');
  });
});

// ============================================================================
// LAYER 3: Corpus / counts meta-guard
// ============================================================================
// Ensures the corpus this net is built on hasn't silently shrunk and that
// every entry produced both snapshots above (1 AST + 1 processMacros per id).

describe('corpus meta', () => {
  it('every CORPUS entry has a unique id', () => {
    const ids = CORPUS.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every CORPUS category is covered by the ordered snapshot groups', () => {
    const seen = new Set(CORPUS.map(e => e.category));
    for (const cat of seen) {
      expect(CATEGORY_ORDER).toContain(cat);
    }
  });

  it('category counts match the corpus tally', () => {
    const tally = CORPUS.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    expect(tally).toEqual(CORPUS_CATEGORY_COUNTS);
  });
});
