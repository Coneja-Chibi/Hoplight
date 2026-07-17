# Spec: The Macro Engine

**Package:** `packages/macros` · **Milestone:** M2 (engine + evaluator subset), wired
live at M5 (Test Stage) · **Status:** draft
**Depends on:** specs/formats/canonical-model.md, specs/formats/escrow-and-roundtrip.md
**VAUDEVILLE reference:** `apps/rc/src/lib/macros/tokenizer.ts`,
`apps/rc/src/lib/macros/processor.ts`, `apps/rc/src/lib/macros/registry.ts`,
`apps/rc/src/lib/macros/types.ts`, `apps/rc/src/lib/macros/scopes.ts`,
`apps/rc/src/lib/macros/handlers/*`, `apps/rc/src/lib/macros/__characterization__/*`

## Purpose

The macro engine parses `{{macro::arg1::arg2}}`-style templates (SillyTavern-dialect
macros, RC extensions, Lumiverse-compat tokens) into an AST, then evaluates that AST
against a `MacroContext` to produce expanded text plus a trace of what fired. It is
the shared machinery behind three later features: the Test Stage's prompt assembly
(specs/engine/prompt-assembly.md), the agent loop's persona/variable substitution,
and the Script Doctor's macro lint pass (deterministic pass, no evaluation).

Character cards, lorebook entries, and preset prompts all carry raw macro text as
plain strings in their prompt-bearing fields. **The macro engine is never invoked
during codec parse/serialize.** Conversion (`vaud convert`, `vaud inspect`) treats
macro text as opaque string content and round-trips it byte-for-byte; that is a
requirement of the Round-Trip Law (specs/formats/escrow-and-roundtrip.md), not an
oversight. The engine only runs when something is actually being assembled or
rendered for a human or a model: the Test Stage, the agent loop, and (read-only,
non-evaluating) the Script Doctor's macro lint.

## Behavior

### Pipeline

Ported from `processMacros` (VAUDEVILLE `processor.ts:687-776`). Stages run in this
order; every stage is pure except the evaluate stage, which may write to
`context.localVariables` / `context.globalVariables` / `context.counters`:

1. **Pre-interceptors** — pluggable hooks (`registerMacroInterceptor`, `phase: 'pre'`)
   see the raw template before any normalization. Studio equivalent: extension
   point for future features (e.g. Understudy-gated macro families), not exercised
   by M2.
2. **Hide escaped braces** — `\{\{ ... \}\}` becomes sentinel characters
   (`\x01`/`\x02`) so escaped braces survive parsing untouched, restored to literal
   `{`/`}` at the end (`processor.ts:245-256`).
3. **Angle-token rewrite** — legacy `<user>`, `<char>`, `<bot>` (pre-macro-era ST/forum
   cards) become `{{user}}` / `{{char}}` (`processor.ts:707-708`).
4. **Dot-notation preprocessing** — `{{.x}}` -> `{{getvar::x}}`, `{{.x++}}` ->
   `{{incvar::x}}`, `{{.x = y}}` -> `{{setvar::x::y}}`, `{{.x <= y}}` ->
   `{{compare::{{getvar::x}}::<=::y}}`, `{{$x}}` -> `{{getglobalvar::x}}` (never
   `{{$1}}`/`{{$2}}`, reserved for positional macro args) (`processor.ts:97-120`).
5. **Space-syntax normalization** — `{{roll 1d20}}` -> `{{roll::1d20}}`,
   `{{setvar x 5}}` -> `{{setvar::x::5}}`, for a fixed macro-name allowlist
   (`processor.ts:126-138`).
6. **Single-colon normalization** — `{{getvar:x}}` / `{{roll:1d50}}` etc. (tolerant
   single-colon dialect from some imported presets) become the canonical `::` form;
   the regex's `(?!:)` guard means canonical `::` content never matches
   (`processor.ts:717-720`).
7. **Parse** — `parseNodesCached(text)` -> `ASTNode[]`, LRU-cached (256 entries) on
   the exact post-preprocessing string (`processor.ts:183-201`).
8. **Evaluate** — tree-walk the AST against `context`, producing output text plus
   `expansions`, `errors`, `sideEffects`, `touchedVariables`, `cacheable`.
9. **Post-process whitespace** — the `{{trim}}` sentinel (`\x04`) collapses its
   surrounding whitespace; 3+ consecutive newlines collapse to 2
   (`processor.ts:668-676`).
10. **Restore escaped braces** — sentinels from stage 2 become literal `{`/`}`.
11. **Post-interceptors** — hooks see the final expanded text.

Four sentinel characters are reserved by the pipeline and must never leak into
evaluated output: `\x01`/`\x02` (escaped-brace hiding, stage 2), `\x03` (a phase
orchestrator's placeholder delimiter, used by an outer caller layered on top of this
engine, not by the engine itself), `\x04` (trim marker, stage 9). If literal
occurrences of these control characters appear in user input, the pipeline must
still round-trip correctly around them — the characterization corpus injects them
deliberately as a collision-hazard category.

### Stage 1: tokenizer/parser (universal, ported in full)

The reference implementation (`tokenizer.ts`) is a single fused
scan-and-parse function, `parseNodesV2(text): ASTNode[]`, not two literal
separate passes despite the "two-stage" framing in the extraction brief. Internally
it interleaves two concerns that the studio port should keep conceptually distinct
(and MAY split into literal functions `scanMacroTokens` / `parseTokens` as an
implementation refinement — this is a naming target for the port, not a claim about
the current VAUDEVILLE code):

- **Lexing concern** (`lexMatchingClose`, `lexSplitArgs` in `tokenizer.ts:76-130`):
  find the `}}` that closes a given `{{`, and split a tag's inner content on `::`
  at brace-depth 0.
