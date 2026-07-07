// ============================================================================
// MACRO PARSER CHARACTERIZATION CORPUS
// ============================================================================
// An exhaustive set of inputs for the macro PARSING front-end (preprocessing +
// parseNodes). This corpus is the raw material for the golden-master net that
// guards the clean-room rewrite of the parser: characterization tests snapshot
// each input's AST (via __parseForTest) and its processMacros() result against
// the CURRENT implementation, so the rewrite cannot silently change behavior.
//
// IMPORTANT: this file is DATA only. It must not assert anything and must not
// reference parser internals (findMatchingClose / splitMacroArgs /
// preprocessDotNotation / etc.) — those helpers get DELETED by the rewrite.
// The behavioral assertions live in the characterization test files that
// consume CORPUS; they go through the public surface (__parseForTest +
// processMacros) only.
//
// Categories mirror the parser's structural concerns. Every category carries
// multiple cases including the nasty edges (sentinel collisions, desync guards,
// orphan terminators, malformed blocks, deep nesting).
// ============================================================================

export interface CorpusEntry {
  /** Stable unique id, used to name generated test cases. */
  id: string;
  /** Behavioral category (also used for per-category counts). */
  category: CorpusCategory;
  /** Raw template text fed to __parseForTest and processMacros. */
  input: string;
  /** Optional human note about what the case pins. */
  note?: string;
}

export type CorpusCategory =
  | 'text'
  | 'inline'
  | 'escaped'
  | 'angle'
  | 'dotdollar'
  | 'spaceform'
  | 'singlecolon'
  | 'blockif'
  | 'trim'
  | 'setvar'
  | 'orphan'
  | 'comment'
  | 'unknown'
  | 'unterminated'
  | 'whitespace'
  | 'lazyvolatile'
  | 'template';

// Raw sentinel control chars that the engine uses internally. Including them
// verbatim in user input is a collision hazard the parser/post-processor must
// survive — captured here as a category-spanning edge.
const SENT_OPEN = '\x01';
const SENT_CLOSE = '\x02';
const SENT_PHASE = '\x03';
const SENT_TRIM = '\x04';

