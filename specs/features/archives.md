# Spec: The Archives (distill-from-logs)

**Package:** `packages/archives` (new - not yet enumerated in `docs/02-ARCHITECTURE.md`'s
package list; see OPEN QUESTION 1, same situation as `packages/productions` in
`specs/engine/productions-and-history.md`) · **Milestone:** M7 (`docs/ROADMAP.md` "M7 - The
Archives + The World Forge (v0.6+)") · **Status:** draft
**Depends on:** `specs/formats/canonical-model.md` (canonical `Character`, `Lorebook`/
`LorebookEntry`, `Entity<T>` envelope), `specs/formats/escrow-and-roundtrip.md` (escrow
envelope shape, reused for storing non-canonical distillation metadata - see Behavior),
`specs/engine/productions-and-history.md` (production folder layout, entity file I/O,
history snapshots - distilled outputs land as ordinary entities in a production),
`specs/engine/token-counting.md` (word/scene-size accounting for intake summaries),
provider adapters (`specs/engine/provider-adapters.md`, not yet written -
semantic clustering and claim extraction require a configured AI
provider; see Behavior "Deterministic vs. AI-backed") · **VAUDEVILLE reference:** none -
this feature has no VAUDEVILLE precedent (RC has no log-distillation feature); designed
fresh from `wireframes/magic/archives.html` (AR-1 "The Intake Desk", AR-2 "The Evidence
Board").

## Purpose

The Archives ingests a user's old roleplay logs, fanfiction, or chat exports and
distills the characters and recurring settings that were already living in them into
real, playable Vaudeville entities: a canonical `Character` and, where the material
supports it, a canonical `Lorebook`. Distillation is not summarization - every field
the Archives writes into a distilled card or lorebook entry carries citations to the
exact spans of the source material that support it, and a deterministic verification
pass confirms every citation is real before that claim is allowed to reach the user for
review. This exists because `docs/01-VISION.md`'s fourth persona, "the archivist," has
years of RP logs containing characters nobody ever wrote down as a card, and because the
project's own anti-slop stance (`docs/01-VISION.md` "The Doctor is honest") demands that
an AI-authored artifact never present invented material as if it came from the user's
own history. This spec defines: the log-ingestion contract, scene addressing, voice
clustering, claim extraction with per-claim citations, the citation verification
algorithm, confidence tiers, the evidence review event stream, and how distilled output
lands in a production. This spec is self-contained, assuming no other context on
this component.

## Behavior

### Deterministic vs. AI-backed

Unlike the M1 Converter (v0.1, which works with zero AI key), the Archives' headline function genuinely requires a configured AI
provider. The deterministic/AI split, stated honestly:

**Runs with no key configured:**
- File ingestion, format sniffing, scene segmentation, scene indexing (Behavior below).
- Citation verification (a span either exists in the indexed source at the claimed
  offsets and contains the claimed substring, or it does not - a pure string
  comparison, never an AI judgment call).
- Evidence-board rendering of already-distilled results (re-displaying prior runs).

**Requires a provider (`packages/ai`, `specs/engine/provider-adapters.md`):**
- Voice clustering on freeform prose sources (grouping scenes by which character is
  speaking/acting when no explicit speaker field exists).
- Claim extraction (turning clustered scenes into candidate personality/speech-pattern/
  fact statements).
- Claim-to-citation proposal (the AI nominates which scenes support a candidate claim;
  the deterministic verification pass then checks the AI's work - see "Citation
  verification").
- Confidence scoring's semantic component (agreement/contradiction detection across
  cited scenes - see "Confidence tiers").

A production with the Archives module installed but no provider configured can still
ingest and index logs and browse prior distillation runs; it cannot run a new
distillation. This is the honest boundary; `vaud archives` surfaces "no provider
configured" rather than silently degrading to a worse, ungrounded distillation.

### Ingestion contract

This spec requires `.jsonl`, `.txt`, and `.md` intake. Rather than hardcoding any one platform's chat-export schema - no such schema
is confirmed against VAUDEVILLE source or a cited public spec in this pass, and inventing
one would violate the "never invent format facts" rule - this spec defines an abstract
**source adapter** contract that every concrete ingester implements:

```
SourceAdapter.sniff(file) -> boolean            // cheap format-shape check
SourceAdapter.decompose(file) -> RawScene[]      // ordered, individually addressable
```

A `RawScene` is the smallest unit the Archives cites against: for a structured chat log
this is one turn/message; for freeform prose (`.md` fic, `.txt` export) this is one
paragraph or one scene-break-delimited block (delimiter heuristic: two-or-more blank
lines, a markdown `---`/`***` rule, or a `.txt` file's own line-count-based chunking
when no structural marker exists - exact chunking heuristics are an implementation
detail of the `.txt`/`.md` adapter, not fixed by this spec beyond "must be
deterministic and reproducible run-to-run on unchanged input").

Three concrete adapters are in scope for M7:

1. **`.jsonl` chat-log adapter.** Each line is one JSON object representing one
   message/turn. OPEN QUESTION 2: the exact per-line field schema (speaker field name,
   message-text field name, timestamp field name) is not confirmed against any cited
   source in this pass - VAUDEVILLE has no chat-log distillation feature to extract
   from (see VAUDEVILLE reference above), and no public spec for a canonical "RP chat
   jsonl" format was researched here. The adapter must therefore support a small,
   explicit whitelist of known shapes (populated by whichever concrete jsonl exports the
   implementing ticket confirms against real files - e.g. a SillyTavern chat log export,
   if and when its exact field names are confirmed) plus a generic fallback: any JSON
   object with at least one string-valued field is treated as one `RawScene`, using the
   longest string field as the scene's text and any field named `name`/`speaker`/`role`
   (case-insensitive, in that priority order) as attribution if present. This fallback
   guarantees the adapter never rejects a `.jsonl` file outright, at the cost of weaker
   attribution.
2. **`.md` prose adapter.** Splits on markdown scene-break conventions (headings, `---`/
   `***` horizontal rules, or blank-line-delimited paragraphs as a last resort). No
   speaker attribution is available structurally; attribution is entirely a clustering
   job (see Voice clustering).
3. **`.txt` freeform adapter.** Same paragraph/blank-line splitting as the `.md`
   adapter, minus markdown-aware heading detection. Also the fallback path for "noisy"
   exports (the wireframe's "discord-export.txt ... noisy, filtered" line, AR-1) -
   filtering here means dropping scenes below a minimum-content threshold (e.g. bot
   command lines, timestamps-only lines, reaction-only lines) via a small set of
   deterministic noise heuristics (line is only punctuation/emoji, line matches a
   `HH:MM` timestamp-only pattern, line is shorter than N characters after trimming).
   Filtered lines are dropped from scene text but the drop count is reported to the user
   (AR-1's "5k words · noisy, filtered" chip), never silently discarded from the report.

PNG is listed in AR-1's dropzone copy (`.png` alongside `.jsonl .txt .md`) but a PNG in
this context is card art or an existing character card being fed in as reference
material, not a log format - it is out of scope for log ingestion and handled by the
existing character/persona codecs if a user drops one in; this spec does not define
PNG-as-log-source behavior.

### Scene addressing

Every `RawScene` must be citable by a stable, reproducible reference so that "scene 88"
in a review UI always resolves to the same span even across re-runs on unchanged input,
and so a citation can be deterministically verified. Addressing scheme:

```
SceneRef {
  sourceFile: string      // path relative to the ingestion batch root, not absolute
  sourceHash: string       // sha256 of the source file's bytes at ingestion time
  index: number             // 0-based ordinal position among RawScenes decomposed from this file
  offset: { start: number; end: number }  // byte offsets into the source file's UTF-8 bytes
  text: string               // the exact scene text, for display and verification
}
```

`index` is the human-facing "scene N" number (1-based in UI copy, per AR-2's "scene 88");
`offset` is the machine-verifiable anchor. Both are stored together because `index` is
what a citation names in prose and `offset` is what verification checks against - an
adapter re-run against byte-identical input must reproduce identical offsets (this is
the "deterministic and reproducible" requirement from Ingestion contract). If the source
file's bytes change between the original distillation run and a later verification pass
(edited, re-exported with different line endings, etc.), `sourceHash` mismatches and
every citation against that file is reported as **unverifiable**, not silently
re-resolved against new offsets - Edge case 6.

An **intake index** - the full set of `SceneRef`s produced by decomposing every file in
one ingestion batch - is itself an artifact, not recomputed on every operation. See
"Where distillation output lives" below for where it is stored.

### Voice clustering

Groups `SceneRef`s by who is speaking or acting in them, producing candidate voice
clusters (AR-1's "Voice 1 · 0.94 confidence · 214 scenes ... VESPER").

1. **Explicit-attribution sources** (a jsonl adapter that resolved a speaker field per
   Ingestion contract item 1): clustering starts from the literal distinct attribution
   values as a deterministic first pass - no AI needed to know that scenes attributed
   to the same name are the same voice. AI clustering then only needs to (a) merge
   attribution variants that are the same character under different labels (nicknames,
   typos) and (b) filter out non-character speakers (the human user's own persona voice,
   OOC/meta lines) - the wireframe's dropzone note "nothing leaves this machine" implies
   this step, like all AI steps, is a provider call the user has configured, run locally
   or on their chosen BYOK endpoint, never a hosted Vaudeville service.
2. **Freeform sources** (no structural attribution): clustering is entirely an AI job -
   the provider reads scene text and proposes a speaker/actor label per scene, then
   groups scenes sharing a label. This is the lower-confidence path and its output
   confidence tier should reflect that (see Confidence tiers).
3. **Non-character clusters.** A cluster need not resolve to a person at all - AR-1's
   third card, "A setting keeps recurring · 'the district' · 88 mentions," is a
   place/faction/recurring-noun cluster, not a voice. These are named `EntityCluster`s
   generically (kind: `"character"` or `"setting"`); a `"setting"` cluster's suggested
   action is "distill lorebook" (a `LorebookEntry`, not a `Character`) rather than
   "distill card." Detecting these is the same underlying clustering job scoped to
   noun-phrase recurrence rather than dialogue attribution; the exact detection
   algorithm is an implementation detail delegated to the provider's extraction prompt,
   not fixed by this spec.
4. **Review loop.** Every proposed cluster is user-correctable before distillation
   proceeds: merge two clusters, split one cluster into two, or mark a cluster
   `"ignore"` (AR-1's low-confidence "Voice 2" card shows `distill` / `ignore` chips).
   Corrections are recorded (see Evidence review event stream) so a re-run of the same
   batch does not resurface a merge/split/ignore decision the user already made.

### Claim extraction and per-claim citations

For each `character`-kind cluster the user chooses to distill, the provider proposes
**claims**: short, canonical-field-shaped statements ("keeps a mental ledger of every
favor", "hates being thanked") each tagged with the canonical field it targets
(`personality`, `description`/scenario framing, `mes_example` speech-pattern samples,
etc. - the canonical `Character` fields from `specs/formats/canonical-model.md`
"Character" section) and a list of `SceneRef.index` values the provider asserts support
it (AR-2: "Personality · 12 citations", each sub-claim tagged `[9 scenes]`, `[6]`,
`[2 · weak]`).

```
Claim {
  id: string
  clusterId: string
  targetField: CanonicalCharacterField   // e.g. "personality" | "description" | "mesExample" | ...
  text: string
  citedSceneRefs: string[]                // SceneRef ids (see Public API), AI-PROPOSED, unverified at this point
  verifiedSceneRefs: string[]             // subset of citedSceneRefs that passed verification - see below
  confidenceTier: ConfidenceTier
}
```

A claim's `citedSceneRefs` at proposal time is **untrusted input**, exactly as
untrusted as any other AI output this project treats adversarially (`docs/01-VISION.md`
"The Doctor is honest" - the same posture applies here even though the Doctor and the
Archives are different components). The provider can hallucinate a scene reference that
does not exist, or claim a real scene supports text the scene does not actually contain.

### Citation verification (the load-bearing check)

Before any claim is shown to the user as "cited," every entry in `citedSceneRefs` runs
through a deterministic, provider-free verification step:

1. Resolve the `SceneRef` id against the intake index for this batch. If it does not
   exist (hallucinated id, or an id from a different batch), the citation is
   **invalid** - dropped from `verifiedSceneRefs`, logged.
2. Compare `sourceHash` on the resolved `SceneRef` against the current on-disk source
   file's hash. Mismatch means the underlying file changed since ingestion - the
   citation is **unverifiable** (Edge case 6), a distinct outcome from invalid.
3. This spec does NOT require the verifier to confirm that the claim's prose is
   semantically entailed by the cited scene text (that would itself require an AI
   judgment call, defeating the point of a deterministic check). What it DOES require,
   as the minimum bar that keeps this a real check rather than a rubber stamp: the
   provider's claim-extraction step must additionally return, per citation, a short
   **quoted excerpt** it is grounding the claim in (this is what AR-2's receipts panel
   renders - "scene 88 · our-rp-2024: 'Don't. Thank me and I'll charge interest.'").
   The verifier confirms that excerpt is a **substring of the actual scene text** at the
   claimed `SceneRef` (case-sensitive-off, whitespace-normalized comparison). An excerpt
   that is not found verbatim in the scene fails verification for that citation.
4. A claim with zero entries surviving in `verifiedSceneRefs` is never shown to the user
   as a citable claim - it is either discarded before the evidence review step or
   surfaced separately as "proposed but unverifiable," never mixed into the normal
   review flow with a citation count implying it checked out (Edge case 7).
5. This check only proves the excerpt exists in the source - it is a hallucination
   backstop, not a semantic-accuracy guarantee. A provider could quote a real line
   out of context to support a false characterization; the human review step (Evidence
   review event stream) is what catches that, same as AR-2's "keep / sometimes / cut"
   chips exist specifically because automated confidence is not truth.

### Confidence tiers

A documented, stable formula per claim (mirroring the Script Doctor's health-score
approach - the same house standard: heuristic, not fake precision):

```
verifiedCount = claim.verifiedSceneRefs.length
tier =
  verifiedCount === 0            -> "unverifiable"   // never shown as a normal claim, see above
  verifiedCount === 1            -> "weak"            // AR-2's "[2 · weak]" language covers 1-2; see note
  verifiedCount >= 2 && < 5       -> "moderate"
  verifiedCount >= 5              -> "strong"
```

Note: AR-2's mock shows a `[2 · weak]` tag at 2 citations while the prose above places
the `weak` boundary at exactly 1. Reconciled here as: `weak` = 1-2 verified citations,
`moderate` = 3-4, `strong` = 5+, matching the wireframe's own displayed threshold rather
than a value invented independently. Contradiction detection (a `moderate`/`strong`
claim whose cited scenes actually disagree with each other, downgrading its tier)
requires a provider judgment call and is explicitly a second, AI-backed refinement on
top of the citation-count base tier, not a replacement for it - the count-based tier
always exists even with no provider available to re-check for the review UI's initial
render (Deterministic vs. AI-backed).

A cluster's own overall confidence (AR-1's "0.94 confidence") is a distinct, coarser
score describing clustering quality (how cleanly scenes separated into this voice vs.
others), not a claim-level tier - it is entirely a provider output with no deterministic
verification step, since there is no ground truth to check a clustering decision
against the way a citation can be checked against source bytes. OPEN QUESTION 3: exact
formula for the cluster-level confidence score (e.g. scene-count-weighted inter-cluster
similarity margin) is not specified here; left to the implementing ticket, documented in
code once decided, per the same "documented, stable" requirement as the claim tiers.

### Evidence review event stream

Modeled the same way as the Table Read's living-document protocol
(a UI-agnostic event stream protocol) so CLI and
a future Studio surface share one implementation:

- `cluster.proposed` - a new `EntityCluster` is ready for the intake-desk decision
  (AR-1: distill / ignore, or for weak clusters, distill / ignore with a visible
  confidence).
- `cluster.corrected` - user merges, splits, or ignores a cluster.
- `claim.proposed` - a claim with its tier is ready for review (AR-2).
- `claim.decided` - user resolves a claim: `"keep"` | `"sometimes"` | `"cut"`. `"sometimes"`
  (AR-2's third chip) means the claim is kept but rewritten/qualified rather than stated
  flatly - the exact rewrite is a follow-up AI call scoped to that one claim, or a
  manual edit; this spec does not mandate which.
- `batch.acceptAllCited` - the fast path from AR-2's "ACCEPT ALL CITED" button: every
  claim at `strong` or `moderate` tier is auto-decided `"keep"` in one action; `weak`
  and `unverifiable` claims are left for individual review. This directly answers the
  wireframe's own "For/Against" note (AR-2: "needs a 'trust the strong citations' fast
  path").
- `distillation.completed` - every in-scope claim has a decision; the distilled
  `Character`/`Lorebook` entities are ready to write.

This event stream is UI-agnostic per the same house convention as Table Read
(`specs/features/table-read.md`, not yet written in this pass) - the Archives CLI command and a future Studio panel both drive the same
state machine; this spec does not fix a transport (stdout JSON lines, an in-process
event emitter, etc.), only the event vocabulary and ordering constraints (a claim cannot
receive `claim.decided` before its `claim.proposed`; `distillation.completed` cannot
fire while any `cluster.proposed` remains undecided).

### Distill outputs

Distillation produces ordinary canonical entities - **no new entity type**. A
`character`-kind cluster with decided claims produces a canonical `Character`
(`specs/formats/canonical-model.md` "Character"): each kept/sometimes claim's `text`
(post-rewrite for `"sometimes"`) is composed into the claim's `targetField`, multiple
claims targeting the same field joined into coherent prose (composition, not naive
string concatenation - an AI pass, since turning five discrete kept claims into one
readable `personality` paragraph is a generation task, not a mechanical join; this is
run once at `distillation.completed`, not per-claim). A `setting`-kind cluster produces
one or more canonical `LorebookEntry` rows in a new or existing canonical `Lorebook`
(keys derived from the cluster's recurring noun-phrase, content composed from its kept
claims the same way).

**Where distillation output lives.** Distilled `Character`/`Lorebook` entities are
written through `packages/productions`' `writeEntity` (per
`specs/engine/productions-and-history.md`'s Public API sketch) exactly like any other
studio-created entity - they land in the current production's `characters/`/`lorebooks/`
folders as normal entity files, get a normal history snapshot (`trigger: "manual"` or a
new Archives-specific trigger value - OPEN QUESTION 4: should `SnapshotTrigger` gain an
`"archives-distill"` member, or does the generic `"manual"` trigger suffice since this
is functionally a manual user action confirming AI-proposed content?), and are
indistinguishable from a hand-built or Table-Read-built entity once committed.

**Where evidence/citation metadata lives.** This is NOT stored inside the distilled
`Entity<Character>`'s `data` or `escrow` fields - canonical `Character` (per
canonical-model.md) has no citation-shaped field, and escrow per
`specs/formats/escrow-and-roundtrip.md` is defined as "fields the canonical model has
no home for, **keyed by the format that owns them**" - citations are not a foreign
format's fields, they are Archives-specific provenance about how this entity was
authored, a different concern entirely. Cramming citations into escrow would also mean
every future codec serializer has to know to ignore/preserve an "archives" escrow
namespace it has no business touching. Instead: a **sidecar evidence artifact**, one
per distillation run, stored under the production's reserved area alongside but
separate from `.vaud/history/` (per `specs/engine/productions-and-history.md`'s rule
that `.vaud/` is the only folder that spec reserves - this spec proposes
`.vaud/archives/<runId>/` as an Archives-owned subtree of that same reservation, not a
second top-level reserved folder, to avoid clutter in a user's file-manager view of the
production root):

```
.vaud/archives/<runId>/
  intake-index.json     // every SceneRef from every ingested file in this batch
  clusters.json          // EntityCluster[] with correction history
  claims.json             // Claim[] with citations, verification results, tiers, decisions
  produced.json            // { entityId, entityType }[] - which entities this run produced
```

The intake source files themselves (the original `.jsonl`/`.txt`/`.md` logs) are NOT
copied into `.vaud/archives/` by this mechanism - they are referenced by path and
`sourceHash` only, same as productions-and-history.md's asset-reference pattern (edge
case 8 there: "does not validate or resolve asset existence"). A user who moves or
deletes their source logs after distillation keeps the distilled entity (it is now a
normal, independent production entity) but loses the ability to re-open the evidence
board for that run (Edge case 6).

## Public API sketch

```ts
// packages/archives

import type { Entity, Character, Lorebook } from "@vaudeville/core";
import type { Production } from "@vaudeville/productions";

export type SourceKind = "jsonl" | "md" | "txt";

export interface SourceAdapter {
  kind: SourceKind;
  sniff(filePath: string, sampleBytes: Buffer): boolean;
  decompose(filePath: string, fileBytes: Buffer): RawScene[];
}

export interface RawScene {
  index: number;                 // 0-based, order of appearance within this file
  offset: { start: number; end: number };
  text: string;
  attribution?: string;          // speaker/actor label, if structurally available
}

export interface SceneRef {
  id: string;                    // stable id: hash(sourceHash, index)
  sourceFile: string;            // relative to the ingestion batch root
  sourceHash: string;            // sha256 of source file bytes at ingestion time
  index: number;
  offset: { start: number; end: number };
  text: string;
}

export interface IntakeIndex {
  runId: string;
  createdAt: string;             // ISO
  files: Array<{ path: string; sourceHash: string; sceneCount: number; wordCount: number; filteredCount: number }>;
  scenes: SceneRef[];
}

/** Runs sniff/decompose over every file in `filePaths`, producing one IntakeIndex.
 *  Deterministic, provider-free. */
export function ingest(filePaths: string[], opts?: { adapters?: SourceAdapter[] }): Promise<IntakeIndex>;

export type ClusterKind = "character" | "setting";
export type ClusterDecision = "pending" | "distill" | "ignore" | "merged" | "split";

export interface EntityCluster {
  id: string;
  kind: ClusterKind;
  label: string;                  // proposed name, e.g. "VESPER" or "the district"
  sceneRefIds: string[];
  clusterConfidence: number;      // 0-1, provider-scored, unverified (see OPEN QUESTION 3)
  decision: ClusterDecision;
  mergedFrom?: string[];          // cluster ids, if decision === "merged"
}

export type ConfidenceTier = "unverifiable" | "weak" | "moderate" | "strong";
export type ClaimDecision = "pending" | "keep" | "sometimes" | "cut";

export interface Citation {
  sceneRefId: string;
  quotedExcerpt: string;          // provider-proposed, verified against SceneRef.text
  verified: boolean;
  verificationFailureReason?: "scene-not-found" | "source-hash-mismatch" | "excerpt-not-found";
}

export interface Claim {
  id: string;
  clusterId: string;
  targetField: string;            // canonical Character field path, e.g. "data.personality"
  text: string;
  citations: Citation[];
  confidenceTier: ConfidenceTier;
  decision: ClaimDecision;
  rewrittenText?: string;         // set when decision === "sometimes"
}

/** AI-backed. Requires a configured provider (specs/engine/provider-adapters.md). */
export function clusterVoices(index: IntakeIndex, opts: { provider: ProviderRef }): Promise<EntityCluster[]>;

/** AI-backed proposal + deterministic verification, run together as one step so a
 *  caller never sees unverified citations. */
export function extractClaims(
  index: IntakeIndex,
  cluster: EntityCluster,
  opts: { provider: ProviderRef }
): Promise<Claim[]>;

/** Pure, provider-free. Re-checks (or checks for the first time) every citation in
 *  `claims` against `index` and the current on-disk source files. */
export function verifyCitations(claims: Claim[], index: IntakeIndex): Promise<Claim[]>;

export type ArchivesEvent =
  | { type: "cluster.proposed"; cluster: EntityCluster }
  | { type: "cluster.corrected"; clusterId: string; decision: ClusterDecision; mergedFrom?: string[] }
  | { type: "claim.proposed"; claim: Claim }
  | { type: "claim.decided"; claimId: string; decision: ClaimDecision; rewrittenText?: string }
  | { type: "batch.acceptAllCited"; acceptedClaimIds: string[] }
  | { type: "distillation.completed"; runId: string; produced: Array<{ entityId: string; entityType: "character" | "lorebook" }> };

/** Composes decided claims into canonical entities and writes them into `production`
 *  via packages/productions' writeEntity, then writes the .vaud/archives/<runId>/
 *  sidecar artifact. AI-backed for the prose-composition step. */
export function distill(
  production: Production,
  runId: string,
  clusters: EntityCluster[],
  claims: Claim[],
  opts: { provider: ProviderRef }
): Promise<{ produced: Array<Entity<Character> | Entity<Lorebook>>; events: ArchivesEvent[] }>;

/** Re-opens a prior run's evidence board from .vaud/archives/<runId>/ for review or
 *  re-verification. Provider-free (re-verification is deterministic). */
export function loadRun(production: Production, runId: string): Promise<{ index: IntakeIndex; clusters: EntityCluster[]; claims: Claim[] }>;

// ProviderRef is defined by specs/engine/provider-adapters.md; referenced, not
// re-specified here.
export type ProviderRef = unknown; // OPEN QUESTION: exact shape pending provider-adapters.md
```

## Edge cases & failure modes

1. **A `.jsonl` line is not valid JSON.** Skip that line, count it in a
   `malformedLineCount` on the file's `IntakeIndex` entry, continue decomposing the rest
   of the file. Never abort ingestion of an otherwise-valid file over one bad line.
2. **A source file is empty or contains zero scenes after filtering** (an all-noise
   `.txt` export). `ingest()` still produces a `files[]` entry for it (`sceneCount: 0`)
   rather than silently omitting the file, so the intake-desk UI can report "0 usable
   scenes found" instead of the file just not appearing.
3. **The same source file is ingested twice in one batch** (user drags the same file in
   twice, or two files with identical content but different names). `sourceHash` is
   identical; scenes from both get distinct `SceneRef.id`s (id incorporates `sourceFile`
   path, not just hash) but citation verification treats them as equally valid - no
   deduplication is performed at ingestion time. OPEN QUESTION 5: should a duplicate-hash
   file be flagged to the user before clustering runs (wasted provider spend on
   redundant content), or is silent double-counting acceptable since it only inflates a
   confidence tier, never fabricates a citation?
4. **A cluster the provider proposes has zero surviving claims after review** (every
   claim decided `"cut"`, or the cluster itself decided `"ignore"`). `distill()` produces
   no entity for that cluster; `produced` simply omits it. Not an error.
5. **Two clusters both claim the same `SceneRef`** (a scene where two characters
   interact, both voices legitimately cited). Allowed - `sceneRefIds`/`citations` are
   not exclusive across clusters/claims. A `SceneRef` can appear in citations for
   multiple, otherwise-unrelated claims.
6. **A citation's `SceneRef.sourceHash` no longer matches the current file on disk**
   (edited, re-exported, moved-and-replaced). `verifyCitations` marks every citation
   against that `sourceFile` `verified: false, verificationFailureReason:
   "source-hash-mismatch"` and downgrades affected claims' tiers accordingly (a claim
   that drops to zero verified citations becomes `"unverifiable"`, per Confidence
   tiers). This can turn a previously `"strong"` claim in `.vaud/archives/<runId>/` into
   `"unverifiable"` on `loadRun()` without the claim's own text changing - the review UI
   must surface this as "source changed since distillation," not silently re-tier
   without explanation.
7. **A claim's citations are entirely unverifiable at proposal time** (the provider
   hallucinated every scene reference for a claim). Per Behavior "Citation verification"
   item 4, this claim never enters the normal `claim.proposed` review flow as a citable
   claim. OPEN QUESTION 6: is it discarded outright, or surfaced in a separate
   "proposed but could not be grounded" bucket the user can inspect (useful for
   debugging a bad clustering run) without it polluting the main review queue's citation
   counts? Leaning toward the latter for transparency, not locked.
8. **User corrects a cluster (merge/split) AFTER claims have already been extracted for
   it.** A split invalidates every existing claim's `clusterId` reference for the
   scenes that moved to the new cluster; a merge does not invalidate claims but may
   produce duplicate/overlapping claims across the merged clusters' original claim
   sets. This spec requires `extractClaims` to be re-run for any cluster touched by a
   `cluster.corrected` event with `decision: "merged" | "split"` - prior claims tied to
   the pre-correction cluster id(s) are discarded, not patched in place, to avoid
   claim/cluster bookkeeping drift.
9. **The user re-runs distillation on the exact same file set** (same batch, re-ingested
   fresh rather than via `loadRun`). Scene addressing (offset-based, deterministic
   chunking) means a byte-identical file produces byte-identical `SceneRef`s and thus
   the same `SceneRef.id`s as the prior run, but clustering/claim-extraction are AI
   calls and are NOT guaranteed deterministic across runs (a re-run may propose
   different cluster boundaries or claim wording even on identical input). This is an
   accepted property, not a bug this spec fixes - reproducibility is guaranteed for the
   deterministic layer (ingestion, verification) only, per Ingestion contract /
   Scene addressing.
10. **A `"setting"` cluster's recurring noun-phrase is also a character's name** (e.g.
    "the district" style ambiguity where a place and a person share a label). Clustering
    resolves this as a provider judgment call at proposal time (same mechanism as
    Voice clustering item 3); no deterministic disambiguation rule is defined here. If
    misclassified, the user's only recourse in-flow is `"ignore"` the wrong-kind cluster
    and, if the correct-kind cluster was not also proposed, there is currently no
    "reclassify kind" event in the vocabulary - OPEN QUESTION 7: should
    `cluster.corrected` support a `reclassify` decision changing `kind` in place, or is
    ignore-and-manually-recreate sufficient for M7?
11. **`distill()` is called with a production that has no configured provider** (the
    ingestion/clustering steps ran previously via `loadRun`, e.g. resuming a session, but
    the provider was since removed from the key vault). Composition of kept claims into
    canonical fields fails with a named "no provider configured" error before any
    `writeEntity` call - a partial write (some fields composed, others not) must never
    reach the production; `distill()` is all-or-nothing per run.
12. **A user drops a `.png` character card into the intake desk expecting it to seed
    context** (e.g. "here's the character as they exist today, now distill the rest from
    logs"). Out of scope per Behavior's "Ingestion contract" closing note - this spec
    does not define merging a distillation run against a pre-existing `Character`
    entity. OPEN QUESTION 8: is "distill into an existing card, filling only empty
    fields" a real M7 requirement (the wireframe does not show it) or purely an M7+
    follow-on? Left open; `distill()` as sketched always produces new entities.
13. **Extremely large intake batches** (the archivist persona's "years of RP logs").
    No size cap is defined in this spec, mirroring `productions-and-history.md` edge
    case 5's stance on large assets. `ingest()`'s cost is I/O-bound and cheap; the
    expensive, capped-by-provider-context-window step is `clusterVoices`/
    `extractClaims`, which must chunk/batch scenes across multiple provider calls rather
    than attempting one call over an unbounded scene list - exact batching strategy
    (by token budget, via `specs/engine/token-counting.md`) is an implementation detail
    left to the ticket, not fixed here.

## Test plan

- Fixtures required:
  - `fixtures/archives/jsonl/generic-fallback.jsonl` - chat-shaped JSON lines using the
    generic-fallback field detection from Ingestion contract item 1 (no confirmed named
    platform schema), including one malformed line (edge case 1).
  - `fixtures/archives/md/multi-scene-fic.md` - a short fic with `---` scene breaks and
    at least two recurring character voices plus one recurring setting mention, sized to
    exercise Voice clustering items 2-3 together (mirrors AR-1's "vesper-oneshots.md").
  - `fixtures/archives/txt/noisy-discord-export.txt` - freeform `.txt` with interleaved
    noise lines (timestamps, reaction-only lines) to exercise the noise-filtering
    heuristics and `filteredCount` reporting (mirrors AR-1's "discord-export.txt ...
    noisy, filtered").
  - `fixtures/archives/txt/empty-after-filtering.txt` - entirely noise, exercises edge
    case 2.
  - `fixtures/archives/verification/hallucinated-scene-ref.json` - a hand-built `Claim[]`
    fixture (not run through a live provider) where one citation references a
    nonexistent `SceneRef.id` and another quotes an excerpt not present in its cited
    scene's text, run through `verifyCitations` directly to pin the deterministic
    algorithm without needing a provider call in CI.
  - `fixtures/archives/verification/source-hash-mismatch/` - an `IntakeIndex` fixture
    plus a modified copy of the same-named source file, exercising edge case 6's
    re-tiering on `loadRun`.
  - `fixtures/archives/run/full-evidence-board/` - a complete hand-built
    `.vaud/archives/<runId>/` sidecar artifact (all four JSON files) mirroring AR-2's
    Vesper example (12 personality citations, 31 speech-pattern citations, one 2-citation
    weak claim), used to test `loadRun` and confidence-tier rendering end to end without
    live provider calls.
- Round-Trip Law applicability: none - the Archives is not a format codec and produces
  no round-trip guarantee of its own (per `specs/formats/escrow-and-roundtrip.md`'s Law
  being scoped to `serialize(parse(F), X)` for format `X`; distillation is a one-way,
  lossy-by-design authoring process, not a codec pair). Distilled `Character`/`Lorebook`
  entities, once written, ARE ordinary canonical entities and inherit the Round-Trip
  Law obligations of whichever codec later serializes them - that is those codecs'
  concern, not this spec's.
- Property/unit tests beyond fixtures:
  - `ingest()` on a byte-identical file run twice produces byte-identical `SceneRef[]`
    (offsets, `id`s, `sourceHash`) - the reproducibility guarantee from Scene addressing.
  - `verifyCitations` never reports `verified: true` for an excerpt that is not an exact
    (whitespace-normalized) substring of its cited scene's `text`.
  - `verifyCitations` is idempotent: running it twice on the same `Claim[]`/`IntakeIndex`
    pair with no file changes produces identical output.
  - A `Claim` whose `verifiedSceneRefs`/`citations.filter(c => c.verified)` count crosses
    a tier boundary produces the exact tier named in Confidence tiers' formula (table-driven
    test over 0/1/2/3/4/5/6 verified citations).
  - `batch.acceptAllCited` never auto-decides a `"weak"` or `"unverifiable"` claim.
  - Event ordering constraints from Evidence review event stream (`claim.decided` never
    precedes its `claim.proposed`; `distillation.completed` never fires with a pending
    `cluster.proposed`) enforced by a state-machine test feeding events in both valid and
    deliberately-invalid order.

## Non-goals

- Does not create characters from nothing - that is the Table Read
  (`specs/features/table-read.md`, M4). The Archives only distills from material the
  user already has; if a cluster's evidence is too thin to responsibly distill, this
  spec's answer is "flag it weak / let the user cut it," never "have the AI fill the gap
  from imagination" - that would defeat the citation-grounding purpose entirely.
- Does not grow a world interactively or run continuity checks across entities - that is
  World Forge (`specs/features/world-forge.md`, M7 sibling). The overlap point: a
  distilled `"setting"` cluster produces a `LorebookEntry`, and World Forge's own export
  mapping also targets `LorebookEntry`; this spec's distilled
  lorebook entries are a valid INPUT a user could later hand to World Forge for
  relationship/continuity modeling, but the Archives itself performs no such modeling.
- Does not merge distillation output into a pre-existing `Character`/`Lorebook` entity
  (Edge case 12) - always produces new entities in this pass.
- Does not define the exact `.jsonl` chat-log field schema for any specific platform
  (OPEN QUESTION 2) - ships a generic fallback only until a concrete platform schema is
  confirmed against a real source and added as a named adapter.
- Does not define the CLI command grammar (`vaud archives ...`) - that belongs to a
  CLI-facing spec that calls the API sketched here, same boundary
  `specs/engine/productions-and-history.md` draws for its own snapshot/restore commands.
- Does not define encryption, upload, or any network transmission of ingested log
  content - per `docs/02-ARCHITECTURE.md`'s security invariants, the only network calls
  this feature makes are to the user's own configured AI provider for the AI-backed
  steps named above; source logs are never sent anywhere else, and AR-1's own copy
  ("nothing leaves this machine. Local files, your key.") is a product promise this spec
  treats as a hard constraint, not marketing text.
- Does not implement garbage collection of old `.vaud/archives/<runId>/` sidecar
  artifacts. Every run is kept until the user (or a future `vaud archives prune`
  command, unspecified here) removes it.

## Sources consulted

- `docs/01-VISION.md` (the "archivist"
  persona, line 13-14; "The Doctor is honest" anti-slop stance, line 25-27, applied here
  by analogy to citation trust)
- `docs/02-ARCHITECTURE.md` lines 6-40
  (package layout - no `packages/archives` currently listed, hence OPEN QUESTION 1),
  lines 85-90 (security & privacy invariants - no network calls except configured
  providers, applied to Non-goals)
- `docs/ROADMAP.md` lines 73-80 ("M7 - The
  Archives + The World Forge (v0.6+)" exit criterion: "distill a real character from
  >= 20k words of logs where every field cites real scenes")
- `specs/formats/canonical-model.md` (full
  file - `Entity<T>` envelope, `Character`/`Lorebook` field surfaces, escrow's
  "keyed by the format that owns them" definition used to justify NOT storing citations
  in escrow)
- `specs/formats/escrow-and-roundtrip.md`
  (full file - Round-Trip Law scope, used in Test plan to state non-applicability)
- `specs/engine/productions-and-history.md`
  (full file - production folder layout, `.vaud/` reservation rule used to justify
  `.vaud/archives/<runId>/` placement, `writeEntity`/`SnapshotTrigger` API reused/
  extended, asset-reference-not-copy pattern reused for source-log references)
- `wireframes/magic/archives.html` (full
  file - AR-1 "The Intake Desk" lines 27-57, AR-2 "The Evidence Board" lines 59-92;
  every quoted UI copy fragment in this spec - "0.94 confidence", "12 citations", "2
  scenes only", "ACCEPT ALL CITED", "nothing leaves this machine" - is drawn verbatim
  from this file)
- `templates/SPEC-TEMPLATE.md` (structure)
- VAUDEVILLE `apps/rc/src/lib/imports/sillytavern-backup-client.ts`,
  `apps/rc/src/lib/imports/bulk-import-orchestrator.ts`, and other `jsonl`-matching
  files found via a repo-wide search - read only to confirm RC has no existing
  chat-log/RP-log distillation feature to extract ground truth from (none found; these
  files concern SillyTavern backup/bundle import of cards/lorebooks, not chat
  transcripts), which is why OPEN QUESTION 2 exists rather than an asserted jsonl
  chat-log schema.

## Open questions

- OPEN QUESTION 1: `packages/archives` is not yet listed in `docs/02-ARCHITECTURE.md`'s
  package layout; needs to be added when this spec is approved (same situation as
  `packages/productions`).
- OPEN QUESTION 2: exact `.jsonl` chat-log field schema (speaker/message/timestamp field
  names) for any specific platform export is unconfirmed; only a generic fallback
  detection is specified until a concrete source is verified against real files.
- OPEN QUESTION 3: exact formula for cluster-level (`EntityCluster.clusterConfidence`)
  scoring is left to the implementing ticket; must be documented and stable once chosen.
- OPEN QUESTION 4: should `SnapshotTrigger` (productions-and-history.md) gain a
  dedicated `"archives-distill"` member, or is `"manual"` sufficient?
- OPEN QUESTION 5: should duplicate-content source files in one ingestion batch be
  flagged before clustering runs (wasted provider spend), or is silent double-counting
  acceptable?
- OPEN QUESTION 6: are claims with zero verified citations discarded outright, or
  surfaced in a separate "could not be grounded" debug bucket?
- OPEN QUESTION 7: should `cluster.corrected` support a `reclassify` decision (changing
  `kind` between `"character"` and `"setting"` in place), or is ignore-and-manually-
  recreate sufficient for M7?
- OPEN QUESTION 8: is "distill into an existing card, filling only empty fields" in
  scope for M7, or a follow-on? The wireframe does not show this flow.
