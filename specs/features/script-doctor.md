# Spec: The Script Doctor

**Package:** `packages/doctor` · **Milestone:** M3 (v0.2) · **Status:** draft
**Depends on:** `specs/formats/canonical-model.md`, `specs/formats/escrow-and-roundtrip.md`,
`specs/engine/token-counting.md`, `specs/engine/macro-engine.md` (macro lint pass, read-only),
`specs/engine/lorebook-engine.md` (dead-config detection, cited as edge case 3 there),
`specs/engine/key-vault.md` (BYOK key presence gates the AI Treatment tier) ·
**VAUDEVILLE reference:** none authoritative (new feature; no VAUDEVILLE code audits
cards for health/slop today). `apps/rc/src/lib/post-gen-actions/slopism-sets.ts` and
`apps/rc/anti-slop-banks/**/*.md` are cited below as **informative precedent only**
for the slop-bank file-shape design (that system screens live chat *generations*,
not authored card fields - this spec adapts the shape, does not port the code).

## Purpose

The Script Doctor audits a Character, Lorebook, or Preset for the problems that make
AI-roleplay content play badly: wasted tokens, internal contradictions, cliche/"slop"
prose, dialogue and action written as if the user already said or did it, and legacy
format relics left over from a card's editing history. It runs two tiers. The
**deterministic tier** is free, fully offline, requires no AI key, and produces the
same findings on the same input every time (docs/01-VISION.md pillar 3: "Deterministic
checks... run free and offline"). The **AI treatment tier** is optional, requires a configured BYOK provider
(`specs/engine/key-vault.md`), and turns findings that need judgment or rewriting
(slop-bank hits need actual prose replaced; contradiction *candidates* need a human-
or-model decision about which value is true) into a staged, fix-by-fix approval flow
that never mutates the source file without explicit approval. This spec defines both
tiers, the stable health-score formula, the slop-bank file format, and the batch
"ward round" report. It exists so the studio can honestly claim "the Doctor is
honest" (docs/01-VISION.md pillar 3) rather than hand-waving "AI cleans up your card."

## Behavior

### Scope of what gets examined

The Doctor operates on one canonical `Entity<Character>`, `Entity<Lorebook>`, or
`Entity<Preset>` at a time (see `specs/formats/canonical-model.md`, "Shared
envelope"). A Character examination additionally walks its referenced Lorebook (if
any, per canonical-model.md rule 3: "An embedded lorebook is a REFERENCE... not an
inline blob") and any Persona referenced by the current session, because
contradiction and speaks-for-user checks need `{{user}}`/`{{char}}` context that
spans more than the character fields alone. Preset examination is narrower (token
waste and macro lint only - a preset has no "personality," so slop/contradiction
passes are skipped; see Non-goals).

Fields examined, per entity, listed with their canonical path (`specs/formats/canonical-model.md`
"Design rules" 1): `description`, `personality`, `scenario`, `firstMessage`,
`exampleDialogue`, `systemPrompt`, `postHistoryInstructions`, `alternateGreetings[]`,
`depthInjections[]`, plus every `LorebookEntry.content`/`.title` in a referenced book.
Non-prose fields (`identity`/`presentation` metadata, `tags`, `creator`) are read for
context (e.g. a tag can gate which slop banks are relevant) but are never themselves
targets of a finding.

### Deterministic passes

Each pass is a pure function `(examinable: ExaminableEntity, config: DoctorConfig) =>
Finding[]`. Passes run independently and in parallel (no pass depends on another
pass's output); a `Finding`'s `id` is stable and content-addressed (hash of
`passId + fieldPath + span`) so re-running the Doctor on an unchanged file produces
byte-identical finding IDs - this is what makes the health score reproducible and
what lets `vaud doctor --json` be diffed across runs in CI.

1. **Format errors** (`passId: "format"`). Not a new check - surfaces the codec's
   own `ParseReport` (`specs/formats/escrow-and-roundtrip.md`, "Reports") as
   findings: nonempty `dropped` -> `severity: high`; nonempty `warnings` -> `severity:
   medium`; a zod validation failure on the canonical shape itself -> `severity:
   critical` (the file is malformed, every other pass still runs against whatever
   parsed, but the report leads with this). This pass has no bank/heuristic of its
   own; it re-packages data the codec layer already computed, per canonical-model.md's
   "Shared envelope" and the escrow spec's "Reports" section.

2. **Token waste heuristics** (`passId: "token-waste"`). Uses
   `specs/engine/token-counting.md`'s `TokenCounter` (`approximate` strategy, since
   the Doctor's deterministic tier must work with zero AI key, mirroring
   token-counting.md's "works with zero AI key" constraint). Sub-checks, each
   producing its own findings with the token count reclaimable if fixed:
   - **Redundant whitespace/formatting.** Runs of 3+ blank lines, trailing
     whitespace, non-breaking-space/zero-width-character pollution (a token cost with
     zero prose value).
   - **Cross-field duplication.** A sentence (Jaccard similarity >= 0.8 over
     normalized token n-grams, `n=8`) appearing in two of `description`/
     `personality`/`scenario`. Flags the second occurrence as reclaimable.
   - **Filler-phrase density.** Hits against the `wordbank`-kind slop banks (see
     "Slop banks," below) that are specifically tagged `family: "filler"` - e.g.
     stock hedges ("in a way", "sort of", "you could say") that cost tokens without
     adding information. This sub-check is bank-driven, not a separate hardcoded
     list, so it shares the same bank file format as the slop pass.
   - **Run-on sentence density.** Sentences (split on `.!?` outside quotes/macros)
     exceeding 60 words with no coordinating structure (crude heuristic: word count
     threshold + comma count > 4 in one sentence) are flagged `severity: low` with a
     "consider splitting" note - this sub-check never *proposes* a split (that
     requires prose judgment, deferred to AI treatment); it only flags.
   - **Unresolved macro tokens outside a macro-consuming context.** A literal
     `{{...}}` string inside a field the engine never macro-expands at parse time
     (this never fires false-positive on legitimate macros - see "Depends on:
     macro-engine.md" - this sub-check only flags macros with unknown names per the
     macro engine's registry, i.e. genuine typos like `{{personaltiy}}`).

3. **Contradiction candidates** (`passId: "contradiction"`). Deterministic tier finds
   *candidates only* - pattern-extracted structured values that disagree - and never
   claims to resolve which value is correct (that judgment call is AI-treatment-tier
   or human-only). Extractors:
   - **Stated age.** Regex `\b(\d{1,3})\s*(?:years?[\s-]old|y\/?o\b)|(?:age[d]?[:\s]+)(\d{1,3})\b`
     (case-insensitive) run over every examined field; every match is an `AgeClaim {
     value, fieldPath, span }`. Two or more distinct `value`s across the entity ->
     one `contradiction` finding per distinct pair, `severity: high`.
   - **Stated name.** Compares `identity.name` (canonical field, native across all
     codecs) against capitalized-noun-phrase mentions in `firstMessage` that are
     immediately followed by an appositive pattern (`, the`, `, a`, `is called`) -
     narrow on purpose to avoid false positives from ordinary prose naming other
     characters. Divergence -> `severity: medium`.
   - **Pronoun/gender consistency.** Tallies third-person pronoun usage
     (he/him/his vs. she/her/hers vs. they/them/their) referring to `{{char}}` across
     `description`+`personality`+`firstMessage`+`exampleDialogue` (macro-token-scoped:
     only sentences containing `{{char}}` or the character's stated name are tallied).
     A field whose dominant pronoun set disagrees with the entity's majority set
     (>= 70% threshold) is flagged `severity: medium`. This is a statistical
     heuristic, not a claim about the character's actual gender identity - a card
     that intentionally mixes pronouns (nonbinary character, in-fiction reason) will
     false-positive; see Edge case 6.
   - **Numeric self-contradiction elsewhere** (height, date/year, count of siblings,
     etc.) is explicitly OUT of scope for the deterministic tier - free-text numeric
     extraction beyond age is high false-positive risk without a language model. AI
     treatment's context pass covers this instead (see "AI treatment planner").

4. **Slop banks** (`passId: "slop"`). Scans every examined field's raw text against
   every *active* `SlopBank` (see "Slop bank file format," below) using the bank's
   compiled matcher (case-insensitive substring for `wordbank`/`phrase` entries,
   compiled regex for `pattern` entries - same trigger-matching primitives as
   `specs/engine/lorebook-engine.md`'s plain-keyword/regex trigger matching, reused
   for consistency rather than reinvented). Each hit is one `Finding` with
   `passId: "slop"`, `bankId`, `matchedText`, `span`, `severity` derived from the
   bank's declared `severity` (see file format). A bank whose `scope` is
   `"turn-history"` (VAUDEVILLE precedent: needs prior conversation turns) never
   fires in the Doctor - a card has no turn history - and is skipped at load time
   with a `warnings` entry, not silently ignored (mirrors the caller obligation
   VAUDEVILLE documents at `slopism-sets.ts:38-44` for `scope: 'turn-history'` banks
   under `contextMessages <= 1`).

5. **Speaks-for-user detection** (`passId: "speaks-for-user"`). Scans
   `firstMessage`, `alternateGreetings[]`, and `exampleDialogue` for sentences whose
   grammatical subject is the `{{user}}` macro token (or its legacy alias
   `<user>`/`{{User}}` normalized identically) followed by an action or speech verb -
   i.e. the card is putting words or deeds in the user's mouth before the user has
   said anything, a well-known roleplay-card antipattern. Heuristic (regex over
   macro-normalized text, not a full parser):
   `\{\{user\}\}\s+(?:says?|asks?|replies?|answers?|shouts?|whispers?|nods?|smiles?|walks?|sits?|grabs?|takes?|feels?|thinks?)\b`
   and quoted dialogue immediately preceded by `{{user}}` (`\{\{user\}\}[:\s]*["“]`).
   Every match -> `severity: high` finding (this is one of the most commonly cited
   "broken card" complaints per docs/01-VISION.md's first-timer persona: "found a
   broken card... wants to fix it"). Distinguishes from the *character* describing
   what the user typically does in `scenario` (a legitimate authorial choice) by
   only scanning greeting/example-dialogue fields, which are meant to model a single
   exchange, not general scenario-setting prose.

6. **W++ relics** (`passId: "wpp-relic"`). W++ is a pre-JSON-era character-format
   convention: `[Character("Name"){ Attribute("value1" + "value2") Attribute2(...) }]`
   (confirmed via community documentation, "W++ For Dummies," rentry.co/WPP_For_Dummies,
   accessed 2026-07 - see Sources consulted). Detection regex:
   `\[\s*[A-Za-z][\w\s]*\(\s*"[^"]*"\s*\)\s*\{` for the opening bracket, plus
   `[A-Za-z][\w]*\(\s*"[^"]*"(?:\s*\+\s*"[^"]*")*\s*\)` for inner attribute clauses.
   A card written entirely in W++ style (multiple attribute clauses, opening bracket
   present) is common in cards imported from pre-2023 communities and pasted into a
   modern `description` field verbatim; the finding's `severity` scales with match
   density: 1-2 stray clauses -> `low` (probably intentional stylization or an
   in-fiction quote), 3+ clauses plus the outer bracket -> `high` (the whole field is
   likely an unconverted W++ block that reads as a token-wasteful attribute dump
   rather than prose). This pass never auto-converts W++ to prose (that's a rewrite,
   AI-treatment-tier); it only flags.

7. **Macro lint** (`passId: "macro-lint"`). Delegates to `packages/macros`'s
   non-evaluating lint entry point (`specs/engine/macro-engine.md`, "the Script
   Doctor's macro lint pass," explicitly named there as a consumer). Runs the
   tokenizer/parser stage only (never the evaluate stage - this pass makes zero
   claims about runtime macro *behavior*, only syntax): orphan terminators (a
   `{{/if}}` with no matching `{{#if}}`), unknown macro names against the registry,
   and unbalanced `{{`/`}}` nesting. Findings carry `severity: medium` (orphan/
   unbalanced -> broken output at assembly time) or `severity: low` (unknown name ->
   likely a typo, degrades to literal text at assembly time per macro-engine.md's
   documented pass-through-unknown behavior - OPEN QUESTION below confirms that
   fallback is what macro-engine.md actually specifies before this pass ships).

8. **Lorebook dead-config** (`passId: "lorebook-dead-config"`, Character/Lorebook
   examinations only). Reuses `specs/engine/lorebook-engine.md` Edge case 3 verbatim:
   an entry with `delayUntilRecursion > 0` whose owning book (and the entry itself)
   both have recursion disabled can never fire - that spec explicitly names this
   pass as the intended consumer ("`vaud validate` / the Script Doctor should flag
   this combination as a warning"). `severity: medium`. Additional dead-config
   checks in the same family: an entry with `enabled: false` left in a shipped card
   (informational, `severity: low` - often intentional), an entry with empty
   `triggers` and `constant: false` and no active sticky window possible (per
   lorebook-engine.md Edge case 15, permanently unreachable except by semantic hit
   or a future manual toggle) -> `severity: medium`.

### Slop bank file format

A slop bank is one Markdown file with YAML frontmatter, one bank per file, loaded
from `fixtures/slop-banks/**/*.md` (starter banks, ship with the product) and
`~/.vaud/slop-banks/**/*.md` (user-authored, additive). This shape is adapted from
VAUDEVILLE's `SlopismBank`/MD-frontmatter convention
(`apps/rc/src/lib/post-gen-actions/slopism-sets.ts:47-74`,
`apps/rc/anti-slop-banks/genre/academia.md:1-44`) with one deliberate change: this
spec's `severity` field does not exist in the VAUDEVILLE source (that system doesn't
score cards, it screens live generations) and is a new field this spec introduces.

```yaml
---
id: "academia-purple-prose"        # kebab-case, stable, referenced by Finding.bankId
label: "Dark Academia Purple Prose"
kind: phrase | structure | technique | lexical | wordbank | pattern
scope: always | scene | response | turn-history   # ported meaning, see below
severity: low | medium | high      # NEW field (not in VAUDEVILLE source): default
                                    # weight fed into the health-score formula, below
family: "genre-academia"           # optional grouping, surfaced in the bank picker
replace: "One sentence of rewrite guidance the AI treatment tier reads verbatim."
why: "Optional one-paragraph human-facing rationale. Falls back to `pattern` if absent."
---

## Banned vocabulary          <!-- required for kind: wordbank, phrase -->
- "marble" / "obsidian" / "ivory"
- "the scent of old books"

## Pattern description        <!-- required for kind: pattern; a regex, compiled at load -->
`\b(shivers?|chills?)\s+(?:ran|runs|crawled?)\s+down\s+(?:her|his|their)\s+spine\b`
```

Field-map table (source shape -> this spec's `SlopBank` type -> notes):

| Source field (VAUDEVILLE `SlopismBank`) | This spec's `SlopBank` field | Notes |
|---|---|---|
| `label` | `label` | unchanged |
| `kind` | `kind` | unchanged, same six values |
| `pattern` (recognition prose) | `pattern` | for `kind: pattern` banks, holds the compiled-regex source; for prose-kind banks, unchanged recognition text |
| `examples` | body `## Banned vocabulary` list | moved from a frontmatter array to a Markdown list in the body, matching the `anti-slop-banks/**/*.md` files' actual on-disk shape (frontmatter carries metadata, the body carries the list) rather than the in-repo TS `SlopismBank` interface's flattened array - this spec follows the file convention, not the generated-TS convention, since `packages/doctor` loads `.md` files directly (no codegen step; see Non-goals) |
| `replace` | `replace` | unchanged |
| `why` | `why` | unchanged, optional |
| `scope` | `scope` | unchanged four values; `turn-history` banks load but never fire (see pass 4) |
| `conflictsWith` | `conflictsWith` | unchanged, optional array of bank IDs |
| `family` | `family` | unchanged, optional |
| `extends` | `extends` | unchanged, optional |
| (none - new) | `severity` | new field this spec introduces; VAUDEVILLE's system has no scoring concept |
| (none - new) | `id` | VAUDEVILLE keys banks by their `Record<string, SlopismBank>` key in a generated TS file; this spec uses an explicit frontmatter `id` since banks are loaded from loose `.md` files with no codegen step |

### Health score formula

Documented and stable: given the same `Finding[]` list, the score is always the same
number. Starts at 100, subtracts a per-finding deduction based on `severity`, floors
at 0, never exceeds 100.

| Severity | Deduction per finding |
|---|---|
| `critical` | 25 |
| `high` | 8 |
| `medium` | 3 |
| `low` | 1 |

`score = max(0, 100 - sum(deduction(f.severity) for f in findings))`. Deductions are
NOT diminishing-returns/logarithmic - this is a deliberate simplicity choice so the
formula is auditable in one line and so "fixing N findings raises the score by a
predictable amount" holds exactly, matching docs/01-VISION.md's "proves what it did
in plain terms." `Token Waste` findings additionally report a separate
`tokensReclaimable` number (sum of each finding's estimated reclaimable token count)
displayed alongside the score, not folded into it (the wireframe's "Card Health 61 /
100" and "Token Waste 412 tok" are shown as two adjacent tiles, per
`wireframes/magic/script-doctor.html` SD-1, not combined into one figure).

Score bands for the ward-report triage (`wireframes/magic/script-doctor.html` SD-3
labels: "critical / stable / clean"):

| Band | Score range |
|---|---|
| `critical` | 0-49 |
| `stable` | 50-79 |
| `clean` | 80-100 |

OPEN QUESTION: the wireframe's mock numbers (health 61 = amber/"stable-adjacent" in
the single-card view, health 89 = "discharged clean" in the ward view) are
consistent with these bands but were not designed against an explicit formula by the
wireframe author - the specific deduction weights above are this spec's proposal,
not extracted from any prior source, and should be tuned against the fixture corpus
(see Test plan) before M3 locks them.

### AI treatment planner

Gated behind a configured provider (`specs/engine/key-vault.md`); with no key
configured, `vaud doctor` runs the deterministic tier only and prints
`AI treatment unavailable: no provider configured. Run 'vaud vault set' or pass
--ai-treat=false explicitly.` - never silently degrades without saying so, per the
same honesty requirement as token-counting.md's `exact`/`basis` fields.

The planner takes the full deterministic `Finding[]` list plus the entity's full text
as context and produces a `TreatmentPlan`: an ordered list of `Treatment` objects,
each targeting either exactly one `Finding` (a slop-bank hit's suggested rewrite, a
speaks-for-user rewrite, a contradiction candidate's proposed resolution with the
model's reasoning for which value it kept) or a field-wide `Treatment` with no single
source `Finding` (a token-diet rewrite of an entire field, which is what the
wireframe's SD-2 "Before & After" view represents - several findings addressed in
one full-field rewrite rather than N separate single-line fixes). Every `Treatment`
carries: the finding ID(s) it addresses (or `null` for field-wide), the field path,
a unified diff (`before`/`after` strings), and an estimated `tokensDelta`.

The planner does not call the model once per finding (that would be slow and
expensive on a card with a dozen findings) - it batches all findings for one field
into a single provider call per field, using the persona voice hook
(`specs/features/personas-system.md`, not yet written at time of this spec - cited
here as the intended hook point per docs/02-ARCHITECTURE.md's persona-loader
description) so the *tone* of `why`/`replace` guidance surfaced to the user matches
the user's chosen working-style persona (terse vs. detail-hound, etc.), while the
diff itself is persona-invariant (the same rewrite text regardless of which persona
is narrating it).

### Fix-by-fix staged approval

Every `Treatment` is applied through the same staged-edit envelope described
conceptually in docs/02-ARCHITECTURE.md ("Staged edits only... the agent never
mutates a user file directly: it stages a diff envelope, validation runs, the user
approves... then commit") and specified fully in `specs/engine/agent-loop.md` (not
yet written at time of this spec; cited here as the intended mechanism, not
duplicated). The Doctor-specific lifecycle, matching `wireframes/magic/script-doctor.html`
SD-1's "Fix 1 of 11... APPLY / SKIP / EDIT" flow:

1. `draft` - the `TreatmentPlan` is generated (deterministic pass results are
   immediate; AI-tier treatments require the provider round-trip described above).
2. `validate` - each `Treatment`'s `after` text is re-run through the same
   deterministic passes that flagged it (does the proposed fix actually clear the
   finding it targets, and does it not introduce a NEW finding of equal or higher
   severity?). A treatment that fails its own validation is marked
   `validationFailed` and is not offered for APPLY (only SKIP/EDIT) - the Doctor
   never proposes a fix it can't verify against its own rules.
3. Per-treatment human decision, presented one at a time in finding-severity order
   (highest first, matching the wireframe's "Fix 1 of 11" numbering) or, for SD-2's
   full-card mode, as one accept/reject for the whole field-wide rewrite:
   - `APPLY` - commit this treatment's diff into a staged working copy (not the
     source file yet).
   - `SKIP` - discard this treatment; the underlying `Finding` remains open in the
     final report.
   - `EDIT` - the human hand-edits the proposed `after` text before it is staged;
     the edited text is re-validated (step 2) before it can be applied.
4. `commit` - once the human ends the session (or hits `APPLY ALL SAFE`, which
   auto-applies only treatments whose target findings are `severity: low`/`medium`
   AND passed validation with zero new findings introduced - never auto-applies a
   `high`/`critical` treatment or one that introduced any new finding, regardless of
   severity), the staged working copy is serialized back through the entity's codec
   and written to disk as one new Production history snapshot
   (`specs/engine/productions-and-history.md`, content-addressed, so the pre-treatment
   version remains recoverable).

### Batch ward report

`vaud doctor <folder> --batch` runs the deterministic tier (only - AI treatment is
never auto-run in batch mode; see Non-goals) over every Character/Lorebook/Preset
file found, in parallel, and produces a `WardReport`: counts by band
(`admitted`=total, `critical`, `stable`, `clean` per the score bands table), then a
per-file line sorted sickest-first by default (`--sort=sickest-first`, the wireframe's
only shown sort; `--sort=name`/`--sort=cleanest-first` also supported), each line
showing `health`, `tokensReclaimable`, top 1-2 finding categories by count, matching
`wireframes/magic/script-doctor.html` SD-3's line shape exactly:
`twilight-prince.png   health 31 · 1.9k wasted tok · 22 slop · speaks for user`.

The report renders to the terminal (plain text, per docs/03-CONVENTIONS.md "Output
vocabulary is plain first") and exports as Markdown via `--report=ward-report.md`
(explicitly named "exports as markdown" in the wireframe's SD-3 footer line). The
Markdown export is a stable, diffable document: a summary table, then one `###`
heading per examined file with its findings as a bullet list, suitable for pasting
into a PR description or a Discord message. `--json` emits the same data as a
`WardReport` object for scripting.

## Public API sketch

```ts
// packages/doctor/src/index.ts

import type { Entity, Character, Lorebook, Preset } from '@vaud/core';
import type { TokenCounter } from '@vaud/core';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type PassId =
  | 'format'
  | 'token-waste'
  | 'contradiction'
  | 'slop'
  | 'speaks-for-user'
  | 'wpp-relic'
  | 'macro-lint'
  | 'lorebook-dead-config';

export interface Finding {
  /** content-addressed: hash(passId + fieldPath + span), stable across re-runs on unchanged input */
  id: string;
  passId: PassId;
  severity: Severity;
  fieldPath: string;              // canonical field path, e.g. "data.firstMessage"
  span?: { start: number; end: number };  // character offsets into the field's raw text, if applicable
  message: string;                // human-readable, plain-first (docs/03-CONVENTIONS.md)
  matchedText?: string;
  bankId?: string;                // set only for passId: "slop"
  tokensReclaimable?: number;     // set only for passId: "token-waste" sub-findings
  relatedFindingIds?: string[];   // e.g. the two AgeClaim locations for one contradiction finding
}

export interface DoctorReport {
  entityId: string;
  score: number;                  // 0-100, see "Health score formula"
  band: 'critical' | 'stable' | 'clean';
  findings: Finding[];
  tokensReclaimable: number;      // sum across all token-waste findings
  warnings: string[];             // e.g. a turn-history-scope bank skipped at load
}

export interface DoctorConfig {
  tokenCounter: TokenCounter;
  activeBankIds?: string[];       // undefined = all loaded banks active
  bankSearchPaths?: string[];     // additive to the default fixtures/user paths
}

export type ExaminableEntity =
  | Entity<Character>
  | (Entity<Lorebook>)
  | Entity<Preset>;

/** Runs every applicable deterministic pass for the entity's type and returns a report. */
export function examine(entity: ExaminableEntity, config: DoctorConfig): DoctorReport;

/** One deterministic pass, independently callable (used by tests and by `vaud doctor --pass=<id>`). */
export interface Pass {
  id: PassId;
  appliesTo: Array<'character' | 'lorebook' | 'preset'>;
  run(entity: ExaminableEntity, config: DoctorConfig): Finding[];
}

export const DETERMINISTIC_PASSES: Pass[];

// --- Slop banks ---

export type SlopismKind = 'phrase' | 'structure' | 'technique' | 'lexical' | 'wordbank' | 'pattern';
export type SlopismScope = 'always' | 'scene' | 'response' | 'turn-history';

export interface SlopBank {
  id: string;
  label: string;
  kind: SlopismKind;
  pattern: string;                // recognition prose, or regex source for kind: "pattern"
  entries: string[];               // parsed from the "## Banned vocabulary" body list
  replace: string;
  why?: string;
  scope: SlopismScope;
  severity: Severity;
  family?: string;
  conflictsWith?: string[];
  extends?: string;
}

export function loadSlopBanks(searchPaths: string[]): { banks: SlopBank[]; warnings: string[] };
export function parseSlopBankFile(markdown: string, filePath: string): SlopBank;

// --- AI treatment (requires a configured provider; see specs/engine/key-vault.md) ---

export interface Treatment {
  id: string;
  targetFindingIds: string[] | null;  // null = field-wide rewrite (SD-2 "Before & After")
  fieldPath: string;
  before: string;
  after: string;
  tokensDelta: number;
  rationale: string;                  // persona-voiced explanation, see "AI treatment planner"
  status: 'draft' | 'validated' | 'validationFailed' | 'applied' | 'skipped' | 'edited';
}

export interface TreatmentPlan {
  entityId: string;
  treatments: Treatment[];
}

export interface TreatmentPlannerOptions {
  tokenCounter: TokenCounter;
  personaId?: string;              // specs/features/personas-system.md hook, optional
}

/** Requires a configured provider adapter (specs/engine/key-vault.md); throws ProviderError
 *  (per docs/03-CONVENTIONS.md typed-error rule) if none configured, never silently no-ops. */
export function planTreatment(
  report: DoctorReport,
  entity: ExaminableEntity,
  options: TreatmentPlannerOptions
): Promise<TreatmentPlan>;

/** Re-runs the deterministic passes against a treatment's proposed `after` text to confirm the
 *  targeted finding(s) clear and no new finding of equal-or-higher severity is introduced. */
export function validateTreatment(
  treatment: Treatment,
  entity: ExaminableEntity,
  config: DoctorConfig
): { ok: boolean; newFindings: Finding[] };

/** Applies APPLY-decided treatments to a working copy and returns the entity with fields
 *  replaced; does not write to disk (caller commits via the Productions layer). */
export function applyTreatments(
  entity: ExaminableEntity,
  decisions: Array<{ treatmentId: string; decision: 'apply' | 'skip'; editedAfter?: string }>
): ExaminableEntity;

// --- Batch / ward round ---

export interface WardReportLine {
  filePath: string;
  score: number;
  band: 'critical' | 'stable' | 'clean';
  tokensReclaimable: number;
  topFindingCategories: Array<{ passId: PassId; count: number }>;
}

export interface WardReport {
  admitted: number;
  critical: number;
  stable: number;
  clean: number;
  lines: WardReportLine[];  // sorted per `sort` option
}

export function runWardRound(
  filePaths: string[],
  config: DoctorConfig,
  sort?: 'sickest-first' | 'cleanest-first' | 'name'
): Promise<WardReport>;

/** Renders a WardReport as the stable Markdown document described under "Batch ward report." */
export function renderWardReportMarkdown(report: WardReport, lines: Record<string, DoctorReport>): string;
```

## Edge cases & failure modes

1. **A card with zero findings.** `score: 100`, `band: 'clean'`, `findings: []`.
   `vaud doctor` still prints a success line ("discharged clean," matching the
   wireframe's `+ VESPER.png ... health 89 · discharged clean` phrasing pattern for
   the batch view) rather than no output - a clean result is itself information.
2. **A field is empty** (e.g. `alternateGreetings: []`, `systemPrompt: ""`). No
   findings generated for that field by any pass (nothing to scan); this is distinct
   from a "missing required field" check, which this spec does NOT define - required-
   ness is a codec/validation concern (`vaud validate`, out of this spec's scope, see
   Non-goals) not a Doctor health concern.
3. **Two slop banks with overlapping `entries` both hit the same span of text.**
   Both findings are kept (not deduplicated across banks) since they may carry
   different `replace` guidance the AI treatment tier needs independently; the health
   score deduction is NOT double-penalized past what the two findings' severities sum
   to, since deduction is a flat per-finding sum regardless of textual overlap. If
   this proves too punishing in practice (one bad phrase hit by 3 banks tanking the
   score), tune bank curation (avoid overlapping `entries` across banks in the same
   `family`) rather than changing the formula, since the formula's simplicity is a
   named requirement above.
4. **A `conflictsWith` pair of banks are both active and both fire on the same
   card** (e.g. one bank bans a phrase another bank's `replace` guidance recommends).
   Both findings surface normally; the AI treatment tier's per-field batched call
   receives both `replace` guidances and must reconcile the conflict in its rewrite
   (documented tension, not resolved deterministically) - the deterministic tier
   does not suppress either finding, it is not equipped to arbitrate.
5. **A malformed slop-bank Markdown file** (missing required frontmatter, a `kind:
   pattern` bank with no compilable regex in its body). `loadSlopBanks` skips the
   file, adds a `warnings` entry naming the file and the reason, and continues
   loading the rest - one bad user-authored bank file must never crash `vaud doctor`
   for every other file in the search path.
6. **Pronoun-consistency false positive on an intentionally mixed-pronoun
   character** (nonbinary character switching pronouns in-fiction, or a
   shapeshifter). The finding still fires (the heuristic has no semantic
   understanding of intent) at `severity: medium`; this is accepted as a known
   false-positive class, not silently suppressed, because suppressing it would also
   suppress genuine typo-driven pronoun drift. `--ignore-pass=contradiction` or
   per-finding SKIP in the treatment flow is the user's escape hatch.
7. **A `firstMessage` legitimately quotes W++ syntax in-fiction** (a character
   who IS an old-format AI reciting its own config as a bit). W++-relic detection
   still fires; density-based severity scaling (see pass 6) keeps a short quoted
   snippet at `low` rather than `high`, but does not eliminate the finding. Same
   escape hatch as edge case 6.
8. **`vaud doctor` run on a Preset.** Only `format`, `token-waste`, and
   `macro-lint` passes apply (`Pass.appliesTo` gates this); `contradiction`,
   `slop`, `speaks-for-user`, `wpp-relic`, and `lorebook-dead-config` are skipped
   entirely (a preset has no personality/greeting fields to examine) and do not
   appear in the report's `warnings` (this is expected scoping, not a load failure).
9. **AI treatment planner call fails or times out mid-plan** (provider adapter
   error - `specs/engine/key-vault.md`/provider-adapters territory). The deterministic
   `DoctorReport` that was already computed is unaffected and still returned/printed;
   only the `TreatmentPlan` step fails, surfaced as a typed `ProviderError` with
   `userMessage` (docs/03-CONVENTIONS.md error-class rule), never silently downgrading
   to an empty plan that looks like "no findings needed fixing."
10. **`APPLY ALL SAFE` when zero treatments qualify** (every open finding is
    `high`/`critical`, or every low/medium treatment failed validation). No-op with
    an explicit message ("0 treatments met the safe-apply bar (severity <= medium,
    validated, zero new findings introduced); step through fixes individually");
    never silently applies a higher-severity treatment to avoid returning "nothing
    to do."
11. **Batch ward round on a folder containing a file that fails to parse at all**
    (corrupt PNG, invalid JSON). That file gets a `WardReportLine` with `score: 0`,
    `band: 'critical'`, and its sole finding is the `format`-pass `severity: critical`
    parse failure (edge case 1 of this pass, described in pass 1 above) - it is
    still `admitted` to the ward, not silently excluded from the count.
12. **A `Treatment`'s `EDIT`-submitted human replacement text fails re-validation**
    (step 2 of the staged-approval lifecycle). The treatment stays in `edited` status
    with `validationFailed` surfaced to the user; APPLY is blocked for that specific
    treatment until either the edit is revised or the human explicitly force-applies
    via a separate `--force` flag that is logged in the report's `warnings` (never a
    silent override).

## Test plan

- Fixtures required, under `fixtures/script-doctor/`:
  - `clean-card.json` - zero findings across all passes, asserts `score: 100`.
  - `age-contradiction.json` - two distinct stated ages, asserts exactly one
    `contradiction` finding with both spans in `relatedFindingIds`-equivalent linkage.
  - `pronoun-drift.json` and `pronoun-intentional-mixed.json` - the heuristic firing
    correctly and firing on the accepted-false-positive case (edge case 6), asserting
    the finding still appears (regression guard against someone "fixing" the false
    positive by silently suppressing it, which would violate edge case 6's stated
    contract).
  - `wpp-relic-full-block.json` and `wpp-relic-single-quote.json` - density-based
    severity scaling (pass 6), `high` vs `low`.
  - `speaks-for-user-greeting.json` and `speaks-for-user-scenario-false-positive-guard.json`
    - confirms the pass fires on greeting/example-dialogue and does NOT fire on
    ordinary `scenario` prose describing typical user behavior.
  - `slop-bank-hit-single.json` and `slop-bank-hit-overlapping-banks.json` - basic
    hit plus edge case 3 (two banks, one span, both findings kept, score summed).
  - `macro-lint-orphan-terminator.json`, `macro-lint-unknown-macro.json` - delegates
    correctly to `packages/macros`'s lint entry point without invoking evaluation.
  - `lorebook-dead-config-delay-recursion.json` - the exact scenario from
    `specs/engine/lorebook-engine.md` Edge case 3, cross-checked byte-for-byte
    against that spec's described combination.
  - `token-waste-cross-field-duplication.json`, `token-waste-whitespace.json`,
    `token-waste-runon-sentence.json` - one fixture per sub-check.
  - `preset-scope-gating.json` - a `Preset` examination, asserts only the three
    applicable passes ran (edge case 8).
  - `malformed-slop-bank.md` (loader-side fixture, not entity-side) - asserts
    `loadSlopBanks` skips-and-warns rather than throwing (edge case 5).
  - `corrupt-file-in-ward-round/` (a folder fixture with one valid + one corrupt
    file) - asserts `runWardRound` still admits the corrupt file at `score: 0`
    (edge case 11).
- Round-Trip Law applicability: none directly (the Doctor never serializes on its
  own - `applyTreatments` returns an in-memory entity that the caller serializes
  through the entity's own codec, which IS subject to the Round-Trip Law, but that
  law is the codec spec's responsibility, not this one's). A property test SHOULD
  assert that `applyTreatments` followed by the entity's codec `serialize()` produces
  a file that still round-trips per the target codec's own Round-Trip Law fixtures -
  cross-referenced here, owned there.
- Property/unit tests beyond fixtures:
  - Health score formula: `score` is a pure function of `findings` (same input,
    same `Finding[]` regardless of call order) -> same score, every time, no
    randomness.
  - `Finding.id` stability: running `examine()` twice on byte-identical input
    produces byte-identical `Finding[]` (same IDs, same order).
  - `APPLY ALL SAFE` never selects a `high`/`critical` treatment or a
    `validationFailed` one, property-checked over randomly generated
    `TreatmentPlan`s with mixed severities/statuses.
  - `renderWardReportMarkdown` output is stable (same `WardReport` input -> byte-
    identical Markdown across two calls) - required for the "diffable document"
    claim under "Batch ward report."
  - `loadSlopBanks` on the full starter-bank corpus (once ported/adapted from
    VAUDEVILLE's `anti-slop-banks/`, see Non-goals on porting scope) never produces
    a `warnings` entry - the shipped banks must always parse cleanly.

## Non-goals

- Does not run any pass on chat-generated text (a model's actual roleplay output).
  The Doctor examines *authored* card/lorebook/preset content only. VAUDEVILLE's
  anti-slop system (which this spec's bank format borrows from) screens live
  generations during chat - that is explicitly out of scope; the Test Stage
  (`specs/features/test-stage.md`) is where generated text would eventually be
  evaluated, if ever, and that is a separate future decision, not part of M3.
- Does not port VAUDEVILLE's `apps/rc/anti-slop-banks/` corpus or its codegen
  script (`scripts/build-anti-slop-banks.mjs`) as code. A starter bank corpus for
  the studio ships under `fixtures/slop-banks/` written fresh in this spec's file
  format; content may be *informed* by the existing banks' phrase lists (public
  patterns like "shivers down her spine" are genre-agnostic prose slop, not
  proprietary to VAUDEVILLE) but the file format, loader, and matcher are
  independent implementations.
- Does not implement `vaud validate` (schema/required-field validation) - that is
  a codec-layer concern (escrow-and-roundtrip.md's `ParseReport`/`SerializeReport`,
  surfaced through `specs/features/cli-converter.md`) that the Doctor's `format`
  pass *reads from* but does not itself compute.
  - Does not resolve contradiction candidates automatically in the deterministic
  tier - resolution (deciding which of two conflicting values is correct) always
  requires either AI treatment judgment or a human decision.
- Does not auto-run AI treatment in batch/ward-round mode - batch mode is
  deterministic-tier only, by design (running an AI treatment pass unattended
  across dozens of files with no per-fix approval would violate the "fix-by-fix
  staged approval" principle this spec exists to uphold). A future `--batch-ai`
  mode that stages plans for every file without auto-applying anything is a
  plausible M3+ extension but is not specified here.
- Does not define the terminal/TUI or app-face rendering beyond the plain-text and
  Markdown shapes described above - actual pixel/layout design is the wireframe's
  and, later, the Studio's concern.
- Does not implement embeddings-based or fully semantic contradiction/slop
  detection. Every deterministic-tier pass in this spec is regex/heuristic-based by
  design (the "free, offline, no AI key" requirement rules out a model call in this
  tier); semantic depth is what the AI treatment tier adds.

## Sources consulted

- `docs\01-VISION.md` pillar 3 ("The
  Doctor is honest... Deterministic checks... run free and offline. AI treatment is
  optional, staged, and approved fix-by-fix. The tool proves what it did in plain
  terms.") - the section this spec is a direct implementation of.
- `docs\02-ARCHITECTURE.md`
  (`packages/doctor` description; staged-edit envelope description under "The
  agent"; dependency rule `core <- formats <- everything`).
- `docs\03-CONVENTIONS.md` (typed error
  classes with `userMessage`; "Output vocabulary is plain first"; no-emoji/no-em-dash
  rule).
- `specs\formats\canonical-model.md`
  (shared envelope shape; "An embedded lorebook is a REFERENCE" rule 3; prompt-
  bearing field list, "Design rules" 1).
- `specs\formats\escrow-and-roundtrip.md`
  ("Reports" section - `ParseReport`/`SerializeReport` shape the `format` pass reads).
- `specs\engine\token-counting.md` (full
  file - `TokenCounter` interface, "works with zero AI key" precedent this spec's
  deterministic tier follows).
- `specs\engine\lorebook-engine.md`
  Edge case 3 (dead-config `delayUntilRecursion` combination, explicitly names this
  spec as the intended consumer) and Edge case 15 (unreachable empty-trigger entry).
- `specs\engine\macro-engine.md` lines
  16-27 (explicitly names "the Script Doctor's macro lint pass" as a consumer,
  non-evaluating).
- `wireframes\magic\script-doctor.html`
  (full file - SD-1 "Examination Room" fix-by-fix flow and tile layout, SD-2
  "Before & After" full-card diff mode, SD-3 "Waiting Room" batch ward-round report
  shape and phrasing, all directly cited above).
- `templates\SPEC-TEMPLATE.md` (section
  structure followed).
- `<RoleCall>\apps\rc\src\lib\post-gen-actions\slopism-sets.ts`
  lines 1-120 (`SlopismBank`/`SlopismKind`/`SlopismScope` shape, `normalizeEntry`,
  `entryDedupeForms`) - cited as informative precedent for the slop-bank file
  format only, per the file-format field-map table above; this is a live-chat
  post-generation screening system, not a card auditor, so it is adapted, not
  ported.
- `<RoleCall>\apps\rc\anti-slop-banks\genre\academia.md`
  lines 1-60 (concrete on-disk bank file shape: YAML frontmatter + Markdown body
  list - confirms banks are authored as loose `.md` files with a codegen step in
  VAUDEVILLE, which this spec's loader replaces with direct `.md` loading, no
  codegen; see Non-goals).
- W++ character-format syntax: "W++ For Dummies," https://rentry.co/WPP_For_Dummies
  (accessed 2026-07) - confirms the
  `[Character("Name"){ Attribute("value1" + "value2") ... }]` bracket/quote/plus
  syntax cited in pass 6. No VAUDEVILLE source implements or documents W++ handling,
  so this is verified against the public community reference; web research is
  permitted for public formats (chara_card_v2/v3/charx/Backyard are treated the
  same way), and W++ is treated under the same spirit since it is likewise a
  public community format, not a VAUDEVILLE-internal one.

OPEN QUESTION: the health-score deduction weights (25/8/3/1 per severity) and the
band thresholds (0-49/50-79/80-100) are this spec's proposal, not derived from any
existing VAUDEVILLE or wireframe-documented formula - the wireframe shows example
numbers (61, 89, 31, 44, 68) consistent with these bands but was not built against
an explicit formula. Needs tuning against the real fixture corpus before M3 locks
the constants; treat the numbers in this spec as a starting point, not a final
answer.

OPEN QUESTION: whether `packages/doctor`'s slop-bank starter corpus should be
authored fresh for M3 or whether a licensing/content review of adapting phrase
lists from VAUDEVILLE's `anti-slop-banks/` corpus (Chi owns both codebases, so
reusing his own work is his to license) is acceptable reuse versus fresh authorship - this spec assumes fresh
authorship (see Non-goals) but the actual decision belongs to whoever scopes the
M3 slop-bank-corpus ticket.

OPEN QUESTION: macro-engine.md's exact behavior for an unknown macro name at
evaluation time (does it pass through as literal text, throw, or something else)
was described in this spec's pass 7 as "degrades to literal text... per
macro-engine.md's documented pass-through-unknown behavior" based on a partial read
of that spec (only its Purpose/Pipeline sections were read for this spec pass, not
its full Edge cases section). Confirm against macro-engine.md's own Edge cases list
before the macro-lint pass ticket is written; if the actual behavior differs, this
spec's `severity: low` classification for unknown-macro findings may need to change
to `medium` (a macro that throws or breaks assembly is more severe than one that
degrades gracefully).

OPEN QUESTION: the Jaccard-similarity threshold (0.8) and n-gram size (n=8) for
cross-field duplication detection, and the run-on-sentence heuristic's word/comma
count thresholds (60 words, 4 commas), are placeholder values chosen for
concreteness in this spec, not tuned against any corpus. Both need calibration
against `fixtures/script-doctor/` once that corpus exists, and may need to become
configurable (`DoctorConfig`) rather than hardcoded if early testing shows high
false-positive/negative rates across genres (a technical/formal-register card's
"normal" sentence length differs from a terse-dialogue card's).
