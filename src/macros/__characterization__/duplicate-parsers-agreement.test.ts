// ============================================================================
// DUPLICATE-PARSER AGREEMENT (characterization / golden-master)
// ============================================================================
// RoleCall has THREE independent brace/`::` scanners that must stay in lockstep
// so the macro-engine tokenizer rewrite cannot silently desync them:
//
//   1. processor.ts  — the REAL recursive-descent parser ({{}} nesting + `::`
//                       splitting at depth 0 + block grammar for if/trim/
//                       setvar). Exposed for tests via __parseForTest -> AST.
//   2. lint.ts        — scanMacros(): a flat recursive scan (top-level + nested
//                       args). Has NO block grammar (it sees `{{if true}}`,
//                       `{{/if}}`, `{{trim}}` as ordinary flat macros) and
//                       SKIPS `//` comments entirely.
//   3. offband.ts     — __scanTopLevelForTest() (test export mirroring
//                       extractOffbandAsks' scan loop): a DEPTH-0-ONLY flat
//                       scan. No block grammar, does NOT skip comments.
//
// What we pin:
//   A) The two PURE FLAT tokenizers (lint, offband) must agree EXACTLY on
//      name/arg boundaries and top-level-vs-nested classification — offband's
//      top-level list is precisely lint's depth-0 entries (modulo lint's
//      comment-skipping). This is the strongest cross-tokenizer invariant and
//      is independent of block grammar.
//   B) On inputs with NO block grammar, the PROCESSOR's parser must draw the
//      same brace/`::` boundaries as the flat scanners (its flattened inline
//      macros == lint's non-comment macros). Block-grammar inputs legitimately
//      differ (the parser parses conditions/bodies the flat scanners can't see)
//      and are pinned by explicit targeted assertions + the per-input snapshot.
//   C) Explicit assertions on the tricky edges from the brief: escaped braces,
//      `::` inside content, deep nesting {{a::{{b::c}}}}, unterminated {{,
//      lone/triple braces, {{//::x}}, top-level vs nested {{pick$}}.
//
// Assertions go through the public/test surface only (__parseForTest,
// scanMacros, __scanTopLevelForTest). The deleted helpers (findMatchingClose /
// splitMacroArgs / findClose / splitArgs / splitTopLevel) are NEVER tested
// directly. Any genuine divergence is a PRE-EXISTING bug recorded as a
// `// DIVERGENCE:` note and pinned to CURRENT behavior (do not fix here).
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { initializeMacros } from '../index';
import { __parseForTest, type ASTNode } from '../processor';
import { scanMacros } from '../lint';
import { __scanTopLevelForTest } from '../offband';
import { CORPUS } from './corpus';

beforeAll(() => {
  initializeMacros();
});

// ----------------------------------------------------------------------------
// Normalization
// ----------------------------------------------------------------------------

interface NormMacro {
  name: string;
  args: string[];
}

const norm = (name: string, args: string[]): NormMacro => ({
  name: name.trim().toLowerCase(),
  args: args.map(a => a.trim()),
});

const sig = (m: NormMacro): string => `${m.name}/${m.args.length}`;

/** Processor comment nodes are named `//`; the flat scanners surface them
 *  differently (lint drops them; offband tokenizes them as a plain macro
 *  whose name starts with `//`). Filter for the cross-tokenizer comparison. */
const isComment = (m: NormMacro): boolean => m.name === '//' || m.name.startsWith('//');

/**
 * Block heads/terminators that the PROCESSOR consumes into block nodes (no
 * `macro` node emitted) but the flat scanners surface as ordinary macros.
 * Recognizing these lets us (a) detect whether an input uses block grammar and
 * (b) exclude them from boundary comparisons. This list classifies the FLAT
 * scanners' output by name, exactly as the processor's parseNodes decides.
 */