- **Parsing concern** (`parseNodesV2`'s main loop, `tokenizer.ts:285-443`, plus
  `parseBlockIf` and `findBlockTerminator`): classify each tag against an ordered
  cascade and build the AST.

This is a **clean-room, from-scratch parser** built to be behaviorally identical to
an older recursive-descent parser (`parseNodes`, now deleted from VAUDEVILLE and
replaced by a thin delegation to `parseNodesV2` at `processor.ts:220-222`) — proven
byte-identical via the ~2153-test characterization corpus described below. The
studio's port has no legacy parser to match against; it should treat `parseNodesV2`
itself, plus the corpus, as the sole ground truth for correct behavior.

**Bracket matching (`lexMatchingClose`).** `openPos` points at the first `{` of an
opening `{{`. Scan forward: a lone `{` or `}` (not doubled) is an ordinary
character, only `{{` (depth+1) and `}}` (depth-1) move the pair-scan depth. The
first `}}` that returns depth to 0 is the match; its function return value is the
index of that `}}`'s first `}`. Consequence: `{{{char}}}` has inner content
`{char` (the leading lone `{` folds into the tag content, to be trimmed/interpreted
by the classifier); `{{{{char}}}}` has inner content `{{char}}` (an unmatched-looking
nested pair that is itself just literal text inside the tag, since neither `{{`
here opens a *new* macro tag from the lexer's point of view — the outer `{{`/`}}`
already consumed the depth budget). Unmatched `{{` (no closing `}}` found before EOF)
degrades: the rest of the stream from that `{{` becomes one TEXT node.

**Arg splitting (`lexSplitArgs`).** Splits a tag's raw inner content on `::` only
at brace-depth 0 (so `{{if::{{getvar::x}}::yes}}`'s first split point is the `::`
right after `if`, not the ones inside the nested `{{getvar::x}}`). Depth is tracked
independently of `lexMatchingClose`'s scan and is **never floored at 0**: a stray
unmatched `}}` inside the content drives depth negative, and once negative a later
`::` can never be seen as "depth 0" again until enough `{{` bring it back to zero.
This is an intentional quirk to preserve, not a bug to fix.

**Classification cascade.** Each `{{...}}` tag's trimmed inner content is tested
against seven cases, in this exact order (first match wins) — the order matters
because forms overlap (e.g. `if::x` could otherwise look like an inline macro named
`if`):

1. **Block-if, space/hash form.** `/^if\s/i` (and NOT `/^if::/i`), or `/^#if\s/i`.
   The condition is everything after `if `/`#if ` up to the tag's own close. Then
   `parseBlockIf` scans forward from just past that close for the matching
   `{{/if}}` / `{{endif}}` / `{{/#if}}` / `{{//if}}`, honoring nested `if`/`#if`/
   colon-form `if::` opens (depth-tracked) and the first `{{else}}` /
   `{{else if...}}` at depth 1. No matching terminator -> the head tag becomes a
   literal TEXT node and parsing resumes just past it (malformed block, not an
   error).
2. **Block-if, colon form.** `{{if::COND}}` qualifies ONLY when `lexSplitArgs`
   on the content after `if::` yields exactly one part (`isColonBlockIfOpen`,
   `tokenizer.ts:143-145`) — `{{if::a::b}}` (two or more parts) is NOT a block
   opener, it falls through to case 7 (the inline `if` macro, a ternary-style
   conditional). If the single-arg colon form has no matching `{{/if}}`, it also
   falls through to case 7 rather than becoming literal text (this differs from
   case 1's malformed-block behavior).
3. **Block-trim.** Bare `{{trim}}` (trimmed content exactly `"trim"`, case
   insensitive) with a matching `{{/trim}}` found via `findBlockTerminator`.
   Every `{{trim}}` occurrence opens a nested block (trim has no inline form, so
   there is no desync guard to apply). No matching close -> falls through to case 7
   (inline macro named `trim`, which most likely resolves as unknown).
4. **Block-setvar / block-setglobalvar.** `{{setvar::NAME}}...{{/setvar}}` (or the
   `setglobalvar` pair). Qualifies only when the content after the `setvar::` /
   `setglobalvar::` prefix splits (via `lexSplitArgs`) into exactly one part (the
   variable name) — `{{setvar::x::5}}` (two parts) is the inline single-shot form,
   not a block. `findBlockTerminator`'s `opensBlock` check applies the same
   single-arg test to every candidate opener it scans past, so a nested inline
   `{{setvar::y::z}}` inside the block body does not desync the depth count. No
   matching close -> falls through to case 7.
5. **Orphan terminators.** `/if`, `endif`, `/#if`, `//if`, `else`, `else if...`
   (colon or space form), `/trim`, `/setvar`, `/setglobalvar` appearing without an
   enclosing block are silently consumed: no AST node is emitted, parsing resumes
   just past the tag. This is what makes stray leftover terminators (e.g. from a
   user editing out an `{{if}}` but leaving its `{{/if}}`) inert instead of erroring.
6. **Comment.** Trimmed content starting with `//`. Name is fixed as `"//"`; the
   entire remainder after `//` (trimmed) becomes ONE unsplit argument (not run
   through `lexSplitArgs` — a comment body containing `::` stays one string). The
   comment handler is expected to return empty output.
7. **Inline macro (fallback).** `lexSplitArgs` splits the raw inner content; part 0
   (trimmed, lowercased) is the macro name; parts 1..n are parsed recursively as
   nested `ASTNode[]` argument trees (so an argument may itself contain macros,
   evaluated depth-first at evaluation time, not parse time).

### Stage 2: evaluator (a subset, gated by context availability)

The evaluator is a tree-walking interpreter (`evaluateNodes` /
`evaluateMacroNode` / `evaluateBlockIfNode` / `evaluateBlockSetvarNode`) over the
AST from stage 1, threading an `EvalState` (`expansions`, `errors`, `sideEffects`,
`expansionCounter`, `touchedVariables`, `volatileHit`) and a `MacroContext`.

Node evaluation:

- **text** — appended verbatim.
- **macro** — args evaluated depth-first (each evaluated arg `.trim()`-ed, matching
  the legacy `parseMacro`'s per-arg trim, EXCEPT for **lazy** macros, whose args are
  handed over as `{ raw, evaluate() }` thunks so the handler controls whether/when/
  how many times each arg is evaluated, without a forced trim). The registry is
  looked up by name; unknown macro -> the tag is reconstructed from its evaluated
  args as literal output text and recorded in `state.errors` (this is the
  "unevaluated macro passes through as text" behavior — see the evaluation-scope
  contract below). If the handler's return value itself contains `{{...}}` (e.g. a
  variable holding macro text), that value is re-parsed and evaluated recursively
  (one more `depth+1` tree-walk) — this is how `{{getvar::snippet}}` can expand a
  stored macro-bearing string.
