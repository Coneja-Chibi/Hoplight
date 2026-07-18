---
id: reference/security/regex-safety
title: ReDoS defense in the regex engine
audience: dev
summary: Vaud parses every card-authored find pattern into an AST, screens it for catastrophic-backtracking shapes before it is ever compiled, refuses the dangerous ones with an exact culprit span, and surfaces the rejection reason as plain text in two places, with the coverage gaps in that screen documented here.
tags: [security, regex, redos, validation, ast, catastrophic-backtracking]
related: [reference/concepts/regex-engine, reference/concepts/regex-editor, reference/entities/regex]
---

# ReDoS defense in the regex engine

A regex set rides in with an imported character card: the `find` pattern is untrusted, author-controlled
text. JavaScript's `RegExp` engine runs synchronously and cannot be interrupted mid-execution (no worker,
no signal, no yield point), so a genuine catastrophic-backtracking pattern like `(a+)+$` can hang the
thread it runs on for as long as the input keeps it busy. `src/core/regex/validate.ts:6-9` states this
plainly: refusing the pattern before it ever compiles is "the only real defense a synchronous JS engine
has," and "the only 'clean timeout' a synchronous engine can offer." This page documents that screen: what
it actually checks, what it lets through, where the rejection reason is shown, and where the screen's own
coverage runs out.

@fig pipeline

## The AST layer never executes anything

`src/core/regex/ast/parser.ts` is a clean-room ECMAScript parser (`parseRegex`) that reads a pattern
string into a typed node tree (`ast-types.ts`), always under the unicode-mode (`u`-flag) grammar,
"whatever the flags string" the rule actually carries (`parser.ts:7-9`). It never throws: a syntax error
comes back as `{ error, at }`, never an exception (`parser.ts:15`, `parser.ts:463-473`). `ast-types.ts:13-14`
states the boundary explicitly: this tree is "DATA describing a pattern, never executable. Compilation and
matching stay in `core/regex/apply.ts`." No file in the AST layer, including the ReDoS analyzer, ever
constructs or runs a `RegExp`.

A narrow class of legacy (Annex-B-only) syntax is out of scope by design and returns an honest parse
error instead of a silently different parse: a lone `{`, a bare `]`, `\p` read as a literal `p`, an octal
`\8`, or a quantified lookaround (`parser.ts:7-12`). The `v`-flag set-notation grammar (nested class
set-operators like `--` and `&&`) is staged and unimplemented: `parseClass` (`parser.ts:319-346`) has no
branch for those operators, and `V_MODE_ENABLED` is `false` (`parser.ts:34`). What that means for the
ReDoS screen specifically is covered under "Known gaps" below.

## The screen: three structural culprits

`src/core/regex/ast/redos.ts` walks every unbounded quantifier (`max === null`) in the parsed tree
(`redos.ts:59-67`) and checks it against three shapes, each producing a finding with the exact source span
of the construct that tripped it (`RedosFinding.culpritSpan`, `redos.ts:41-47`):

| Shape | Detector | Example bomb | Example safe equivalent |
| --- | --- | --- | --- |
| Nested unbounded quantifier | `hasAmbiguousInnerLoop`, `redos.ts:111-150` | `(a+)+`, `(.+)+`, `(a+a)+` | `(a+b)+` (mandatory separator disambiguates the loop boundary) |
| Overlapping alternation under a quantifier | `alternationOverlap`, `redos.ts:157-175` | `(a\|a)+`, `(a\|ab)+` (prefix ambiguity) | `(a\|b)+`, `(ab\|ac)+` (diverging literals) |
| Backreference inside unbounded repetition | `containsBackreference`, `redos.ts:95-102, 196-202` | `(a)\1+` | `(a)\1` (unquantified) |

Severity is one of `safe`, `suspicious`, or `dangerous` (`redos.ts:37`). A literal prefix/equality
ambiguity on two plain-literal alternatives is `dangerous`; a coarse first-set overlap on complex
alternatives like `(\d|\w)+` (digit and word-class first-sets overlap, but neither is a strict prefix of
the other) is only `suspicious` (`redos.ts:152-175`). Nested-quantifier and quantified-backreference
findings are always `dangerous`. These verdicts are exercised directly in `redos.test.ts`: nine nested-
quantifier bombs (`redos.test.ts:57`), twelve linear-looking-but-safe patterns that must NOT fire
(`redos.test.ts:88-109`), the alternation ladder from equal/prefix (`dangerous`) through `(\d|\w)+`
(`suspicious`) to disjoint literals (`safe`, `redos.test.ts:112-147`), and the backreference pair
(`redos.test.ts:149-159`).