function isBlockToken(m: NormMacro): boolean {
  const n = m.name;
  // terminators
  if (n === '/if' || n === 'endif' || n === '/#if' || n === '//if') return true;
  if (n === '/trim' || n === '/setvar' || n === '/setglobalvar') return true;
  if (n === 'else') return true;
  if (/^else\s+if$/.test(n) || /^else\s+if\s/.test(n)) return true; // {{else if...}} / {{else if::...}}
  // heads (space-form): name itself carries the condition, e.g. "if true"
  if (/^if\s/.test(n) || /^#if\s/.test(n)) return true;
  // heads (colon block-if): {{if::cond}} == single-arg `if` (2+ args = inline ternary)
  if (n === 'if' && m.args.length === 1) return true;
  // block trim head: bare {{trim}} (inline form is {{trim::text}})
  if (n === 'trim' && m.args.length === 0) return true;
  // block setvar head: single-arg {{setvar::name}} (2-arg form is inline)
  if ((n === 'setvar' || n === 'setglobalvar') && m.args.length === 1) return true;
  return false;
}

/** Does this input exercise the processor's block grammar at all? */
function usesBlockGrammar(input: string): boolean {
  return scanMacros(input).some(m => isBlockToken(norm(m.name, m.args)))
    || __scanTopLevelForTest(input).some(m => isBlockToken(norm(m.name, m.args)));
}

/** Flatten the processor AST into inline macro calls (top-level + nested in
 *  args / block bodies / conditions), in walk order: a macro before its arg
 *  macros. Block nodes contribute their sub-nodes only. */
function flattenProcessorMacros(nodes: ASTNode[]): NormMacro[] {
  const out: NormMacro[] = [];
  const walk = (ns: ASTNode[]) => {
    for (const n of ns) {
      switch (n.type) {
        case 'text':
          break;
        case 'macro':
          out.push({ name: n.name, args: n.args.map(() => '') });
          for (const arg of n.args) walk(arg);
          break;
        case 'blockIf':
          walk(n.condition);
          walk(n.thenBranch);
          walk(n.elseBranch);
          break;
        case 'blockSetvar':
          walk(n.varName);
          walk(n.content);
          break;
        case 'blockTrim':
          walk(n.content);
          break;
      }
    }
  };
  walk(nodes);
  return out;
}

/** Top-level (depth-0) inline `macro` nodes from the processor AST. */
function topLevelProcessorMacros(nodes: ASTNode[]): NormMacro[] {
  return nodes
    .filter((n): n is Extract<ASTNode, { type: 'macro' }> => n.type === 'macro')
    .map(n => ({ name: n.name, args: n.args.map(() => '') }));
}

// ----------------------------------------------------------------------------
// (A) Pure flat tokenizers: lint (recursive) vs offband (top-level)
// ----------------------------------------------------------------------------

describe('flat tokenizers agree: offband(top-level) is lint(top-level) minus comments', () => {
  // offband and lint share the same {{}}-depth + `::`-at-depth-0 tokenizer; the
  // ONLY differences are (1) lint recurses into nested args, (2) lint skips
  // `//` comments. So offband's NON-COMMENT top-level entries must each appear
  // — same name, same trimmed args, same order — among lint's macros. This is
  // the load-bearing "two independent scanners can't drift" pin.
  for (const entry of CORPUS) {
    it(`${entry.id}: every offband top-level macro matches a lint macro`, () => {
      const offband = __scanTopLevelForTest(entry.input)
        .map(m => norm(m.name, m.args))
        .filter(m => !isComment(m));
      const lint = scanMacros(entry.input).map(m => norm(m.name, m.args));

      // lint's source-order list contains all top-level macros (it walks them
      // first, then recurses). The offband non-comment top-level sequence must
      // be an order-preserving subsequence of lint with identical name+args.
      let li = 0;
      for (const ob of offband) {
        let matched = false;
        while (li < lint.length) {
          const l = lint[li++];
          if (l.name === ob.name && JSON.stringify(l.args) === JSON.stringify(ob.args)) {
            matched = true;
            break;
          }
        }
        expect(
          matched,
          `offband macro ${JSON.stringify(ob)} not found in lint scan ${JSON.stringify(lint)}`,
        ).toBe(true);
      }
    });
  }
});

describe('flat tokenizers agree: exact name+args record (lint scanner snapshot)', () => {
  // lint.scanMacros records actual trimmed arg strings — the golden record of
  // where `::` boundaries fall (depth-0 only; nested {{}} inside an arg must
  // NOT split it). Snapshot pins the rewrite to reproduce these exactly.
  for (const entry of CORPUS) {
    it(`${entry.id}: lint scanner name+args`, () => {
      expect(scanMacros(entry.input).map(m => ({ name: m.name, args: m.args }))).toMatchSnapshot();
    });
  }
});

describe('flat tokenizers agree: exact name+args record (offband top-level snapshot)', () => {
  // Same for the off-band top-level scanner. Pins arg boundaries AND the
  // top-level span set (start/end implied by which macros appear).
  for (const entry of CORPUS) {
    it(`${entry.id}: offband top-level name+args`, () => {
      expect(__scanTopLevelForTest(entry.input).map(m => ({ name: m.name, args: m.args }))).toMatchSnapshot();
    });
  }
});

// ----------------------------------------------------------------------------
// (B) Processor parser vs flat scanners — name+argCount boundaries
// ----------------------------------------------------------------------------

describe('processor vs lint: inline macro boundaries agree (non-block inputs)', () => {
  // On inputs that DON'T use block grammar, the processor's parser has no
  // structural reclassification to do — its flattened inline macros must equal
  // lint's non-comment macros exactly (same names, same arg counts, same
  // order). This pins that the recursive-descent tokenizer and the flat
  // tokenizer draw identical brace/`::` boundaries. Block-grammar inputs are
  // excluded here and pinned by targeted tests + the AST snapshot below.
  for (const entry of CORPUS) {
    if (usesBlockGrammar(entry.input)) continue;
    it(`${entry.id}: processor inline macros == lint non-comment macros`, () => {
      const lint = scanMacros(entry.input)
        .map(m => norm(m.name, m.args))
        .filter(m => !isComment(m))
        .map(sig);
      const proc = flattenProcessorMacros(__parseForTest(entry.input))
        .filter(m => !isComment(m))
        .map(sig);
      expect(proc).toEqual(lint);
    });
  }
});

describe('processor vs offband: top-level classification agrees (non-block inputs)', () => {
  // For non-block inputs, the processor's DEPTH-0 inline macros must equal the
  // offband DEPTH-0 scan (both minus comments). This pins top-level-vs-nested
  // classification: a macro the rewrite mis-nests would appear in one list and
  // not the other.
  for (const entry of CORPUS) {
    if (usesBlockGrammar(entry.input)) continue;
    it(`${entry.id}: processor top-level == offband top-level`, () => {
      const offband = __scanTopLevelForTest(entry.input)
        .map(m => norm(m.name, m.args))
        .filter(m => !isComment(m))
        .map(sig);
      const proc = topLevelProcessorMacros(__parseForTest(entry.input))
        .filter(m => !isComment(m))
        .map(sig);
      expect(proc).toEqual(offband);
    });
  }
});

describe('processor AST shape is stable (all inputs, incl. block grammar)', () => {
  // Full-fidelity golden master of the parser output for every corpus input.
  // Captures block structure (if/trim/setvar), comment handling, orphan
  // consumption, and boundaries the flat-scanner comparisons can't express.
  // Strips volatile fields (rawContent text) down to structure + names.
  const shape = (nodes: ASTNode[]): unknown =>
    nodes.map((n): unknown => {
      switch (n.type) {
        case 'text':
          return { t: 'text', value: n.value };
        case 'macro':
          return { t: 'macro', name: n.name, args: n.args.map(shape) };
        case 'blockIf':
          return {
            t: 'blockIf',
            condition: shape(n.condition),
            then: shape(n.thenBranch),
            else: shape(n.elseBranch),
          };
        case 'blockSetvar':
          return { t: 'blockSetvar', scope: n.scope, varName: shape(n.varName), content: shape(n.content) };
        case 'blockTrim':
          return { t: 'blockTrim', content: shape(n.content) };
      }
    });
  for (const entry of CORPUS) {
    it(`${entry.id}: processor AST shape`, () => {
      expect(shape(__parseForTest(entry.input))).toMatchSnapshot();
    });
  }
});

// ----------------------------------------------------------------------------
// (C) Targeted tricky edges — explicit, readable assertions
// ----------------------------------------------------------------------------

describe('tricky brace/:: edges: deep nesting and `::` inside content', () => {
  it('{{a::{{b::c}}}}: outer 1 arg holding the raw nested macro; `::` only splits depth 0', () => {
    const input = '{{a::{{b::c}}}}';
    // offband (top-level only): single macro `a`, one arg = the raw nested macro.
    expect(__scanTopLevelForTest(input).map(m => norm(m.name, m.args)))
      .toEqual([{ name: 'a', args: ['{{b::c}}'] }]);
    // lint (recursive): `a` then nested `b::c`.
    expect(scanMacros(input).map(m => norm(m.name, m.args))).toEqual([
      { name: 'a', args: ['{{b::c}}'] },
      { name: 'b', args: ['c'] },
    ]);
    // processor: macro `a` with one arg that is a nested macro `b` (1 arg).
    const proc = __parseForTest(input);
    expect(proc).toHaveLength(1);
    const a = proc[0];
    expect(a.type).toBe('macro');
    if (a.type !== 'macro') return;
    expect(a.name).toBe('a');
    expect(a.args).toHaveLength(1);
    expect(a.args[0]).toHaveLength(1);
    const b = a.args[0][0];
    expect(b.type).toBe('macro');
    if (b.type === 'macro') {
      expect(b.name).toBe('b');
      expect(b.args).toHaveLength(1);
    }
  });

  it('triple nesting {{a::{{b::{{c::d}}}}}}: `::` splits only at depth 0', () => {
    const input = '{{a::{{b::{{c::d}}}}}}';
    expect(__scanTopLevelForTest(input).map(m => norm(m.name, m.args)))
      .toEqual([{ name: 'a', args: ['{{b::{{c::d}}}}'] }]);
    expect(scanMacros(input).map(m => norm(m.name, m.args))).toEqual([
      { name: 'a', args: ['{{b::{{c::d}}}}'] },
      { name: 'b', args: ['{{c::d}}'] },
      { name: 'c', args: ['d'] },
    ]);
  });

  it('single colons inside an arg value are NOT boundaries', () => {
    const input = '{{setvar::note::a:b:c}}';
    expect(scanMacros(input).map(m => norm(m.name, m.args)))
      .toEqual([{ name: 'setvar', args: ['note', 'a:b:c'] }]);
    expect(__scanTopLevelForTest(input).map(m => norm(m.name, m.args)))
      .toEqual([{ name: 'setvar', args: ['note', 'a:b:c'] }]);
  });
});

describe('tricky brace/:: edges: top-level vs nested {{pick$}}', () => {
  it('top-level pick$ is a top-level offband macro; nested pick$ is not', () => {
    // Top-level — offband surfaces it.
    expect(__scanTopLevelForTest('{{pick$::q::a::b}}').map(m => m.name)).toEqual(['pick$']);
    // Nested inside another macro's args — offband's TOP-LEVEL scan surfaces
    // only the OUTER macro; the pick$ stays inside the arg, unsplit.
    const nested = __scanTopLevelForTest('{{upper::{{pick$::q::a::b}}}}');
    expect(nested.map(m => m.name)).toEqual(['upper']);
    expect(nested[0].args).toEqual(['{{pick$::q::a::b}}']);
    // lint, recursive, DOES surface the nested pick$.
    expect(scanMacros('{{upper::{{pick$::q::a::b}}}}').map(m => m.name)).toEqual(['upper', 'pick$']);
    // processor: top-level `upper`, nested `pick$` in its arg.
    const proc = __parseForTest('{{upper::{{pick$::q::a::b}}}}');
    expect(proc).toHaveLength(1);
    if (proc[0].type === 'macro') {
      expect(proc[0].name).toBe('upper');
      const inner = proc[0].args[0]?.[0];
      expect(inner?.type).toBe('macro');
      if (inner?.type === 'macro') expect(inner.name).toBe('pick$');
    }
  });
});

describe('tricky brace/:: edges: unterminated / lone / triple braces', () => {
  it('unterminated {{ : all scanners stop, no phantom macro', () => {
    for (const input of ['text {{', 'text {{char', 'a {{b::c']) {
      expect(scanMacros(input)).toEqual([]);
      expect(__scanTopLevelForTest(input)).toEqual([]);
      expect(__parseForTest(input).every(n => n.type === 'text')).toBe(true);
    }
  });

  it('single braces are inert text for every scanner', () => {
    const input = 'a { b } c';
    expect(scanMacros(input)).toEqual([]);
    expect(__scanTopLevelForTest(input)).toEqual([]);
    expect(__parseForTest(input).every(n => n.type === 'text')).toBe(true);
  });

  it('{{{char}}}: all three scanners agree the inner brace joins the NAME', () => {
    // DIVERGENCE NOTE (not a bug, just surprising): a leading lone `{` is taken
    // as part of the macro name, so the name is `{char`, not `char`. All three
    // scanners agree on this, which is the important property here.
    const input = '{{{char}}}';
    expect(scanMacros(input).map(m => m.name)).toEqual(['{char']);
    expect(__scanTopLevelForTest(input).map(m => m.name)).toEqual(['{char']);
    const proc = __parseForTest(input).filter(n => n.type === 'macro');
    expect(proc.map(n => (n.type === 'macro' ? n.name : ''))).toEqual(['{char']);
  });

  it('{{{{char}}}}: a leading lone {{ folds into the name; both flat scanners agree', () => {
    // The outer `{{` opens; the next `{{` increments depth but `char` then `}}`
    // closes the inner, leaving `{{char}}` as the macro NAME (no `::`, so no
    // args, and lint has nothing nested to recurse into). Both flat scanners
    // tokenize this identically.
    const input = '{{{{char}}}}';
    expect(scanMacros(input).map(m => norm(m.name, m.args))).toEqual([{ name: '{{char}}', args: [] }]);
    expect(__scanTopLevelForTest(input).map(m => norm(m.name, m.args))).toEqual([{ name: '{{char}}', args: [] }]);
  });
});

describe('tricky brace/:: edges: comments and {{//::x}} / {{//if}}', () => {
  it('{{//:: note: a::b::c}}: processor keeps body as ONE unsplit arg; lint drops it', () => {
    const input = '{{//:: note: a::b::c}}';
    // lint SKIPS comments.
    expect(scanMacros(input)).toEqual([]);
    // processor: name `//`, the whole comment body is a single un-split arg.
    const proc = __parseForTest(input);
    expect(proc).toHaveLength(1);
    expect(proc[0].type).toBe('macro');
    if (proc[0].type === 'macro') {
      expect(proc[0].name).toBe('//');
      expect(proc[0].args.length).toBeLessThanOrEqual(1);
    }
    // DIVERGENCE NOTE: offband's flat scanner has NO comment grammar — it
    // tokenizes `//::...` like any macro and SPLITS the body on `::`, yielding
    // name `//` with 3 args. This never causes wrong behavior because offband
    // only ACTS on off-band base names (pick$/ask_model$/...), and `//` is not
    // one, so the comment is never extracted as an ask. Pin CURRENT behavior.
    const ob = __scanTopLevelForTest(input);
    expect(ob).toHaveLength(1);
    expect(ob[0].name).toBe('//');
    expect(ob[0].args).toEqual(['note: a', 'b', 'c']);
  });

  it('{{//if}}: processor treats as ORPHAN terminator (consumed), not a comment', () => {
    expect(__parseForTest('{{//if}}').every(n => n.type === 'text')).toBe(true);
    // lint skips it as a comment-like `//` start; offband sees a flat `//if`.
    expect(scanMacros('{{//if}}')).toEqual([]);
    expect(__scanTopLevelForTest('{{//if}}').map(m => m.name)).toEqual(['//if']);
  });
});

describe('tricky brace/:: edges: escaped braces & raw `::`', () => {
  it('escaped \\{\\{...\\}\\} contains no real {{ pair: parser sees plain text', () => {
    // The bare parser runs on un-escaped text (escaping is sentinel-based in
    // processMacros, not parseNodes). `\{\{` has a backslash between the braces
    // so there is no literal `{{` token — all scanners see plain text.
    const input = 'Use \\{\\{char\\}\\} literally';
    expect(__parseForTest(input).every(n => n.type === 'text')).toBe(true);
    expect(scanMacros(input)).toEqual([]);
    expect(__scanTopLevelForTest(input)).toEqual([]);
  });

  it('bare `::` outside any macro is plain text for every scanner', () => {
    const input = 'a :: b :: c';
    expect(scanMacros(input)).toEqual([]);
    expect(__scanTopLevelForTest(input)).toEqual([]);
    expect(__parseForTest(input).every(n => n.type === 'text')).toBe(true);
  });

  it('adjacent top-level macros are surfaced in order by all scanners', () => {
    const input = '{{char}}{{user}}';
    expect(scanMacros(input).map(m => m.name)).toEqual(['char', 'user']);
    expect(__scanTopLevelForTest(input).map(m => m.name)).toEqual(['char', 'user']);
    expect(
      __parseForTest(input)
        .filter(n => n.type === 'macro')
        .map(n => (n.type === 'macro' ? n.name : '')),
    ).toEqual(['char', 'user']);
  });
});

describe('tricky brace/:: edges: block heads seen as flat macros by flat scanners', () => {
  it('{{if true}}...{{/if}}: flat scanners see flat if-head + /if; processor makes a blockIf', () => {
    const input = '{{if true}}YES{{/if}}';
    // Flat scanners: head + terminator as ordinary macros, identical to each other.
    expect(scanMacros(input).map(m => m.name)).toEqual(['if true', '/if']);
    expect(__scanTopLevelForTest(input).map(m => m.name)).toEqual(['if true', '/if']);
    // Processor: one blockIf node, no flat macro nodes.
    const proc = __parseForTest(input);
    expect(proc).toHaveLength(1);
    expect(proc[0].type).toBe('blockIf');
  });

  it('{{if::a::b}} inside {{if true}}...{{/if}}: inner ternary stays inline, block boundary respected', () => {
    // desync guard: a 2-arg colon `if` is the inline ternary, NOT a block head.
    const input = '{{if true}}{{if::a::b}}{{/if}}';
    // Flat scanners agree on tokens.
    expect(scanMacros(input).map(m => norm(m.name, m.args))).toEqual([
      { name: 'if true', args: [] },
      { name: 'if', args: ['a', 'b'] },
      { name: '/if', args: [] },
    ]);
    expect(__scanTopLevelForTest(input).map(m => norm(m.name, m.args))).toEqual([
      { name: 'if true', args: [] },
      { name: 'if', args: ['a', 'b'] },
      { name: '/if', args: [] },
    ]);
    // Processor: outer blockIf whose then-branch holds the inline `if` (2 args).
    const proc = __parseForTest(input);
    expect(proc).toHaveLength(1);
    expect(proc[0].type).toBe('blockIf');
    if (proc[0].type === 'blockIf') {
      const inner = proc[0].thenBranch.filter(n => n.type === 'macro');
      expect(inner.map(n => (n.type === 'macro' ? `${n.name}/${n.args.length}` : ''))).toEqual(['if/2']);
    }
  });
});