- **blockIf** — condition subtree evaluated to text, then run through
  `resolveConditionShorthands` (rewrites bare `.name`/`$name` left over from
  condition text the dot-notation preprocessor doesn't reach, e.g. inside
  `{{if .var <= 25}}`) and `evaluateBlockCondition` (comparison operators
  `=== !== == != >= <= > <` tried first via regex, then `!`-negation, then bare
  truthiness — `""`, `"false"`, `"0"`, `"null"`, `"undefined"` (case-insensitive,
  trimmed) are falsy, everything else truthy). Only the taken branch
  (then/else) is evaluated — this is short-circuit, so side-effect macros in the
  untaken branch never fire.
- **blockSetvar** — name and content subtrees evaluated and trimmed; a no-op if the
  name is empty or `context.readOnly` is set; otherwise writes
  `{ value, createdAt, updatedAt }` into `context.localVariables` or
  `context.globalVariables` and records a `setLocalVar`/`setGlobalVar` side effect.
- **blockTrim** — content evaluated then `.trim()`-ed directly (distinct from the
  inline `{{trim}}` macro handler, which likely emits the `\x04` sentinel for
  post-process-time whitespace collapse against neighboring text — confirm against
  the ported `text.ts` handler when porting).

Evaluation depth is capped at `MAX_EVAL_DEPTH = 100`; past that, `evaluateNodes`
returns `''` for the remaining subtree (a circuit breaker against runaway
recursive expansion, not an error the caller sees directly).

Two orthogonal per-run signals ride along with the text result and matter to
callers that cache assembled prompts:

- `cacheable = !volatileHit && sideEffects.length === 0`. `volatileHit` becomes
  true the first time a macro in the built-in volatile set (`random`, `pick`,
  `roll`, `dice`, `range`, `coinflip`, `percent`, `shuffle`, `weighted`, `time`,
  `date`, `weekday`, `isodate`, `isotime`, `idle_duration`, `season`, `moonphase`,
  `zodiac`, `year`, `month`, `day`, `datetimeformat`, `timediff`) or any
  `MacroDefinition.volatile: true` fires (`registry.ts:93-106`).
- `touchedVariables`: `"scope:name"` strings for every `localVariables`/
  `globalVariables` **read** during the run, collected via a `Proxy` wrapper
  around each variable `Map` that records on `.get`/`.has` and passes writes
  through unchanged (`processor.ts:304-321`). This is the read-set fingerprint a
  caller can use to decide whether a cached expansion is still valid: it stays
  valid iff the run was `cacheable` AND none of its `touchedVariables` changed
  value since.

### Variable scopes (`scopes.ts`)

`setvar`/`getvar` (and the `addvar`/`incvar`/`decvar`/`hasvar`/`delvar` family)
operate on a bare key by default, resolving to the **session** scope: no prefix,
stored directly under that key name in `localVariables`. A recognized `scope:`
prefix on the key routes to a different namespace, all still backed by the same
two `Map`s (`localVariables` for everything except `global`, which uses
`globalVariables`):

| Prefix | Scope | Storage key | Map |
|---|---|---|---|
| (none) | session | `rest` (unprefixed) | local |
| `session:` | session | `rest` | local |
| `character:` / `char:` | character | `` `_char_${characterId or characterName or "unknown"}_${rest}` `` | local |
| `arc:` | arc | `` `_arc_${rest}` `` | local |
| `scene:` | scene | `` `_scene_${rest}` `` | local |
| `global:` | global | `rest` | global |

Any other `foo:` prefix is not a recognized scope and is left as a literal part of
the variable name (so existing templates using `:` inside a plain variable name are
unaffected). `setglobalvar`/`getglobalvar` (and `$name` dot-shorthand) always target
`globalVariables` directly, independent of the scope-prefix mechanism.

### Preprocessing normalization forms (recap, see pipeline stages 4-6)

Three families of shorthand exist purely as **input normalization** ahead of
parsing — they rewrite text to canonical `{{macro::arg::arg}}` form before the
parser ever sees it, so the parser and evaluator never need to know these forms
exist:

- Dot/dollar notation: `{{.x}}`, `{{.x++}}`, `{{.x--}}`, `{{.x += y}}`,
  `{{.x -= y}}`, `{{.x OP y}}` (comparison), `{{.x = y}}`, `{{$x}}`.