The detector is explicitly tuned for precision over recall: "a false positive cries wolf on a safe pattern
... whereas a miss simply falls through to [the] existing guards" (`redos.ts:9-10`). Two concrete
consequences of that choice, stated in the source:

- Character-set membership is a coarse, sample-based approximation (a fixed 14-codepoint sample plus each
  atom's own literal witnesses, `redos.ts:21-23, 274-276`), not full character-class algebra. `dot` and
  Unicode-property atoms are always treated as matching anything (`wide: true`), which can only push a
  verdict toward `suspicious`/`dangerous`, never hide a real overlap.
- A mandatory, disjoint separator between iterations is proven safe and passes clean (`redos.ts:13-15`);
  the detector does real nullability/first-set reasoning over the AST (`nullable`, `firstSet`,
  `redos.ts:217-270`) rather than a textual guess.

## The gate: `validateRule`

`src/core/regex/validate.ts` is what turns an `analyzeRedos` report into an actual refusal. `validateRule`
runs, in order:

1. Length caps: `find` over `MAX_PATTERN_LENGTH` (10,000 chars) or `replace` over
   `MAX_REPLACEMENT_LENGTH` (10,000 chars) is rejected before anything else is inspected
   (`validate.ts:17-18, 53-69`).
2. An empty (or whitespace-only) `find` is rejected (`validate.ts:60-62`).
3. A native syntax check: `new RegExp(pattern, jsFlagsForRule(rule))`, compiled under the SAME flags
   `apply.ts` will use at run time (`validate.ts:71-81`). `jsFlagsForRule` (`ast/dialect.ts:97-99`) reads
   the rule's own `flags`/`useFlags` fields, so a pattern that is legal under Annex B but fatal under the
   rule's own `u`/`v` flag is caught here, not on every subsequent run. This fixed a real regression: "a
   flagless compile here let u-only syntax errors through to runtime" (`validate.ts:72-73`), exercised in
   `validate.test.ts:106-116`.
4. `parseRegex(pattern)` (flags omitted; the module comment notes flags "don't change ReDoS shape,"
   `validate.ts:87`) builds the AST for structural analysis.

**When the pattern parses** (`validate.ts:88-107`), the AST branch is authoritative:

- `report.severity === "dangerous"` returns `{ ok: false, error: "regex/validate: pattern has nested
  quantifiers that risk catastrophic backtracking", complexity: COMPLEXITY_HARD_CAP, culprit: <span> }`
  (`validate.ts:91-98`). The pattern is never compiled for real. This is the only rejection path in this
  branch: the numeric complexity score is set to `COMPLEXITY_HARD_CAP` for display, it is not itself
  re-checked against a threshold here.
- `report.severity === "suspicious"` still returns `ok: true`, but `complexity` is floored at
  `COMPLEXITY_HARD_CAP - 10` (40), guaranteed to clear `inspect.ts`'s `SLOW_COMPLEXITY` (20) advisory
  threshold (`validate.ts:99-101`, `inspect.ts:55, 268-275`). A suspicious pattern is allowed to run and
  is nudged toward the "heavy pattern" chip, not blocked.
- Either way, `culprit` is attached whenever `analyzeRedos` produced a finding, even on an `ok: true`
  result (`validate.ts:96, 105`). A "safe" verdict (no findings) leaves `culprit` unset
  (`validate.test.ts:91-95`).

**When the pattern does not parse** (Annex-B-legacy-only syntax, `validate.ts:109-118`), there is no AST
to analyze, so `validateRule` falls back to the older, pre-R2X heuristic: `estimateComplexity`
(`validate.ts:32-45`) scores nested-quantifier shape via a single regex,
`/\([^()]*[+*][^()]*\)[+*]/` (`validate.ts:22`), plus flat point costs for backreferences, alternations,
quantifiers, and lookarounds. Here, and only here, a numeric `complexity >= COMPLEXITY_HARD_CAP` (50) is
itself the rejection condition (`validate.ts:110-116`). This path is described further under "Known gaps."

Rejected-pattern error strings, verbatim from the source, for anyone grepping logs or writing a test
against them: `"regex/validate: pattern exceeds 10000 characters"`, `"regex/validate: pattern is empty"`,
`"regex/validate: replacement exceeds 10000 characters"`, `"regex/validate: invalid pattern - <native
message>"`, `"regex/validate: pattern has nested quantifiers that risk catastrophic backtracking"`
(`validate.ts:54-116`).

## Enforced on every run, not just at save

`applyRule` in `src/core/regex/apply.ts` calls `validateRule(rule)` unconditionally, for every enabled
rule, on every single pass through the engine (`apply.ts:214-227`), immediately after the cheap
skip-reason checks (disabled, wrong phase, wrong target, depth window, edit gating;
`apply.ts:102-114, 209-212`) and before the pattern is ever compiled for real (`apply.ts:237-254`). There
is no separate "save-time only" validation path: the same gate runs from the editor's live Quick Try
preview (`rule-rail.tsx:72`, which calls `applyRules` directly), the test bench, and a real content pass,
regardless of which authoring mode (Guided, Plain-words, or raw Pattern) produced the stored
`find`/`flags`. If a rule is rejected, `apply.ts` returns a trace with `applied: false` and the
validation's `error` string, and the text passes through unchanged (`apply.ts:214-226`).

Once a pattern is accepted, `apply.ts` still budgets it: every rule compiles with the `d` flag for match
spans (`apply.ts:237-238`), and `runReplace` checks elapsed time against `timeoutMs` (default 100ms,
capped at 500ms, `apply.ts:28-29, 256`) before and between matches (`apply.ts:172-179, 184-191`). This
budget is a between-steps check, not a preemptive interrupt: the actual match call, `text.match(regex)` or
`text.matchAll(regex)` (`findMatches`, `apply.ts:116-120`), is one synchronous native call that the budget
cannot stop once it has started. This is exactly the gap `validate.ts:6-9` names: the AST screen is what
has to catch a real bomb, because the timeout cannot.

## What the user actually sees when a pattern is rejected

Two UI surfaces read `RuleValidation.error` and render it as plain text; neither currently renders the
`culprit` span:

- The per-rule Health card (`src/ui/apps/workbench/regex/rule-rail.tsx:126-158`) calls
  `validateRule(rule)` (`rule-rail.tsx:75`) and, when `!health.ok`, shows `health.error ?? "Check this
  pattern."` (`rule-rail.tsx:141-147`). This is the guided feedback a rule author sees while editing: the
  exact reason the pattern was refused, in the same string `validateRule` produced.
- The whole-set linter (`src/core/regex/inspect.ts:252-346`) calls `validateRule` on every enabled rule
  and, on `!v.ok`, pushes a `"broken-pattern"` finding whose `message` embeds `v.error`
  (`inspect.ts:258-267`): `` `${label(rule)} cannot run: ${v.error ?? "the pattern is not valid"}.` ``. A
  broken rule is excluded from the linter's downstream checks (duplicate/shadowing) for that pass
  (`inspect.ts:266, 318-321`).

`redos.ts:5` describes itself as "the underline source for QOL row 22 (the editor highlights
culpritSpan)," and `RuleValidation.culprit` is populated correctly on the dangerous path
(`validate.ts:96`, asserted in `validate.test.ts:80-95`). The suspicious path shares the same
culprit-attach expression (`validate.ts:99-105`), confirmed by code inspection, not by a test:
`validate.test.ts:80-95` covers only the dangerous and safe paths, never `severity ===
"suspicious"`. As of this reading, no file
under `src/ui/` reads `.culprit`: the only consumers of `validateRule`'s output in the UI are the two
plain-text surfaces above. The exact-span underline the AST layer was built to support is computed and
tested, but not yet wired to a rendered highlight.

