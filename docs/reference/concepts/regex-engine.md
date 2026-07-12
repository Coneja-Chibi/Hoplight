# Concept: the regex engine

How vaud actually RUNS a regex set. Source of truth: `src/core/regex/` (pure, no side effects).
The entity it operates on is [entities/regex.md](../entities/regex.md); per-platform field/phase
truth lives in `src/core/regex/capabilities.ts` + `platform-fields.ts` (the position-picker law:
per-platform facts live in the matrix, never a UI literal).

**Safety posture (absolute):** a rule is DATA. Execution is a budgeted `String.replace` - never
`eval`, never `new Function`, never a payload. Rule output that looks like HTML renders only through
`SealedHtmlPreview`. Risu `<cbs>` flag tokens are stored verbatim and stripped before compiling.

## The pipeline (`apply.ts`)

`applyRules(rules, text, options)` runs one deterministic pass in `sortOrder`:

- Every rule is compiled with the `d` flag appended so match/group SPANS come back from the engine
  itself (`TraceMatch { whole, groups }`) - the bench's capture chips and diffs are engine truth,
  not re-derivation.
- Per-rule time budget plus an optional whole-set budget (`setBudgetMs`); a rule that blows either
  is SKIPPED with a plain `skipReason` (`timeout` / `set-budget` / `phase` / `off` / `condition`),
  never a crash.
- `condition: { ruleId, matched }` chains a rule on whether an EARLIER rule applied-and-matched
  (one pass, no forward references; unknown or forward refs read as not-matched).
- `overlay: true` rules match WITHOUT mutating - their spans come back on a separate
  `overlays` channel for display-layer painting.
- `firstMatchOnly: true` replaces only the first hit even under the `g` flag.

Replacement text goes through `replace-ops.ts`: `$1`-style groups, `{{match}}` sugar, and the
`\u \l \U \L \E` case transforms, with exact escape-handling parity between the runtime and the
travel lint.

## The AST layer (`ast/`)

A clean-room ECMAScript u-mode regex parser (fuzz-checked against the host `RegExp` as oracle),
with spans on every node. Everything explanatory is built on it:

- `explainAst` - the plain-words reading shown under the Find box (exhaustive over node kinds,
  honest about ASCII `\w`/`\b`).
- `examplesFor` - generated example matches, each VERIFIED by executing the real regex before
  display (engine-truth rule: never show a match the engine did not confirm).
- `analyzeRedos` - catastrophic-backtracking detection with culprit spans; `validate.ts` delegates
  to it and falls back to the old heuristic only for patterns the parser refuses.
- `dialect.ts` - tolerant flag-token parsing (`gu<cbs>`) for imports.

## Travel honesty (`travel-lint.ts`)

All five platforms execute JS RegExp, so cross-platform divergence is a LINT, not a parser fork.
`travelLint(rule, profile)` reports, with spans: replace/flag extensions the destination engine will
not run ({{match}}, case transforms, `<cbs>` tokens), engine-only rule fields (condition / overlay /
first-match-only), and host-age risks (look-behind, `v` flag). The editor renders these dashed-amber
under the active Write-for lens; nothing is blocked or mangled.

## The builder (`builder.ts` + `word-boundary.ts` / `word-family.ts`)

The plain-words layer the Guided and Plain-words modes stand on: word/phrase lists in, pattern +
explanation + execution-verified examples out, with unicode-aware boundaries for space-less scripts
(the whole-word toggle drops out honestly where `\b` would lie) and the structure atoms (numbers,
anything-between, line anchors). Round-trips through `explainPattern`, which carries the full AST
reading for any parseable pattern.
