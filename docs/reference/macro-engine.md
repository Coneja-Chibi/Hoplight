# The macro engine

The closed-world macro interpreter under `src/core/macros/`, permitted by
[ADR-012](../decisions/ADR-012-macro-evaluation-boundary.md) and shaped by
`specs/engine/macro-engine.md`. It parses `{{macro::arg}}`-style templates into an AST and
evaluates them against a value-only context, producing expanded text **plus segments that remember
which authored characters produced them**. Codecs and adapters never call it; macro text stays
opaque payload at every import and conversion boundary.

## What is implemented

The parser is a span-carrying port of the reference clean-room parser (VAUDEVILLE
`tokenizer.ts`): the same classification cascade (block-if in space/hash and colon forms,
block-trim, block-setvar, orphan terminators, comments, inline macros), the same degradation rules
(unmatched `{{` becomes text, a malformed space-form `{{if}}` head becomes literal text, a
closerless colon-form falls through to the inline `if`), and the same deliberate quirks (the
never-floored negative depth in `::` splitting, triple-brace folding). Each node additionally
carries `start`/`end` offsets.

Normalization (`normalize.ts`) rewrites the shorthand dialects - escaped braces, `<user>`/`<char>`
angle tokens, `{{.var}}`/`{{$var}}` dot/dollar notation, space forms, single-colon forms - into
canonical syntax **through an offset map**, so every parsed node can be traced to the authored
range it came from (`toSource`). A rewritten tag maps to its whole authored tag, which is the
finest truth available.

The evaluator (`evaluate.ts`) enforces the ADR's bounds during evaluation: depth 100, an output
ceiling, a step budget. Randomness is mulberry32 over `context.randomSeed`; there is no ambient
clock or `Math.random` anywhere in the package, and the registry test proves every handler is
data-only. `readOnly` turns writes into no-ops. Unknown names degrade to reconstructed literal
tags plus an error entry - never silence, never a throw.

The handler set covers the spec's **bucket 1** - identity (`char`, `user`, `description`,
`personality`, `scenario`, `model`), the variable family in all scopes (`session:`, `char:`,
`arc:`, `scene:`, `global:`), inline conditionals (`if`, `compare`) and block-if with condition
shorthands, text transforms (`upper`, `lower`, `trim`), comments, and the seeded volatile family
(`random`, `pick`, `roll`/`dice`, `coinflip`) - plus two context-fed families. TIME macros
(`time`, `date`, `weekday`, `isodate`, `isotime`) read `context.now`, a plain epoch value the
CALLER supplies (the UI reads `Date.now()` at the reroll boundary, a test pins it); with no
clock on the context they resolve to `""` rather than inventing a moment, keeping ADR-012's
no-ambient-clock rule intact. CHAT macros (`lastmessage`, `lastusermessage`, `lastcharmessage`,
`messagecount`, `input`, `chatid`) are bucket 2: they read `context.messages`/`currentMessage`,
which the preview fills with a stub conversation fixture (whose `{{user}}`/`{{char}}` re-expand
against the preview identity) and which resolve to empty defaults when absent - never an error.
Lazy handlers, interceptors, and `template`/`override` are not yet ported; the
characterization-corpus port is outstanding.

## Segments: the editable-preview contract

`processMacros(source, context)` returns, alongside the flat text, one segment per top-level
node. A literal segment's `value` **is** the authored slice `source[sourceStart, sourceEnd)`,
verbatim - escaped braces unrestored, newline runs uncollapsed - so splicing an edited value into
that range can never corrupt the source; the restored, whitespace-collapsed rendering lives in
the flat `text`, which is postprocessed once as a whole (segments are provenance, not a
partition of it). A macro segment carries its raw authored expression, its resolved value, and -
for `random`/`pick` and block-if - which option or branch fired, so a preview can offer
branch-level edits instead of guessing at a flat string. `src/core/preset/live-render.ts` layers
this over `buildPreview`'s engine-truth ordering, threading one variable context across blocks in
build order and tagging every segment with its block id.

## Who may call it

Exactly the ADR-012 list: the macro test bench (user-invoked), the transfer compatibility report,
and prompt assembly / preview surfaces such as `live-render.ts`. The external-engine renderer
under `src/core/preset/render/` remains the cross-check oracle: it answers "what does the real
platform say", this engine answers "what does this say, and where did each character come from".