## Guided mode's hit/miss chips are a separate feature, not a rejection report

`src/core/regex/guided-feedback.ts` is easy to mistake for a second "why was it rejected" surface because
it also touches user-typed examples and a compiled `RegExp`. It is not that. Its one export, `guidedMiss`,
builds the Guided-mode quiz card's "it will catch" preview (`mode-guided.tsx:1-11, 98-114`): it takes the
examples the author typed, the pattern `buildFromExamples` derived from them, and computes one unseen word
substituted into a real matching example, rendered struck through only if the compiled pattern truly
rejects it (`guided-feedback.ts:1-13, 54-81`). It never reports a validation failure and carries no notion
of severity or culprit span.

It also does not go through the ReDoS gate. `compile()` (`guided-feedback.ts:20-32`) builds its own
`new RegExp(find, flags)` directly, with no call to `validateRule` or `analyzeRedos`, and swallows a
compile failure by returning `null` (no miss chip shown), not by surfacing an error. This module's own
safety property rests on being read-only analysis against a `String.test` call, never `eval`
(`guided-feedback.ts:11-13`), not on the ReDoS screen. The pattern this preview compiles comes from
`buildFromExamples` (a deterministic word/phrase builder), not from raw author-typed regex syntax; this
page does not verify that builder's output shape and makes no claim about it either way.