- Space-separated form for a fixed allowlist of macro names (`roll dice incvar
  decvar getvar var hasvar delvar` and the `global`/`gvar` variants, plus the
  two/three-arg `setvar`/`addvar`/`setglobalvar`/`addglobalvar` families).
- Single-colon form (`{{getvar:x}}`) for the same random/roll + variable macro
  families, normalized to `::`.

### The evaluation-scope contract (which macros run locally vs pass through)

The architecture doc (`docs/02-ARCHITECTURE.md`) describes `packages/macros` as
"the macro tokenizer/parser ... + evaluator subset" — the parser is universal, the
evaluator is not. The studio's `MacroContext` is deliberately smaller than RC's
(RC's is DB- and Orison-coupled; see "Public API sketch" below), so a macro
category can end up in one of three buckets:

1. **Evaluated locally, always** (any caller with a `Character`/`Persona` loaded,
   no live session needed): `identity` (char/user/persona/model name fields),
   `pronouns`, `text` (case/trim/string transforms), `conditional` (the block-if
   machinery plus inline `{{if::cond::then::else}}` and friends),
   `variables` (setvar/getvar family, all scopes), comments (`//`), `random` (seeded
   via `context.randomSeed` when the caller wants determinism, e.g. golden tests),
   `time` (wall-clock, or `context.timezone`/`context.locale` if the caller pins
   them). These require only a canonical `Character`/`Persona`/`Preset` plus a bare
   `MacroContext`.
2. **Evaluated only when Test Stage / assembly supplies the data** (M5): `chat`
   category macros that read `messages`/`messageCount`/`chatId` (e.g. message-count
   or last-message macros), lorebook-introspection macros reading
   `triggeredEntries`/`activeLorebooks` (populated by the lorebook engine's
   activation pass, specs/engine/lorebook-engine.md), and `preset`
   category macros reading `presetPrompts` (populated by preset-loading during
   assembly, for `{{enabled::id}}`-style toggle introspection). Outside an assembly
   context these fields are simply absent/empty on `MacroContext`, so the macros
   resolve to their handler's empty/false default rather than erroring — callers
   that only have a bare character (e.g. `vaud inspect --resolve-macros`, if such a
   flag ever exists) get a best-effort, chat-context-free expansion.
3. **Not ported / no studio home**: fields that are pure RC product surface with no
   Vaudeville Studios equivalent — `orisonPreferences`/`orisonPreferenceBlock` (RC's
   AI-memory feature), `chatMemories`/`chatSummary` (RC's summarization pipeline),
   `characterAccentColor`/`characterPalette`/`characterGradient` and the persona
   equivalents (RC `details` JSONB presentation fields, out of canonical-model
   scope per specs/formats/canonical-model.md's "Identity/presentation metadata"
   note only covering `identity`/`presentation` groups, not RC-specific color
   theming), `groupCardMode`/`focusedCharacter*`/`groupMembers` (RC's group-chat
   model). Any macro reading one of these context fields resolves to that macro's
   own not-present default (usually `''`), same as bucket 2 outside assembly — it
   does not become an "unknown macro" (the macro IS known and registered; only its
   backing context field is absent). This is behaviorally identical to bucket 2 from
   the engine's point of view; the distinction is about product scope, not engine
   mechanics, and is listed separately so a reviewer doesn't expect these fields to
   ever appear on the studio's `MacroContext`.

Conversion-time codecs (bucket: none of the above) never call the evaluator at all;
macro text is opaque payload they pass through untouched.

**Unknown macros** (name not in the registry, not a typo match) do not error the
whole run: `expandSingleMacro` returns `success: false`, the evaluator reconstructs
the original tag text (from the macro name and its now-evaluated args) and appends
it as literal output, and one entry is added to `state.errors`. This means template
text targeting a dialect the studio doesn't (yet) implement degrades gracefully to
visible literal `{{macroname::args}}` in output rather than silently vanishing or
throwing.

### Interceptors and templates/overrides

`registerMacroInterceptor` / `unregisterMacroInterceptor` / `clearMacroInterceptors`
register named `{ id, phase: 'pre'|'post', fn }` hooks that see, respectively, the
raw template before preprocessing or the fully expanded+restored text. Studio port
should keep this extension point (used by future features to intercept macro text
without becoming a registered macro), even if M2 ships no interceptors itself.

`context.templates` (`{{template::name::body}}` definitions) and
`context.blockOverrides` (`{{override::name::content}}` registrations) are
ephemeral, per-assembly maps threaded through `MacroContext` for macros that define
and later reference named template snippets within one assembly run. OPEN QUESTION:
the exact handler semantics for `template`/`override` were not read as part of this
spec (they live in handler files not enumerated in the brief's ground-truth list);
port them from whichever handler module registers them, verified against the
characterization corpus.

### Characterization-test porting plan

VAUDEVILLE's macro parser has no independent "spec test suite" — its correctness
contract IS the characterization corpus:

- `apps/rc/src/lib/macros/__characterization__/corpus.ts` — ~pure data, `CORPUS:
  CorpusEntry[]`, each entry `{ id, category, input, note? }`. Categories: `text`,
  `inline`, `escaped`, `angle`, `dotdollar`, `spaceform`, `singlecolon`, `blockif`,
  `trim`, `setvar`, `orphan`, `comment`, `unknown`, `unterminated`, `whitespace`,
  `lazyvolatile`, `template`. Deliberately includes the raw sentinel characters
  (`\x01\x02\x03\x04`) as a collision-hazard category, and the two documented
  desync/malformed-block edge cases per category.
- `parser-ast.test.ts` — snapshots each corpus entry's AST shape (via a
  `__parseForTest` escape hatch) against a golden snapshot
  (`__snapshots__/parser-ast.test.ts.snap`).
- `duplicate-parsers-agreement.test.ts` — historically diffed the old
  recursive-descent parser against `parseNodesV2`; now that the legacy parser is
  deleted, this file's role in the studio port is moot (it has nothing left to
  diff against) UNLESS the port temporarily keeps two implementations during its
  own bring-up, in which case the same technique (differential test over the full
  corpus) is the right tool.
- `preprocessing-effects.test.ts` — exercises the six preprocessing stages
  (dot-notation, space-syntax, single-colon, angle-token, escaped-brace hiding)
  against the corpus.
- `processor-golden.test.ts` — full-pipeline golden snapshots (`processMacros`
  output: text, expansions, errors) against
  `__snapshots__/processor-golden.test.ts.snap`.

**Porting plan for the studio package:**

1. Port `corpus.ts` first, unmodified in content (it is pure data with no import
   of parser internals — the file's own header enforces this). This is "the
   asset" per `docs/05-EXTRACTION-MAP.md`.
2. Port the parser (`tokenizer.ts` lineage) second, against the corpus, using the
   snapshot files as the oracle. Do NOT hand-transcribe the snapshots; regenerate
   them from the ported parser and diff against VAUDEVILLE's committed snapshots
   file-for-file before trusting a match (a snapshot regenerated from a subtly
   wrong port will "pass" against itself).
3. Port the evaluator + registry + scopes third, re-running `processor-golden`
   equivalents against a studio `MacroContext` built to match whatever fixture
   context VAUDEVILLE's golden tests use (character name, user name, seeded
   random, fixed clock) — OPEN QUESTION: the exact fixture `MacroContext` values
   the golden snapshots were generated against were not read; re-derive them from
   `processor-golden.test.ts`'s setup when porting, since the snapshot values are
   sensitive to `characterName`/`userName`/`randomSeed`/clock.
4. **`tokenizer.ts` was UNCOMMITTED in VAUDEVILLE as of 2026-07-02** per
   `docs/05-EXTRACTION-MAP.md` — coordinate with Chi before extracting; the file
   may have moved or changed shape by the time a ticket executes this port.

## Public API sketch

```ts
// packages/macros/src/types.ts

/** Minimal, dependency-light context. No DB coupling, no RC product fields. */
export interface MacroContext {
  // Always available once a Character/Persona is loaded
  characterName: string;
  characterDescription?: string;
  characterPersonality?: string;
  userName: string;
  userPersona?: string;
  modelName?: string;
  scenario?: string;
  firstMessage?: string;
  mesExamples?: string[];
  characterPronouns?: PronounSet;
  userPronouns?: PronounSet;
  characterId?: string; // for character: scope namespacing

  // Variable storage (always available; empty maps if unused)
  localVariables: Map<string, MacroVariable>;
  globalVariables: Map<string, MacroVariable>;
  userMacros: Map<string, string>;
  templates?: Map<string, string>;
  blockOverrides?: Map<string, string>;
  counters?: Map<string, number>;

  // Determinism hooks (bucket 1 macros use these when the caller wants
  // reproducible output — golden tests, previews)
  randomSeed?: number;
  timezone?: string;
  locale?: string;

  // Populated ONLY by the Test Stage / assembly package (bucket 2). Absent
  // (undefined) outside an assembly run — macros reading these resolve to
  // their handler's own empty/false default, they do not error.
  messages?: ChatMessage[];
  messageCount?: number;
  chatId?: string;
  triggeredEntries?: TriggeredEntry[];
  activeLorebooks?: LorebookReference[];
  presetPrompts?: PresetPromptInfo[];

  /** Side-effect macros become no-ops; read macros unaffected. Used when
   *  re-rendering already-committed history so old setvar calls don't refire. */
  readOnly?: boolean;
}

export interface PronounSet { they: string; them: string; their: string; theirs: string; themself: string; }
export interface MacroVariable { value: MacroVariableValue; createdAt: Date; updatedAt: Date; }
export type MacroVariableValue = string | number | boolean | null | MacroVariableValue[] | { [k: string]: MacroVariableValue };

export interface MacroResult {
  value: string;
  success: boolean;
  error?: string;
  sideEffects?: MacroSideEffect[];
}

export interface MacroSideEffect {
  type: 'setLocalVar' | 'setGlobalVar' | 'deleteLocalVar' | 'deleteGlobalVar';
  key: string;
  value?: MacroVariableValue;
  cause?: string;
}

export type MacroHandler = (args: string[], context: MacroContext) => MacroResult;

export interface LazyMacroArg { raw: string; evaluate: () => string; }
export type LazyMacroHandler = (args: LazyMacroArg[], context: MacroContext) => MacroResult;

export type MacroCategory =
  | 'identity' | 'time' | 'random' | 'chat' | 'variables'
  | 'conditional' | 'text' | 'lorebook' | 'pronouns' | 'preset';

export interface MacroDefinition {
  name: string;
  aliases?: string[];
  description: string;
  handler: MacroHandler;
  lazyHandler?: LazyMacroHandler;
  category: MacroCategory;
  hasSideEffects?: boolean;
  volatile?: boolean;
}

export interface MacroExpansion { original: string; expanded: string; macroName: string; depth: number; }
export interface MacroError { macro: string; message: string; }

export interface MacroProcessResult {
  text: string;
  expansions: MacroExpansion[];
  errors: MacroError[];
  sideEffects: MacroSideEffect[];
  touchedVariables: string[];
  cacheable: boolean;
  stats: {
    totalMacros: number;
    successfulExpansions: number;
    failedExpansions: number;
    nestingDepthReached: number;
    processingTimeMs: number;
  };
}

// packages/macros/src/registry.ts
export function registerMacro(definition: MacroDefinition): void;
export function registerMacros(definitions: MacroDefinition[]): void;
export function getMacro(nameOrAlias: string): MacroDefinition | undefined;
export function getMacroHandler(nameOrAlias: string): MacroHandler | undefined;
export function hasMacro(nameOrAlias: string): boolean;
export function isVolatileMacro(nameOrAlias: string): boolean;
export function getAllMacros(): MacroDefinition[];
export function getMacrosByCategory(category: MacroCategory): MacroDefinition[];
export function clearRegistry(): void; // test-only

// packages/macros/src/tokenizer.ts
/** Universal, context-free: text -> AST. Used by parse, lint, and evaluate. */
export function parseMacroNodes(text: string): ASTNode[];
export type ASTNode = TextNode | MacroCallNode | BlockIfNode | BlockSetvarNode | BlockTrimNode;

// packages/macros/src/processor.ts
export function processMacros(text: string, context: MacroContext): MacroProcessResult;
export function containsMacros(text: string): boolean;
export function createDefaultContext(overrides?: Partial<MacroContext>): MacroContext;
export function evaluateConditionExpression(condition: string): boolean;
export function registerMacroInterceptor(interceptor: MacroInterceptor): void;
export function unregisterMacroInterceptor(id: string): void;
export function clearMacroInterceptors(): void;
export interface MacroInterceptor { id: string; phase: 'pre' | 'post'; fn: (text: string, context: MacroContext) => string; }

// packages/macros/src/scopes.ts
export type VariableScope = 'session' | 'character' | 'arc' | 'scene' | 'global';
export interface ResolvedVariableTarget { scope: VariableScope; key: string; isGlobal: boolean; }
export function resolveVariableTarget(rawKey: string, context: Pick<MacroContext, 'characterId' | 'characterName'>): ResolvedVariableTarget;
export function mapForTarget(target: ResolvedVariableTarget, context: MacroContext): Map<string, MacroVariable>;
export function effectTypesForTarget(target: ResolvedVariableTarget): { set: 'setLocalVar' | 'setGlobalVar'; del: 'deleteLocalVar' | 'deleteGlobalVar' };
```

Not sketched: the individual macro handler modules (identity/time/random/text/
conditional/variables/pronouns/lumiverse-compat/etc). Their per-macro catalog is a
separate, later document (not this spec) — this spec covers the machinery (parse,
evaluate, registry, scopes) and the categories, not every macro's exact behavior.

## Edge cases & failure modes

1. **Unmatched `{{`.** No closing `}}` found before end of text: everything from
   that `{{` to EOF becomes one literal TEXT node. Required behavior: no throw, no
   truncation of preceding text.
2. **Malformed block-if (space/hash form), no `{{/if}}`.** The `{{if ...}}` /
   `{{#if ...}}` head tag becomes literal TEXT; parsing resumes just past it. The
   would-be body text is NOT consumed as part of the malformed block — it parses
   normally as whatever it independently is.
3. **Malformed block-if (colon form), no `{{/if}}`.** Falls through to the inline
   `if` macro classification instead of becoming literal text (differs from case
   2) — `{{if::cond}}` with no closer is treated as a one-arg inline `if` macro
   call.
4. **Nested same-type blocks (`{{if}}` inside `{{if}}`, `{{setvar}}` inside
   `{{setvar}}`, `{{trim}}` inside `{{trim}}`).** Depth-tracked; the matching
   terminator is the one that returns block-depth to 0, not the first textual
   occurrence of the closing tag.
5. **`{{setvar::x::5}}` (two args) nested inside a `{{setvar::y}}...{{/setvar}}`
   block body.** Must NOT desync the block-terminator scan — `findBlockTerminator`'s
   `opensBlock` check specifically distinguishes single-arg (block-opening) from
   multi-arg (inline, non-block) `setvar`/`setglobalvar` occurrences.
6. **Negative depth in `lexSplitArgs`.** A stray unmatched `}}` inside a tag's
   content drives the depth-0 `::`-split counter negative; the counter is never
   floored, so a later `::` cannot be treated as depth-0 again until enough `{{`
   restore balance. Preserve this exactly; "fixing" it changes existing template
   behavior.
7. **`{{{char}}}` / `{{{{char}}}}` brace-folding.** Triple/quadruple braces are
   valid input (users double-escape by habit); the pair-scan semantics documented
   above determine what folds into tag content vs stays literal. Must match
   `lexMatchingClose` exactly, not a naive brace-counting approximation.
8. **Escaped braces containing macro-like text.** `\{\{char\}\}` must survive
   parsing as sentinel-hidden literal text and restore to literal `{{char}}` in
   output, never expanding as a macro.
9. **Sentinel character collision.** Raw `\x01`/`\x02`/`\x03`/`\x04` bytes present
   in user input before processing must not be corrupted by the pipeline's own
   sentinel-based stages (escaped-brace hiding, trim marker). The characterization
   corpus tests this directly.
10. **Unknown macro name.** Resolves to literal reconstructed tag text in the
    output (evaluated args, `::`-joined) plus one `state.errors` entry with a
    Levenshtein-ish "did you mean" suggestion when a close registered name exists
    (`findSimilarMacro`, edit distance <= 2 against a small hardcoded common-macro
    list). Does not abort the rest of the template's evaluation.
11. **Handler throws.** Caught at the `expandSingleMacro` call site; treated
    identically to a handler returning `success: false` with the thrown error's
    message (or a generic fallback string) as `error`.
12. **`MAX_EVAL_DEPTH` (100) exceeded.** `evaluateNodes` returns `''` for the
    remaining subtree rather than recursing further or throwing. Applies to
    nested-expansion recursion (a macro's output containing more macros) and to
    deeply nested block bodies alike, since both go through the same depth
    parameter.
13. **Volatile macro anywhere in the template.** `MacroProcessResult.cacheable`
    becomes `false` for the WHOLE result, even if the volatile macro is inside an
    untaken (short-circuited) if-branch that never executed — `volatileHit` is
    ratcheted per node actually evaluated, so an untaken branch's volatility never
    matters (it doesn't run), but a taken one poisons the whole run.
14. **Side effects inside an untaken if-branch.** Never fire — block-if
    short-circuits, the untaken branch's AST subtree is never evaluated at all
    (not evaluated-then-discarded).
15. **`context.readOnly: true`.** All side-effect macros (block-setvar and any
    handler-level `setLocalVar`/`setGlobalVar`/delete effects) become no-ops;
    read macros (`getvar`, `hasvar`, etc.) are unaffected and still read current
    state. Required for replaying historical chat messages without re-firing old
    variable writes.
16. **A macro's expansion itself contains `{{...}}`.** Re-parsed and evaluated
    recursively (one more depth level), so a variable holding literal macro text
    (`{{setvar::greeting::{{char}} says hi}}` then `{{getvar::greeting}}`)
    expands fully rather than emitting the unexpanded `{{char}}` text.
17. **Lazy macro args are not auto-trimmed.** Unlike eager macro args (always
    `.trim()`-ed before the handler sees them), lazy handler args expose raw
    untrimmed source text via `.raw` and an untrimmed `.evaluate()`. A port that
    trims lazy args by default will diverge from macros like `{{sep}}`/`{{raw}}`
    that are whitespace-sensitive by design.
18. **Comment body containing `::`.** Must NOT be split into multiple args — the
    entire trimmed remainder after `//` is one string argument, unlike every other
    macro form.
19. **Bare `.var`/`$var` inside a block-if condition string.** The dot-notation
    preprocessor only rewrites STANDALONE `{{.var ...}}` macro tags; a `.var`
    appearing inside a condition string like `{{if .var <= 25}}` reaches the
    condition evaluator unresolved and needs `resolveConditionShorthands` to
    substitute it before comparison, or it string-compares the literal text `.var`
    instead of the variable's value.
20. **`character:` scope namespace fallback.** If neither `context.characterId`
    nor `context.characterName` is set, the character-scope storage key falls back
    to a literal `"unknown"` namespace segment — multiple characters with no id/name
    set would collide into the same storage key. Acceptable per the reference
    behavior; not treated as a bug to fix in the port.
21. **`vaud inspect`/`vaud convert` never evaluate macros.** A codec that calls
    into the evaluator during parse or serialize violates the Round-Trip Law (macro
    text is opaque payload, escrowed/passed through like any other string field).
    This is a hard boundary, not a performance optimization.

## Test plan

Round-Trip Law applicability: **N/A.** The macro engine is not a codec (it doesn't
parse-then-serialize a file format); the escrow/round-trip guarantee does not apply.
Its equivalence guarantee is the ported characterization corpus below, which plays
the same "nothing changes silently" role for this component that the Round-Trip Law
plays for codecs.

- **Fixture: ported `corpus.ts`.** Every entry, unmodified, becomes the input
  corpus for the studio's own parser + processor golden tests. ~16 categories,
  covering text/inline/escaped/angle/dotdollar/spaceform/singlecolon/blockif/
  trim/setvar/orphan/comment/unknown/unterminated/whitespace/lazyvolatile/template.
- **Golden snapshot: parser AST.** Regenerate `parser-ast`-equivalent snapshots
  from the ported `parseMacroNodes`; diff against VAUDEVILLE's committed
  `__snapshots__/parser-ast.test.ts.snap` line-for-line where the AST shape is
  1:1 portable (node type names may differ cosmetically; structural shape and node
  count/nesting must match).
- **Golden snapshot: full pipeline.** Regenerate `processor-golden`-equivalent
  snapshots from the ported `processMacros`, against a fixture `MacroContext`
  reconstructed from VAUDEVILLE's `processor-golden.test.ts` setup (OPEN QUESTION:
  exact fixture values, see porting plan step 3 above).
- **Property/unit tests beyond the corpus:**
  - `lexMatchingClose`/`lexSplitArgs` (or the studio's renamed equivalents) tested
    directly against the brace-folding and negative-depth cases (edge cases 6-7)
    as standalone unit tests, independent of the full pipeline.
  - `MAX_EVAL_DEPTH` circuit breaker: a synthetic self-referential variable chain
    (`{{setvar::a::{{getvar::a}}}}` style constructions, or deeply nested
    same-type blocks) that would recurse past 100 without the guard; assert it
    returns `''` for the runaway subtree rather than hanging or throwing.
  - `cacheable`/`touchedVariables` fingerprinting: assert a template with only
    `{{getvar::x}}` reports `touchedVariables: ['local:x']` and `cacheable: true`;
    a template additionally containing `{{roll::1d6}}` reports `cacheable: false`;
    a template containing `{{setvar::y::1}}` reports `cacheable: false` via
    nonempty `sideEffects`.
  - `readOnly` context: a template with `{{setvar::x::1}}{{getvar::x}}` under
    `readOnly: true` and a pre-seeded `localVariables` map with `x` already set
    to some other value must output the PRE-EXISTING value (the setvar no-ops,
    the getvar reads unchanged state), not `1`.
  - Scope resolution table (scopes.ts): one test per row of the scopes table above,
    including the `character:` fallback-to-`"unknown"` case and an unrecognized
    `foo:bar` prefix staying literal.
  - Interceptor registration: a `pre` interceptor that rewrites text before
    preprocessing and a `post` interceptor that rewrites final output, both fire
    in the right phase and in registration order when multiple are registered;
    a throwing interceptor is caught and logged, not propagated.

## Non-goals

- Lorebook trigger matching / activation (specs/engine/lorebook-engine.md) —
  the engine only reads `triggeredEntries` as already-computed input, it does not
  compute activation itself.
- Prompt assembly ordering, budget/token accounting, position/depth injection
  (specs/engine/prompt-assembly.md) — the engine expands macro text wherever it's
  invoked; deciding what text to run it over and in what order is assembly's job.
- Evaluating macros during format conversion. Codecs never call this package.
- A per-macro behavior catalog (what every one of the ~100 individual macros does).
  That belongs in a separate reference doc once the handler modules are ported,
  not in this engine spec.
- Defining new macro syntax. This spec ports RC's existing dialect; new macro
  forms are a product decision for later, not scoped here.

## Sources consulted

- `<RoleCall>\apps\rc\src\lib\macros\tokenizer.ts`
  (full file, lines 1-453): header (1-42) documents the design intent; lexer
  (`lexMatchingClose` 76-92, `lexSplitArgs` 101-130); block-terminator scan
  (`findBlockTerminator` 153-192); block-if parse (`parseBlockIf` 202-275); main
  entry (`parseNodesV2` 285-443).
- `<RoleCall>\apps\rc\src\lib\macros\processor.ts`
  (lines 1-260, 260-560, 560-921): pipeline entry (`processMacros` 687-776);
  preprocessing (`preprocessDotNotation` 97-120, `normalizeSpaceSyntax` 126-138,
  single-colon rewrite 717-720); AST cache (`parseNodesCached` 186-201);
  parser delegation (`parseNodes` 220-222, confirms legacy parser deleted);
  evaluator (`evaluateNodes` 326-363, `evaluateMacroNode` 368-432,
  `evaluateLazyMacroNode` 441-500, `evaluateBlockIfNode` 505-521,
  `evaluateBlockSetvarNode` 526-554); recording variable proxy
  (`makeRecordingVarMap` 304-321); condition evaluation (`evaluateBlockCondition`
  638-656, `resolveConditionShorthands` 617-627); escaped-brace sentinels
  (245-256); trim sentinel + whitespace post-process (668-676); unknown-macro
  fallback (`expandSingleMacro`, `findSimilarMacro` 785-879); interceptors
  (262-294); test-only exports confirming `__parseForTest` bypasses cache (908).
- `<RoleCall>\apps\rc\src\lib\macros\registry.ts`
  (full file): registration/idempotency rules (33-76); volatile macro set
  (93-106); lookup order (`getMacro` 117-134).
- `<RoleCall>\apps\rc\src\lib\macros\types.ts`
  (lines 1-260, 260-360): `MacroContext` full shape (10-133, including the
  RC/DB-coupled fields explicitly excluded from the studio port); `MacroCategory`
  (309-319); `MacroProcessResult` (324-354); `LazyMacroArg`/`LazyMacroHandler`
  (236-253); `MacroDefinition` (258-288).
- `<RoleCall>\apps\rc\src\lib\macros\scopes.ts`
  (full file): scope prefix table (20-27), resolution logic (50-78).
- `<RoleCall>\apps\rc\src\lib\macros\handlers\identity.ts`
  (lines 1-60): example handler shape (`char`/`user`/`persona` macros) confirming
  `MacroHandler` signature in practice.
- `<RoleCall>\apps\rc\src\lib\macros\handlers\lumiverse-compat.ts`
  (lines 1-50): `{{rcounter}}` as an example `volatile: true`, `readOnly`-respecting
  side-effect macro; header note on unknown-macro-as-truthy-passthrough being
  intentional for Lumiverse platform tokens.
- `<RoleCall>\apps\rc\src\lib\macros\index.ts`
  (lines 1-80): confirms the public export surface shape (types, registry,
  processor, handler registration functions) as precedent for this spec's API
  sketch.
- `<RoleCall>\apps\rc\src\lib\macros\__characterization__\corpus.ts`
  (lines 1-80 read; full category list at lines 33-50): corpus structure,
  category enumeration, sentinel-collision test intent (52-58).
- `<RoleCall>\apps\rc\src\lib\macros\__characterization__\`
  directory listing: confirms the five test files
  (`parser-ast.test.ts`, `duplicate-parsers-agreement.test.ts`,
  `preprocessing-effects.test.ts`, `processor-golden.test.ts`) plus
  `__snapshots__/` exist as described in the extraction map.
- `docs/00-MASTER-PLAN.md` (this repo): three-layer shape, "Engine" as the moat,
  extraction sourcing.
- `docs/02-ARCHITECTURE.md` (this repo, lines 18, 22): `packages/macros`
  description ("tokenizer/parser ... + evaluator subset"), dependency rule
  (`core <- formats <- everything`).
- `docs/05-EXTRACTION-MAP.md` (this repo, lines 48-55): `packages/macros` source
  file list, tokenizer.ts UNCOMMITTED-as-of-2026-07-02 warning, characterization
  corpus called out as "THE asset; port before the parser."
- `docs/06-PRODUCTION-BIBLE.md` (this repo, line 60): this spec's brief.
- `specs/formats/canonical-model.md` (this repo): "Identity/presentation metadata
  is grouped, not flat" design rule, used to justify excluding RC's
  palette/gradient context fields from the studio `MacroContext`.
- `specs/formats/escrow-and-roundtrip.md` (this repo): Round-Trip Law text, used to
  ground the "conversion never evaluates macros" boundary.
- `templates/SPEC-TEMPLATE.md` (this repo): section structure followed here.