export const CORPUS: CorpusEntry[] = [
  // ==========================================================================
  // TEXT
  // ==========================================================================
  { id: 'text-empty', category: 'text', input: '', note: 'empty string' },
  { id: 'text-plain', category: 'text', input: 'Just plain text with no macros.' },
  { id: 'text-leading-ws', category: 'text', input: '   leading whitespace' },
  { id: 'text-trailing-ws', category: 'text', input: 'trailing whitespace   ' },
  { id: 'text-internal-ws', category: 'text', input: 'lots   of   internal    spaces' },
  { id: 'text-only-ws', category: 'text', input: '     ' },
  { id: 'text-tabs-newlines', category: 'text', input: '\tindented\n\twith tabs' },
  { id: 'text-then-macro', category: 'text', input: 'before {{char}}', note: 'coalescing boundary: text then macro' },
  { id: 'text-macro-then-text', category: 'text', input: '{{char}} after' },
  { id: 'text-around-macro', category: 'text', input: 'before {{char}} after', note: 'text-macro-text boundaries' },
  { id: 'text-adjacent-macros', category: 'text', input: '{{char}}{{user}}', note: 'no text between macros' },
  { id: 'text-unicode', category: 'text', input: 'emoji 👁 and accents café résumé' },
  { id: 'text-braces-only-single', category: 'text', input: 'a { b } c', note: 'single braces are plain text' },

  // ==========================================================================
  // INLINE MACRO
  // ==========================================================================
  { id: 'inline-simple', category: 'inline', input: '{{char}}' },
  { id: 'inline-one-arg', category: 'inline', input: '{{upper::hello}}' },
  { id: 'inline-two-arg', category: 'inline', input: '{{setvar::name::value}}' },
  { id: 'inline-three-arg', category: 'inline', input: '{{random::a::b::c}}' },
  { id: 'inline-empty-both-args', category: 'inline', input: '{{x::::y}}', note: 'empty middle arg' },
  { id: 'inline-trailing-empty-arg', category: 'inline', input: '{{x::a::}}', note: 'trailing empty arg' },
  { id: 'inline-leading-empty-arg', category: 'inline', input: '{{x::::a}}', note: 'leading empty arg' },
  { id: 'inline-all-empty-args', category: 'inline', input: '{{x::::}}' },
  { id: 'inline-arg-whitespace', category: 'inline', input: '{{upper::  hello  }}', note: 'args get trimmed at eval' },
  { id: 'inline-nested-in-arg', category: 'inline', input: '{{a::{{b::c}}}}', note: 'macro nested in an arg' },
  { id: 'inline-nested-real', category: 'inline', input: '{{upper::{{char}}}}' },
  { id: 'inline-nested-deepest-first', category: 'inline', input: '{{lower::{{upper::HeLLo}}}}' },
  { id: 'inline-mixed-text-and-nest', category: 'inline', input: '{{upper::pre {{char}} post}}' },
  { id: 'inline-name-uppercase', category: 'inline', input: '{{CHAR}}', note: 'name lowercased' },
  { id: 'inline-name-mixedcase', category: 'inline', input: '{{GetVar::Mood}}' },
  { id: 'inline-deep-12', category: 'inline', note: '12 levels inline nesting', input: (() => {
    let s = '{{char}}';
    for (let i = 0; i < 12; i++) s = i % 2 === 0 ? `{{upper::${s}}}` : `{{lower::${s}}}`;
    return s;
  })() },
  { id: 'inline-arg-with-colon-text', category: 'inline', input: '{{setvar::note::a:b:c}}', note: 'single colons in arg value stay' },
  { id: 'inline-two-side-by-side', category: 'inline', input: '{{random::a::b}} and {{random::c::d}}' },

  // ==========================================================================
  // ESCAPED BRACES
  // ==========================================================================
  { id: 'escaped-full', category: 'escaped', input: 'Use \\{\\{char\\}\\} literally', note: 'fully escaped braces' },
  { id: 'escaped-half-open', category: 'escaped', input: 'half \\{{char}}', note: 'escaped open then real' },
  { id: 'escaped-half-close', category: 'escaped', input: '{{char}}\\}}', note: 'real then escaped close' },
  { id: 'escaped-adjacent-real', category: 'escaped', input: '\\{\\{x\\}\\}{{char}}', note: 'escaped adjacent to real macro' },
  { id: 'escaped-only-open', category: 'escaped', input: 'just \\{\\{ open' },
  { id: 'escaped-only-close', category: 'escaped', input: 'just \\}\\} close' },
  { id: 'escaped-inside-arg', category: 'escaped', input: '{{upper::\\{\\{x\\}\\}}}', note: 'escaped braces inside a macro arg' },
  { id: 'escaped-sentinel-open-raw', category: 'escaped', input: `raw open sentinel ${SENT_OPEN} here`, note: '\\x01 collision hazard in user input' },
  { id: 'escaped-sentinel-close-raw', category: 'escaped', input: `raw close sentinel ${SENT_CLOSE} here`, note: '\\x02 collision hazard' },
  { id: 'escaped-sentinel-phase-raw', category: 'escaped', input: `raw phase sentinel ${SENT_PHASE} here`, note: '\\x03 collision hazard' },
  { id: 'escaped-sentinel-trim-raw', category: 'escaped', input: `raw trim sentinel ${SENT_TRIM} here`, note: '\\x04 collision hazard' },
  { id: 'escaped-sentinels-with-macro', category: 'escaped', input: `${SENT_OPEN}${SENT_CLOSE}{{char}}${SENT_TRIM}` },

  // ==========================================================================
  // ANGLE TOKENS
  // ==========================================================================
  { id: 'angle-user', category: 'angle', input: '<user>' },
  { id: 'angle-char', category: 'angle', input: '<char>' },
  { id: 'angle-bot', category: 'angle', input: '<bot>', note: 'bot -> char' },
  { id: 'angle-mixed-case', category: 'angle', input: '<USER> meets <Char>; <Bot> nods' },
  { id: 'angle-in-sentence', category: 'angle', input: 'Hi <user>, I am <char>.' },
  { id: 'angle-non-token', category: 'angle', input: '<div>HTML stays</div> <userdata>too</userdata>', note: 'unrelated angle content untouched' },
  { id: 'angle-adjacent', category: 'angle', input: '<char><user>' },

  // ==========================================================================
  // DOT / DOLLAR SHORTHAND
  // ==========================================================================
  { id: 'dot-get', category: 'dotdollar', input: '{{.v}}' },
  { id: 'dot-inc', category: 'dotdollar', input: '{{.v++}}' },
  { id: 'dot-dec', category: 'dotdollar', input: '{{.v--}}' },
  { id: 'dot-addeq', category: 'dotdollar', input: '{{.v += 2}}' },
  { id: 'dot-subeq', category: 'dotdollar', input: '{{.v -= 2}}' },
  { id: 'dot-set', category: 'dotdollar', input: '{{.v = 5}}' },
  { id: 'dot-eq', category: 'dotdollar', input: '{{.v == 5}}' },
  { id: 'dot-neq', category: 'dotdollar', input: '{{.v != 5}}' },
  { id: 'dot-gte', category: 'dotdollar', input: '{{.v >= 5}}' },
  { id: 'dot-lt', category: 'dotdollar', input: '{{.v < 5}}' },
  { id: 'dollar-global', category: 'dotdollar', input: '{{$global}}', note: '$name -> getglobalvar' },
  { id: 'dollar-positional-1', category: 'dotdollar', input: '{{$1}}', note: 'positional, NOT getglobalvar' },
  { id: 'dollar-positional-2', category: 'dotdollar', input: '{{$2}}', note: 'positional, NOT getglobalvar' },
  { id: 'dot-set-then-get', category: 'dotdollar', input: '{{.score = 10}}{{.score}}' },
  { id: 'dot-inc-then-get', category: 'dotdollar', input: '{{.n++}}{{.n}}' },

  // ==========================================================================
  // SPACE-FORM
  // ==========================================================================
  { id: 'space-getvar', category: 'spaceform', input: '{{getvar x}}' },
  { id: 'space-setvar', category: 'spaceform', input: '{{setvar x y}}' },
  { id: 'space-roll', category: 'spaceform', input: '{{roll 1d20}}' },
  { id: 'space-hasvar', category: 'spaceform', input: '{{hasvar x}}' },
  { id: 'space-incvar', category: 'spaceform', input: '{{incvar count}}' },
  { id: 'space-addvar', category: 'spaceform', input: '{{addvar score 5}}' },
  { id: 'space-setvar-multiword-value', category: 'spaceform', input: '{{setvar mood very happy}}', note: 'value captures rest' },

  // ==========================================================================
  // SINGLE-COLON
  // ==========================================================================
  { id: 'colon-random', category: 'singlecolon', input: '{{random:a,b,c}}', note: 'allowlisted single colon' },
  { id: 'colon-roll', category: 'singlecolon', input: '{{roll:1d50}}' },
  { id: 'colon-setvar', category: 'singlecolon', input: '{{setvar:x:5}}' },
  { id: 'colon-getvar', category: 'singlecolon', input: '{{getvar:mood}}' },
  { id: 'colon-comma-escape', category: 'singlecolon', input: '{{random:hello\\, world,goodbye\\, world}}', note: 'escaped comma' },
  { id: 'colon-not-allowlisted', category: 'singlecolon', input: '{{upper:x}}', note: 'non-allowlisted single colon stays literal name' },
  { id: 'colon-idempotent-canonical', category: 'singlecolon', input: '{{random::a::b}}', note: 'canonical :: unchanged' },
  { id: 'colon-roll-already-canonical', category: 'singlecolon', input: '{{roll::1d50}}' },

  // ==========================================================================
  // BLOCK-IF
  // ==========================================================================
  { id: 'blockif-space', category: 'blockif', input: '{{if true}}YES{{/if}}' },
  { id: 'blockif-hash', category: 'blockif', input: '{{#if true}}YES{{/#if}}' },
  { id: 'blockif-colon', category: 'blockif', input: '{{if::1}}YES{{/if}}' },
  { id: 'blockif-else', category: 'blockif', input: '{{if false}}YES{{else}}NO{{/if}}' },
  { id: 'blockif-colon-else', category: 'blockif', input: '{{if::0}}YES{{else}}NO{{/if}}' },
  { id: 'blockif-elseif-2arm', category: 'blockif', input: '{{if .x == 1}}one{{else if .x == 2}}two{{/if}}' },
  { id: 'blockif-elseif-3arm', category: 'blockif', input: '{{if::{{getvar::m}} == a}}A{{else if::{{getvar::m}} == b}}B{{else if::{{getvar::m}} == c}}C{{else}}D{{/if}}' },
  { id: 'blockif-term-slashif', category: 'blockif', input: '{{if 1}}X{{/if}}' },
  { id: 'blockif-term-doubleslash', category: 'blockif', input: '{{if::1}}X{{//if}}' },
  { id: 'blockif-term-hashclose', category: 'blockif', input: '{{#if 1}}X{{/#if}}' },
  { id: 'blockif-term-endif', category: 'blockif', input: '{{if 1}}X{{endif}}' },
  { id: 'blockif-inline-ternary', category: 'blockif', input: '{{if::true::then::else}}', note: 'inline macro, NOT a block' },
  { id: 'blockif-inline-ternary-2arg', category: 'blockif', input: '{{if::1::yes}}', note: 'inline 2-arg, not block' },
  { id: 'blockif-malformed-no-close', category: 'blockif', input: '{{if true}}content without closing tag', note: 'head becomes literal text' },
  { id: 'blockif-colon-malformed-no-close', category: 'blockif', input: '{{if::1}}no terminator here', note: 'falls through to inline' },
  { id: 'blockif-contains-inline-if', category: 'blockif', input: '{{if true}}{{if::a::b}}{{/if}}', note: 'desync guard: inline if inside block if' },
  { id: 'blockif-negation', category: 'blockif', input: '{{if !x}}neg{{else}}pos{{/if}}' },
  { id: 'blockif-comparison', category: 'blockif', input: '{{if {{getvar::t}} >= 8}}A{{else}}B{{/if}}' },
  { id: 'blockif-unknown-literal-truthy', category: 'blockif', input: '{{if somethingTruthy}}taken{{/if}}', note: 'unknown literal is truthy' },
  { id: 'blockif-empty-lhs', category: 'blockif', input: '{{if {{getvar::missing}} == wp}}Y{{else}}N{{/if}}', note: 'empty LHS comparison' },
  { id: 'blockif-nested-4', category: 'blockif', input: '{{if true}}{{if true}}{{if true}}{{if true}}DEEP{{/if}}{{/if}}{{/if}}{{/if}}', note: '4-level nested blocks' },
  { id: 'blockif-mixed-hash-space-nest', category: 'blockif', input: '{{if 1}}A{{#if 1}}B{{/if}}{{/if}}' },
  { id: 'blockif-nested-compare', category: 'blockif', input: '{{if {{compare::{{getvar::x}}::>=::3}} }}YES{{else}}NO{{/if}}' },
  { id: 'blockif-dotshorthand-cond', category: 'blockif', input: '{{if .body_roll <= 25}}low{{else}}high{{/if}}' },
  { id: 'blockif-true-string', category: 'blockif', input: '{{if true}}YES{{else}}NO{{/if}}' },
  { id: 'blockif-false-string', category: 'blockif', input: '{{if false}}YES{{else}}NO{{/if}}' },
  { id: 'blockif-zero-falsy', category: 'blockif', input: '{{if 0}}YES{{else}}NO{{/if}}' },
  { id: 'blockif-nonzero-truthy', category: 'blockif', input: '{{if 3}}YES{{else}}NO{{/if}}' },

  // ==========================================================================
  // TRIM
  // ==========================================================================
  { id: 'trim-block', category: 'trim', input: 'a[{{trim}}  spaced out  {{/trim}}]b' },
  { id: 'trim-bare', category: 'trim', input: 'left  \n {{trim}} \n  right', note: 'bare trim collapses surrounding ws' },
  { id: 'trim-inline', category: 'trim', input: '{{trim::  x  }}' },
  { id: 'trim-orphan', category: 'trim', input: 'a{{/trim}}b' },
  { id: 'trim-block-with-macro', category: 'trim', input: '{{trim}}  {{char}}  {{/trim}}' },
  { id: 'trim-bare-no-neighbors', category: 'trim', input: '{{trim}}' },

  // ==========================================================================
  // SETVAR BLOCK vs INLINE
  // ==========================================================================
  { id: 'setvar-block', category: 'setvar', input: '{{setvar::greeting}}Hello World{{/setvar}}{{getvar::greeting}}' },
  { id: 'setvar-inline-not-block', category: 'setvar', input: '{{setvar::n::v}}', note: 'two args => inline, NOT a block' },
  { id: 'setvar-block-with-macro', category: 'setvar', input: '{{setvar::info}}Name is {{char}}{{/setvar}}{{getvar::info}}' },
  { id: 'setglobalvar-block', category: 'setvar', input: '{{setglobalvar::msg}}Greetings{{/setglobalvar}}{{getglobalvar::msg}}' },
  { id: 'setglobalvar-inline', category: 'setvar', input: '{{setglobalvar::counter::42}}' },
  { id: 'setvar-inline-inside-block', category: 'setvar', input: '{{setvar::outer}}pre {{setvar::inner::x}} post{{/setvar}}{{getvar::outer}}', note: 'desync guard: inline setvar inside setvar block' },
  { id: 'setvar-block-nested-macro-value', category: 'setvar', input: '{{setvar::a}}{{random::x::y}}{{/setvar}}{{getvar::a}}' },
  { id: 'setvar-inline-nested-value', category: 'setvar', input: '{{setvar::Author::style of {{random::A::B}} text}}{{getvar::Author}}' },
  { id: 'setvar-inline-nested-name', category: 'setvar', input: '{{setvar::{{lower::AUTHOR}}::{{upper::value}}}}{{getvar::author}}' },
  { id: 'setvar-block-nested-block', category: 'setvar', input: '{{setvar::outer}}A{{setvar::inner}}B{{/setvar}}{{getvar::inner}}{{/setvar}}{{getvar::outer}}', note: 'nested setvar blocks' },

  // ==========================================================================
  // ORPHAN TERMINATORS
  // ==========================================================================
  { id: 'orphan-slashif', category: 'orphan', input: 'before{{/if}}after' },
  { id: 'orphan-endif', category: 'orphan', input: 'before{{endif}}after' },
  { id: 'orphan-doubleslashif', category: 'orphan', input: 'before{{//if}}after' },
  { id: 'orphan-hashslashif', category: 'orphan', input: 'before{{/#if}}after' },
  { id: 'orphan-else', category: 'orphan', input: 'before{{else}}after' },
  { id: 'orphan-elseif', category: 'orphan', input: 'before{{else if::x}}after' },
  { id: 'orphan-slashtrim', category: 'orphan', input: 'before{{/trim}}after' },
  { id: 'orphan-slashsetvar', category: 'orphan', input: 'before{{/setvar}}after' },
  { id: 'orphan-slashsetglobalvar', category: 'orphan', input: 'before{{/setglobalvar}}after' },
  { id: 'orphan-multiple', category: 'orphan', input: '{{/if}}{{else}}{{/trim}}{{endif}}' },

  // ==========================================================================
  // COMMENT
  // ==========================================================================
  { id: 'comment-simple', category: 'comment', input: 'before{{// this is a comment}}after' },
  { id: 'comment-with-colons', category: 'comment', input: 'before{{//:: note: a::b::c}}after', note: 'body NOT split on ::' },
  { id: 'comment-multiline', category: 'comment', input: 'before{{// line one\nline two\nline three}}after' },
  { id: 'comment-empty', category: 'comment', input: 'before{{//}}after' },
  { id: 'comment-with-macro-after', category: 'comment', input: '{{// setup}}Hello {{char}}!' },
  { id: 'comment-doubleslashif-is-orphan', category: 'comment', input: '{{//if}}', note: 'must be orphan terminator NOT comment' },
  { id: 'comment-leading-space', category: 'comment', input: '{{//   spaced comment   }}' },

  // ==========================================================================
  // UNKNOWN MACRO
  // ==========================================================================
  { id: 'unknown-bare', category: 'unknown', input: '{{unknown}}' },
  { id: 'unknown-one-arg', category: 'unknown', input: '{{unknown::a}}' },
  { id: 'unknown-multi-arg', category: 'unknown', input: '{{unknown::a::b::c}}' },
  { id: 'unknown-nested-arg', category: 'unknown', input: '{{unknown::{{char}}}}', note: 'reconstructed with EVALUATED args' },
  { id: 'unknown-in-sentence', category: 'unknown', input: 'Hello {{unknownmacro}}!' },
  { id: 'unknown-typo-suggestion', category: 'unknown', input: '{{chr}}', note: 'near-miss suggestion path' },
  { id: 'unknown-mixed-with-known', category: 'unknown', input: '{{bad}} meets {{char}}' },

  // ==========================================================================
  // UNTERMINATED / LONE / TRIPLE
  // ==========================================================================
  { id: 'unterm-open-eof', category: 'unterminated', input: 'text {{' },
  { id: 'unterm-open-name-eof', category: 'unterminated', input: 'text {{char' },
  { id: 'unterm-lone-open', category: 'unterminated', input: 'a { b' },
  { id: 'unterm-lone-close', category: 'unterminated', input: 'a } b' },
  { id: 'unterm-triple-open', category: 'unterminated', input: '{{{char}}' },
  { id: 'unterm-triple-close', category: 'unterminated', input: '{{char}}}' },
  { id: 'unterm-triple-both', category: 'unterminated', input: '{{{char}}}' },
  { id: 'unterm-quad-open', category: 'unterminated', input: '{{{{char}}}}' },
  { id: 'unterm-close-before-open', category: 'unterminated', input: '}} before {{char}}' },
  { id: 'unterm-bare-pairs', category: 'unterminated', input: '}} {{' },
  { id: 'unterm-empty-macro', category: 'unterminated', input: '{{}}', note: 'empty braces' },
  { id: 'unterm-whitespace-macro', category: 'unterminated', input: '{{   }}', note: 'whitespace-only inner' },

  // ==========================================================================
  // WHITESPACE
  // ==========================================================================
  { id: 'ws-three-newlines', category: 'whitespace', input: 'a\n\n\nb', note: '3 newlines collapse to 2' },
  { id: 'ws-five-newlines', category: 'whitespace', input: 'a\n\n\n\n\nb' },
  { id: 'ws-two-newlines-kept', category: 'whitespace', input: 'a\n\nb', note: '2 newlines preserved' },
  { id: 'ws-trim-sentinel-collapse', category: 'whitespace', input: 'a  {{trim}}  b' },
  { id: 'ws-newlines-with-macro', category: 'whitespace', input: '{{char}}\n\n\n\n{{user}}' },
  { id: 'ws-mixed-block', category: 'whitespace', input: 'line1\n\n\nline2\n\n\n\nline3' },

  // ==========================================================================
  // LAZY / VOLATILE
  // ==========================================================================
  { id: 'lazy-volatile-rcounter-seq', category: 'lazyvolatile', input: 'S{{rcounter::s}}.S{{rcounter::s}}.S{{rcounter::s}}.', note: 'volatile counter sequence' },
  { id: 'lazy-volatile-rcounter-multi', category: 'lazyvolatile', input: '{{rcounter::a}}-{{rcounter::b}}-{{rcounter::a}}' },
  { id: 'lazy-volatile-random', category: 'lazyvolatile', input: '{{random::a::b::c}}', note: 'cacheable false' },
  { id: 'lazy-volatile-roll', category: 'lazyvolatile', input: '{{roll::1d20}}' },
  { id: 'lazy-foreach', category: 'lazyvolatile', input: '{{foreach::d in [A,B,C]::- $d}}', note: 'lazy iteration macro' },
  { id: 'lazy-foreach-field', category: 'lazyvolatile', input: '{{foreach::x in [one,two]::$x done}}' },
  { id: 'lazy-when-all', category: 'lazyvolatile', input: '{{when_all::1::1::both set}}' },
  { id: 'lazy-when-any', category: 'lazyvolatile', input: '{{when_any::0::1::at least one}}' },
  { id: 'lazy-ifset', category: 'lazyvolatile', input: '{{ifset::mood::has mood::no mood}}' },

  // ==========================================================================
  // REAL TEMPLATES (ST / Lumiverse snippets)
  // ==========================================================================
  {
    id: 'template-phase-cascade',
    category: 'template',
    note: 'HawThorne-style phase cascade',
    input:
      '{{setvar::t::200}}' +
      '{{setvar::phase::Opening}}' +
      '{{if {{compare::{{getvar::t}}::>=::16}} }}{{setvar::phase::Rising}}{{/if}}' +
      '{{if {{compare::{{getvar::t}}::>=::51}} }}{{setvar::phase::Cruising}}{{/if}}' +
      '{{if {{compare::{{getvar::t}}::>=::151}} }}{{setvar::phase::Marathon}}{{/if}}' +
      '{{if {{compare::{{getvar::t}}::>=::500}} }}{{setvar::phase::Endurance}}{{/if}}' +
      'Phase: {{getvar::phase}}',
  },
  {
    id: 'template-threadbare-mode',
    category: 'template',
    note: 'Lumiverse else-if chain on mode',
    input:
      '{{if::{{getvar::mode}} == solo}}SOLO' +
      '{{else if::{{getvar::mode}} == swap}}SWAP' +
      '{{else if::{{getvar::mode}} == ensemble}}ENSEMBLE' +
      '{{else}}UNKNOWN{{/if}}',
  },
  {
    id: 'template-group-card-branch',
    category: 'template',
    note: 'group card solo/focus branch',
    input: '{{if::{{groupCardMode}} == solo}}SOLO:{{char}}{{else}}FOCUS:{{charGroupFocused}}{{/if}}',
  },
  {
    id: 'template-roster-snippet',
    category: 'template',
    note: 'roster intro with nested formatting + comment',
    input:
      '{{// roster block}}\n' +
      'You are {{char}}, talking to {{user}}.\n' +
      '{{if .nsfw_on}}Adult content enabled.{{else}}Keep it clean.{{/if}}\n' +
      'Mood today: {{upper::{{getvar::mood}}}}',
  },
];

// Per-category counts (kept in sync with CORPUS; asserted by the net's meta test).
export const CORPUS_CATEGORY_COUNTS: Record<CorpusCategory, number> = CORPUS.reduce(
  (acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1;
    return acc;
  },
  {} as Record<CorpusCategory, number>,
);