This is not an execution-path bypass of the gate: when the guided-mode wizard writes `find`/`flags` onto
the rule (`mode-guided.tsx:53-57`, `onPatch`), that stored pattern is subject to the same
`validateRule`-before-compile gate as any other rule, on every subsequent `applyRules` pass
(`apply.ts:214`), regardless of which mode authored it. The gap is narrower and specific to the
guided-mode wizard itself: `guidedMiss`'s own preview compile runs on every keystroke in that wizard,
ahead of and independent from the gate that protects everything downstream.

## Known gaps

Stated plainly, per the code's own honesty posture (`validate.ts:6-9`, `redos.ts:9-10`):

- **The timeout is not a preemptive interrupt.** A pattern the AST screen fails to flag as `dangerous`
  (a false negative, which the detector's own precision-over-recall design treats as an accepted
  possibility, `redos.ts:9-10`) can still hang the thread inside a single synchronous `RegExp.match`/
  `matchAll` call (`apply.ts:116-120`) for as long as the input keeps it busy. The `timeoutMs` budget only
  ever gets checked between steps, never during one (`apply.ts:172-191`).
- **The fallback heuristic, used only when the AST parser refuses a pattern, is materially weaker.** It
  catches the classic nested-quantifier textual shape (`NESTED_QUANTIFIER`, `validate.ts:22`) but has no
  equivalent for overlapping-alternation or quantified-backreference bombs; those two shapes are only
  caught by the AST path (`validate.test.ts:62-70` names this exact gap being closed for `(a|a)+b`, but
  only for patterns that DO parse under the strict grammar). This fallback is reached only for the narrow
  Annex-B-legacy-only syntax set the parser deliberately refuses (`parser.ts:7-12`), not for ordinary
  patterns.
- **`v`-flag set-notation patterns likely fall into that same weaker fallback.** `validate.ts` never
  passes the rule's real flags into `parseRegex` (`validate.ts:87`), and `parseClass`
  (`parser.ts:319-346`) has no branch for the `v`-flag set operators (`--`, `&&`). A pattern that a
  `v`-flag-capable host `RegExp` would accept at the native syntax-check step (`validate.ts:74`) but that
  actually uses set-notation syntax would very likely fail this AST parse and drop into the same
  weaker heuristic described above. This was not exercised against a live pattern for this page; it is a
  read of the parser's grammar coverage, not a measured result.
- **Character-set overlap is a coarse approximation**, not full class algebra (`redos.ts:21-23`). It is
  built to only ever push a verdict toward `suspicious`/`dangerous` on ambiguity, never to hide a real
  overlap, but it is a heuristic, not a proof.
- **The exact-span editor underline described in `redos.ts:5` is not currently rendered anywhere.**
  `RuleValidation.culprit` is computed and tested but has no UI consumer today (see above); do not assume
  a rejected pattern's exact culprit is visible to the author beyond the plain-text `error` message.

None of the above weakens the core claim: every pattern that reaches this gate is analyzed as an AST
before it is ever compiled, on every execution, and a pattern the AST analysis calls `dangerous` is never
run. The gaps above are about coverage at the analysis's edges (fallback syntax, `v`-flag set-notation, UI
wiring), not about the gate being bypassable for an ordinary pattern that parses.

## Source of truth

| Concern | File |
| --- | --- |
| ECMAScript AST parser, never executes | `src/core/regex/ast/parser.ts` |
| AST node shapes, spans | `src/core/regex/ast/ast-types.ts` |
| Structural ReDoS analysis, culprit spans, severity | `src/core/regex/ast/redos.ts` |
| The gate: `validateRule`, length caps, complexity, fallback heuristic | `src/core/regex/validate.ts` |
| Flags derivation shared between the gate and the runtime | `src/core/regex/ast/dialect.ts` |
| Runtime: validate-before-compile, per-rule timeout/match-count budget | `src/core/regex/apply.ts` |
| Whole-set linter, `broken-pattern` / `slow-pattern` findings | `src/core/regex/inspect.ts` |
| Per-rule Health card (plain-text rejection reason) | `src/ui/apps/workbench/regex/rule-rail.tsx` |
| Guided-mode hit/miss chips (a separate feature, not a rejection report) | `src/core/regex/guided-feedback.ts` |
| Guided-mode wizard that consumes it | `src/ui/apps/workbench/regex/mode-guided.tsx` |
| Fixtures for every severity tier and the exact culprit span | `src/core/regex/ast/redos.test.ts`, `src/core/regex/validate.test.ts` |
