# Concept: the regex editor

The Workbench surface for authoring a regex set. Source: `src/ui/apps/workbench/regex/`
(one concept per file: `set-editor` chassis, `rule-toc`, `rule-page`, `phase-picker`, `fine-print`,
`rule-rail`, `mode-guided`, `mode-words`, `example-mode`, `bench-pane`, `bench-import`, pure session
ops in `session.ts`). Built by transcription from the LOCKED wireframes `vs-regex-editor.html` (private design files),
`vs-regex-tryit.html`, `vs-regex-shelf-gallery.html` (all locked). Library shelf slice:
`src/ui/apps/library/views/regex-shelf.tsx` + `regex-shelf-ops.ts`.

Everything displayed about a pattern is **engine truth** from [regex-engine.md](regex-engine.md):
readings come from `explainAst`, example chips are execution-verified, health/slow chips from
`validate`, travel notes from `travelLint`. The editor never fabricates a claim about what a rule
matches.

## Three authoring modes, one rule

The mode switch is per-rule and lossless (the pattern is the single source; modes are VIEWS on it):

- **Guided** - baby's-first quiz cards in the binder grammar (stage panel, black border/shadow):
  three steps, an "it will catch" card assembled from the template + verified examples + one
  computed miss derived from the user's own script, and the confession line ("It only knows words
  you showed it"). The raw pattern is never rendered here; an escape link hands off to Pattern mode.
- **Plain words** - RC's example-driven builder, transcribed: match-these-words (family analysis,
  optimized stems, tune grid) and match-by-example with the syntax-colored `/ ... / i` readout,
  Mode/Examples/Uses lines, token chips, and inline try-it.
- **Pattern** - raw find/flags/replace with the live plain-words reading under the box (honest
  partial note when the pattern is beyond the builder's grammar).

## Platform honesty in the frame

The header's Write-for tab strip re-lenses the whole editor per profile: "Where it runs" pills come
from `phasesForProfile` (phases the wire cannot carry disappear; a foreign phase already set shows
dashed amber), the fine-print fold shows only fields that platform owns (`platformOwnsField`), and
travel-lint notes render dashed-amber inline. Per-platform truth is read from the capability
matrices, never hardcoded in the UI.

## The full check (health)

`health-pane.tsx` + `core/regex/inspect.ts`: six linter checks over the whole set, problems first.
The headline is the shadowing detector - it generates execution-verified examples for each rule's
own pattern and runs the REAL chain over them; a rule is flagged only when it provably never fires
while an earlier rule did (indeterminate runs stay silent). Duplicates carry a one-click safe fix
(switch the copy off - applied to the session, saved only on Save); reordering advice is always
"fix by hand". The per-rule Health card in the rail shows that rule's slice; heavy patterns wear a
quiet "slow" chip on the TOC rows and an "N slow" count on the Library shelf card.

## The recipe gallery

`gallery-pane.tsx` + `core/regex/templates.ts` / `template-catalog.ts`: "+ New rule" opens the
starter recipes (37, grouped Cleanup / Guardrails / Formatting / Style / Compatibility / Roleplay),
each a plain-English pitch with a Before/After pair the ENGINE computed - the catalog test re-runs
every example, so a recipe that cannot prove itself does not ship. Picking one appends a pre-filled
rule and focuses it (Plain-words when the pattern fits the words grammar, Pattern with the reading
otherwise); Start blank keeps the empty-rule path.

## The test bench

`bench-pane.tsx`, hosted BESIDE the editor (never a modal): a sample line runs through the real
`applyRules` chain on every keystroke, one step card per rule showing before/after word diff,
engine-span capture chips, overlay chips, or the plain-language skip reason; a final "what comes
out" card. Its second tab is the import preview: drop a file in any of the five dialects, see
per-rule before/after against the current sample, and stage-pick rules into the open set. On a
narrow pane the bench becomes a full-screen takeover.

## Fluid grammar

The editor collapses by ITS PANE's width (container queries, blocks at file end), not the viewport:
below 34rem the TOC becomes a Contents bottom sheet with a pager bar, the Write-for strip folds into
the head kebab, and the bench takes over full-screen. Bench-open has its own 44rem stack point
(two columns need less room than three).
