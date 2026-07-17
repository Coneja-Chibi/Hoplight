# Spec: The World Forge

**Package:** `packages/core` (World data model, extends canonical Lorebook) +
`packages/lore` (relation graph, continuity engine) · **Milestone:** M7
**Status:** draft
**Depends on:** specs/formats/canonical-model.md, specs/formats/escrow-and-roundtrip.md,
specs/formats/st-worldinfo.md (unwritten at time of writing; cited by path per bible),
specs/formats/rolecall-lorebook.md (unwritten at time of writing; cited by path per bible),
specs/engine/lorebook-engine.md (unwritten at time of writing; cited by path per bible),
specs/features/table-read.md (unwritten at time of writing; cited by path per bible,
event-stream contract reused by the interview spiral)
**VAUDEVILLE reference:** `apps/rc/src/lib/compendium/computed.ts` (relation-scan
pattern only, not the type catalog — see Non-goals),
`packages/lorebook/src/types.ts` (`Lorebook` :342, `LorebookEntry` :216)

## Purpose

The World Forge is the M7 worldbuilding feature: a user starts from one idea (a
character, a place, a rumor) and grows a linked world of pins — people, places,
factions, secrets, events — through an interview that widens ring by ring. Every
pin exports as a lorebook entry and (in the app face) a compendium-style node. A
standing "continuity desk" pass flags cross-pin contradictions as they're
introduced, so the world stays consistent without a separate audit step. This spec
defines the World data model, how it sits on top of the canonical Lorebook, the
interview-spiral behavior, the export mapping, and the continuity engine.

## Behavior

### 1. The World data model

Per `specs/formats/canonical-model.md` (line 11-12): "`World`/compendium arrives
with M7 and extends Lorebook rather than replacing it." Concretely:

- A **World** is a canonical `Lorebook` (packages/core) with `lorebookType: 'world'`
  and an additional `worldMeta` block (interview state, continuity state — see
  below). It is not a new top-level content type; it reuses the `Lorebook`
  `Entity<T>` envelope (id, escrow, meta) from canonical-model.md.
- A **WorldPin** is a canonical `LorebookEntry` (packages/core, following the field
  surface adopted from VAUDEVILLE `packages/lorebook/src/types.ts:216`) carrying
  two extra pieces of data inside its existing `metadata?: Record<string, unknown>`
  bag (types.ts:320):
  - `metadata.entry_type: PinKind` — the discriminator (`"person" | "place" |
    "faction" | "secret" | "event"`).
  - `metadata.structured_data: PersonData | PlaceData | FactionData | SecretData
    | EventData` — the typed payload for that kind.

  This mirrors how VAUDEVILLE's compendium stores typed entries on top of
  `LorebookEntry` (`computed.ts` :17-27, `structuredOf`/`typeOf` helpers), which is
  the ground truth this spec is instructed to reuse for the storage mechanism. The
  free-text `content` field on `LorebookEntry` remains the prose the lorebook
  engine injects into prompts; `structured_data` is the machine-readable shadow of
  that prose that the relation graph and continuity engine scan. Writers/agents
  are responsible for keeping `content` and `structured_data` in agreement — this
  is exactly the kind of drift the continuity desk (section 4) is built to catch
  as a structured-field disagreement, not a hidden dual-source-of-truth problem.
  `title` (types.ts:225) is the pin's display name.

- **`name(pin)` resolution**, mirrored from `computed.ts` `nameOf` (:30-38): prefer
  `structured_data.name`, else `entry.title`. World Forge pins always set
  `structured_data.name` when created through the interview; `title` is kept in
  sync for lorebook-engine trigger display purposes.

#### PinKind field-map (5 pin types — see Non-goals for why only 5)

Each kind's `structured_data` shape and its typed relation edges. Edge names are
this spec's own design, following the `SCAN_RULES` pattern from `computed.ts`
(:241-318: `field` / `edgeType` / `shape` / optional `itemKey`) but trimmed and
renamed to the 5-kind World Forge taxonomy — they are NOT a copy of VAUDEVILLE's
11-type table. Where a VAUDEVILLE field name has an obvious analog it is reused
for familiarity; this is called out per row.

**person** (`PersonData`)

| Field | Shape | Edge type | Target kind | Notes |
|---|---|---|---|---|
| `name` | scalar string | — | — | required |
| `role` | scalar string | — | — | short tagline, e.g. "the broker" (matches corkboard pin subtitle in wireframe) |
| `description` | scalar string | — | — | prose |
| `relationships` | array of `{ with: string, kind: string }` | `relationship` | person | analog of computed.ts:243 `relationships`/`with` |
| `affiliations` | array of string (faction names) | `affiliation` | faction | analog of computed.ts:244 `affiliations`/`org`, simplified to plain names (no per-affiliation role sub-object — OPEN QUESTION below) |
| `current_location` | scalar string | `current_location` | place | analog of computed.ts:246 `current_state.location`, flattened |
| `knows_secrets` | array of string (secret names) | `knows_secret` | secret | new: person kind has no VAUDEVILLE analog for secret-knowledge; designed for this spec |
| `involved_in` | array of string (event names) | `involved_in` | event | new: designed for this spec |

**place** (`PlaceData`)

| Field | Shape | Edge type | Target kind | Notes |
|---|---|---|---|---|
| `name` | scalar string | — | — | required |
| `description` | scalar string | — | — | prose |
| `parent_location` | scalar string | `parent_location` | place | direct analog, computed.ts:256 |
| `connected_to` | array of string | `connected_to` | place | direct analog, computed.ts:257 |
| `controlled_by` | scalar string | `controlled_by` | faction | analog of computed.ts:261 `controlling_faction` |
| `notable_events` | array of string (event names) | `notable_event` | event | new: designed for this spec |

**faction** (`FactionData`)

| Field | Shape | Edge type | Target kind | Notes |
|---|---|---|---|---|
| `name` | scalar string | — | — | required |
| `description` | scalar string | — | — | prose |
| `leader` | scalar string | `leader` | person | direct analog, computed.ts:270 |
| `members` | array of string (person names) | `member` | person | simplified from computed.ts:271 (`array_of_objects`/`name`) to plain names — World Forge pins don't carry per-member role text; the `content` prose can |
| `allies` | array of string | `ally` | faction | direct analog, computed.ts:272 |
| `enemies` | array of string | `enemy` | faction | direct analog, computed.ts:273 |
| `territory` | array of string (place names) | `territory` | place | direct analog, computed.ts:274 |
| `origin_event` | scalar string | `origin_event` | event | new: designed for this spec |

**secret** (`SecretData`)

No SCAN_RULES analog exists in `computed.ts` — VAUDEVILLE's compendium has no
`secret` entry type. This shape is designed fresh for World Forge, driven by the
wireframe's "3 cards depend on this" callout (`wireframes/magic/world-forge.html`
line 44-45).

| Field | Shape | Edge type | Target kind | Notes |
|---|---|---|---|---|
| `name` | scalar string | — | — | required, short label e.g. "The ledger is a person" |
| `truth` | scalar string | — | — | the actual fact, prose |
| `known_by` | array of string (person names) | `known_by` | person | who currently knows |
| `concerns` | array of string (any pin name, mixed kind) | `concerns` | any | who/what the secret is about; resolution is name-based across all pin kinds, not kind-restricted (see `resolveByName` in API sketch) |
| `depends_on` | array of string (any pin name, mixed kind) | `depended_on_by` (reverse) | any | pins whose current shape assumes this secret is true; this is the literal "3 cards depend on this" counter — computed as `incoming` edges of type `depended_on_by`, mirroring `computeEntryLinks`'s incoming-link pattern (computed.ts :439-546) |
| `revealed_in` | scalar string (event name) | `revealed_in` | event | optional, set once the secret is no longer secret |

**event** (`EventData`)

| Field | Shape | Edge type | Target kind | Notes |
|---|---|---|---|---|
| `name` | scalar string | — | — | required |
| `description` | scalar string | — | — | prose |
| `where` | scalar string (place name) | `where` | place | direct analog, computed.ts:279 |
| `participants` | array of string (person names) | `participant` | person | simplified from computed.ts:280 (`array_of_objects`/`name`) to plain names |
| `caused_by` | scalar string (faction name) | `caused_by` | faction | new: designed for this spec |
| `related_secret` | scalar string (secret name) | `related_secret` | secret | new: designed for this spec |

`concerns` and `depends_on` on the `secret` kind are the only fields whose target
is not restricted to one `PinKind` — every other edge in the table has a single
fixed target kind, same as `computed.ts`'s `SCAN_RULES`.

### 2. Relation graph and name resolution

Directly reusing the mechanism in `computed.ts`, not the code:

- `resolveByName(name, allPins)`: case-insensitive lookup by `name(pin)` across
  every pin in the World, mirroring `byName` map construction in
  `computeCrossReferenceGraph` (computed.ts :340-344) and `computeEntryLinks`
  (:447-451).
- `computeWorldGraph(world)`: walks every pin's `structured_data` against its
  kind's field-map rows above (the World Forge analog of `SCAN_RULES`), resolves
  each target name, and produces `{ nodes, edges }`. Unresolved targets produce a
  `dangling: true` edge (direct analog of computed.ts :401-405) instead of being
  dropped — a dangling edge is a first-class continuity-desk finding (see
  section 4, deterministic check 1).
- `computeReciprocalPinLinks(pin, world)`: per-pin outgoing/incoming edge view,
  direct analog of `computeEntryLinks` (computed.ts :439-546) — outgoing from the
  pin's own fields, incoming by reverse-scanning every other pin's fields for a
  name match. This is what powers the corkboard's "strings" and the secret's
  dependent-card count.

### 3. The interview spiral

Per the wireframe (`wireframes/magic/world-forge.html`, block WF-2, "The
Interview Spiral"): World Forge grows a world by reusing the Table Read interview
engine's UI-agnostic event stream (question/chips/answer/field-patch/progress —
contract defined in the Table Read bible brief, `docs/06-PRODUCTION-BIBLE.md`
line 76, spec at `specs/features/table-read.md`, not yet written at the time of
this spec) rather than defining a second interview protocol. World Forge adds:

- **Ring expansion.** Each answer that introduces or references a new pin name
  queues a follow-up question ring for that pin (mirrors WF-2: "each answer spawns
  the next ring of questions"). A ring completes when its queued questions are
  answered or skipped; the next ring begins from whatever new names surfaced.
- **The world-tree side panel.** A live projection of pins-by-kind plus a running
  count of drafted lorebook entries and open continuity disputes (WF-2 mock: "14
  lorebook entries drafted, 0 contradictions"). This is a read view over
  `computeWorldGraph` plus the continuity report (section 4), not separate state.
- **"Surprise me, flag it as yours."** A chip option (WF-2 line 70) that lets the
  agent invent an answer; the resulting pin/field carries `provenance:
  "agent-authored"` (as opposed to `"user-authored"`) in `structured_data` or pin
  metadata, so authorship stays auditable. Field-level, not pin-level: a
  user-created pin can still contain one agent-authored field.
- **Stop-anywhere.** There is no "incomplete" state (WF-2 note line 87): the
  interview can be exited after any ring and the World is valid at whatever depth
  it reached. `worldMeta.interviewState` records the last completed ring and
  pending ring queue so a session can resume.

### 4. The continuity desk

Per the wireframe (block WF-3): "a standing audit of everything in the production
that disagrees with everything else," running on save, silent when clean. Split
by dependency, per the ground rule that M1 (`vaud convert/inspect/validate`) works
with zero AI key:

**Deterministic checks (no AI key required, `packages/lore`):**

1. **Dangling reference** — an edge in `computeWorldGraph` resolves to no pin
   (direct use of `dangling: true`, computed.ts :401-405 pattern). Example: a
   person's `current_location` names a place that has no `place` pin.
2. **Orphan pin** — a pin with zero incoming and zero outgoing edges after a full
   graph computation. Not necessarily wrong, but flagged as a prompt ("did you
   mean to connect this?").
3. **Reciprocal-relation asymmetry** — pin A's `relationships` names B, but B's
   `relationships` does not name A back. Computed by diffing `computeWorldGraph`
   outgoing edges of type `relationship` against their reverse.
4. **Structured-field disagreement** — two or more pins assert conflicting values
   for the same structured relation to a third pin, e.g. two `faction` pins both
   list the same `place` in `territory` with no shared-territory flag, or a
   `place`'s `controlled_by` differs from a `faction`'s own claim over that place.
   This check is scoped strictly to `structured_data` fields; it does not read
   free-text `content`/prose. The wireframe's "Lumen Room is dockside in 3 entries
   and uptown in 1" example (WF-3 line 107) is deterministic ONLY if "dockside"/
   "uptown" are captured as a structured field (e.g. `PlaceData.district`, not
   in this spec's field-map above — see OPEN QUESTION); if the fact lives only in
   prose, it is not deterministically detectable and falls to check 5.

**AI-backed checks (`packages/doctor` or `packages/agent`, M2+, needs a
configured key):**

5. **Prose-level / timeline contradiction** — semantic conflicts across pin
   `content` and referenced Character card fields, e.g. Marlow's card claims
   "never met Vesper" while Vesper's `first_mes` implies a shared history (WF-3
   line 106, Dispute 1). Requires reading natural-language content and is
   explicitly out of reach for the deterministic pass; the Doctor/agent layer
   proposes a resolution (the wireframe's "Fix Marlow / Fix Vesper / Make it
   canon" chip set) but the deterministic pass cannot auto-resolve it.

Checks run on every World save (WF-3: "checks run on save, not on a schedule");
results are a `ContinuityReport` with `findings[]`, each carrying kind (from the
list above), severity, the pins involved, and (for AI-backed findings only)
suggested resolutions. Silence (`findings.length === 0`) means clean, matching the
wireframe's stated UX law.

### 5. Export mapping (World -> Lorebook formats)

A World pin's export target is the same codec surface as any `Lorebook`/
`LorebookEntry` (see `specs/formats/rolecall-lorebook.md` and
`specs/formats/st-worldinfo.md`, both unwritten at time of writing but named in
the production bible as the sibling codec specs). Byte-identity level for this
mapping: **semantic** (per escrow-and-roundtrip.md's three-tier definition), since
`structured_data`/`entry_type` are RC-native constructs with no ST equivalent.

| World construct | RoleCall lorebook export | ST world info export |
|---|---|---|
| `World` (Lorebook, `lorebookType: 'world'`) | native: `Lorebook` fields as-is | native where ST has an analog (`name`, budget fields); `lorebookType`/`worldMeta` have no ST home -> escrow under `escrow['st-worldinfo'].fields` per escrow-and-roundtrip.md rule 1 |
| `WorldPin.title` / `content` / trigger fields | native: maps 1:1 onto `LorebookEntry` (same fields ST world info already maps to, per `specs/formats/st-worldinfo.md`) | native: same, ST world info's own field map applies unchanged |
| `metadata.entry_type` (`PinKind`) | native: RC's `metadata` JSONB already carries arbitrary keys (types.ts:320); this is exactly the extension point compendium already uses | escrow: no ST equivalent field -> `escrow['st-worldinfo'].fields['metadata.entry_type']` |
| `metadata.structured_data` (typed payload) | native: same JSONB path | escrow: same as above, whole object escrowed under `structured_data` key |
| `computeWorldGraph` edges | not exported: edges are always *derived* at read time from `structured_data`, never serialized as a separate construct, so there is nothing to round-trip here beyond `structured_data` itself | not exported, same reasoning |
| `ContinuityReport` findings | not exported: ephemeral, recomputed on load; not part of the entity | not exported |

Round-trip consequence: World -> RoleCall-lorebook-format -> World is a full
semantic round-trip (both `entry_type` and `structured_data` are native on that
side). World -> ST-world-info-format -> World also round-trips, but only because
the RC-only fields travel via escrow, not because ST natively understands pins;
serializing World -> ST for a *human ST user* (not round-tripping back) silently
loses the typed pin/relation layer down to plain trigger-and-content entries,
which `vaud convert`'s honest field-loss report (escrow-and-roundtrip.md,
"Reports" section) must surface via `dropped`/`escrowed` counts same as any other
codec.

### 6. Person pin vs. canonical Character entity

The corkboard mock (WF-1) labels a pin "Character / VESPER," and a World Forge
session frequently starts from an existing Character card. A `person` pin is
NOT the same canonical content type as `Character` (canonical-model.md lists them
as separate content types, section "Content types (v1 surface)"). This spec
treats the linkage as a design point, not a merge:

- A `person` pin MAY carry an optional `characterRef: string` (a Character
  entity's `id`) in `structured_data`, populated when the pin was created by
  promoting/importing an existing Character, or when the user explicitly links
  the two.
- Promotion the other direction (pin -> new Character card) is a World Forge
  export action, not an automatic sync. There is no live binding: editing the
  Character does not mutate the pin or vice versa. Keeping them in sync is a
  continuity-desk concern (a future check, not in the deterministic/AI-backed
  lists above — see OPEN QUESTION).

## Public API sketch

```ts
// packages/core/src/world.ts
// World extends the canonical Lorebook (canonical-model.md); no new top-level
// content type is introduced.

export type PinKind = "person" | "place" | "faction" | "secret" | "event";

export type Provenance = "user-authored" | "agent-authored";

export interface PersonData {
  name: string;
  role?: string;
  description?: string;
  relationships?: { with: string; kind: string }[];
  affiliations?: string[];
  current_location?: string;
  knows_secrets?: string[];
  involved_in?: string[];
  characterRef?: string; // optional link to a canonical Character entity id
}

export interface PlaceData {
  name: string;
  description?: string;
  parent_location?: string;
  connected_to?: string[];
  controlled_by?: string;
  notable_events?: string[];
}

export interface FactionData {
  name: string;
  description?: string;
  leader?: string;
  members?: string[];
  allies?: string[];
  enemies?: string[];
  territory?: string[];
  origin_event?: string;
}

export interface SecretData {
  name: string;
  truth: string;
  known_by?: string[];
  concerns?: string[];
  depends_on?: string[];
  revealed_in?: string;
}

export interface EventData {
  name: string;
  description?: string;
  where?: string;
  participants?: string[];
  caused_by?: string;
  related_secret?: string;
}

export type StructuredData =
  | PersonData
  | PlaceData
  | FactionData
  | SecretData
  | EventData;

// A WorldPin is a canonical LorebookEntry whose `metadata` carries the World
// Forge discriminator and payload. No new envelope type — reuses
// Entity<LorebookEntry> from canonical-model.md.
export interface WorldPinMetadata {
  entry_type: PinKind;
  structured_data: StructuredData;
  provenance?: Record<string, Provenance>; // per-field provenance, keyed by structured_data path
}

export interface WorldMeta {
  interviewState?: {
    completedRings: number;
    pendingQuestions: string[]; // question ids queued for the next ring
  };
}

// packages/lore/src/world-graph.ts

export interface GraphNode {
  id: string;
  name: string;
  kind: PinKind;
  crossRefCount: number;
}

export interface GraphEdge {
  from: string;   // pin name
  to: string;     // target pin name
  edgeType: string;
  sourceField: string;
  dangling?: boolean;
}

export function resolveByName(name: string, allPins: WorldPinEntity[]): WorldPinEntity | undefined;

export function computeWorldGraph(pins: WorldPinEntity[]): {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export interface PinLink {
  other: WorldPinEntity;
  edgeType: string;
  direction: "outgoing" | "incoming";
}

export function computeReciprocalPinLinks(
  pin: WorldPinEntity,
  allPins: WorldPinEntity[],
): { outgoing: PinLink[]; incoming: PinLink[] };

// packages/lore/src/continuity.ts

export type ContinuityFindingKind =
  | "dangling-reference"
  | "orphan-pin"
  | "reciprocal-asymmetry"
  | "structured-field-disagreement"
  | "prose-contradiction"; // AI-backed only

export interface ContinuityFinding {
  kind: ContinuityFindingKind;
  severity: "info" | "warning" | "dispute";
  pins: string[]; // pin ids involved
  message: string;
  suggestedResolutions?: string[]; // AI-backed findings only
  requiresKey: boolean;
}

export interface ContinuityReport {
  findings: ContinuityFinding[];
  checkedAt: string; // ISO
}

// Deterministic pass: no provider required.
export function runDeterministicContinuityChecks(
  world: WorldEntity,
): ContinuityFinding[];

// AI-backed pass: requires a configured provider (packages/ai); returns [] with
// a warning if no key is configured, never throws.
export function runAiContinuityChecks(
  world: WorldEntity,
  provider: ChatProvider, // from packages/ai
): Promise<ContinuityFinding[]>;

// packages/interview/src/world-spiral.ts
// Extends the Table Read event stream (specs/features/table-read.md) with
// World Forge-specific ring/spiral state. Event shapes (question/chips/answer/
// field-patch/progress) are inherited unchanged from the Table Read contract.

export interface WorldSpiralSession {
  worldId: string;
  currentRing: number;
  worldTree: { pins: GraphNode[]; edges: GraphEdge[]; draftedEntryCount: number; openDisputeCount: number };
}

export function startWorldSpiral(seed: { pinKind: PinKind; name: string }): WorldSpiralSession;

export function advanceRing(
  session: WorldSpiralSession,
  answers: Array<{ questionId: string; value: string; provenance: Provenance }>,
): WorldSpiralSession;
```

## Edge cases & failure modes

1. **Two pins share the same name, different kind** (e.g. a `place` named
   "The Collectors" and a `faction` also named "The Collectors"). `resolveByName`
   is not kind-scoped for `secret.concerns`/`depends_on` but IS kind-scoped for
   every other edge type (per the field-map tables). Required behavior: kind-scoped
   resolution ties break by exact kind match first; if still ambiguous (rare,
   same-kind duplicate names), `computeWorldGraph` records both matches as
   separate edges and flags an `orphan-pin`-adjacent finding is NOT raised —
   OPEN QUESTION below covers the duplicate-name case itself.
2. **A pin references itself** (e.g. a `faction`'s `allies` lists its own name).
   Required behavior: self-referencing edges are dropped silently during graph
   computation (not surfaced as a finding) — mirrors `computeEntryLinks`'s
   explicit `resolved.id !== entry.id` guard (computed.ts line 485).
3. **A `secret`'s `concerns` or `depends_on` names a pin that is later deleted.**
   Required behavior: becomes a `dangling-reference` finding on next continuity
   check, same as any other edge; the secret is not auto-edited.
4. **User answers a question with a brand-new name not matching any existing
   pin.** Required behavior: interview spiral drafts a new pin of the appropriate
   kind at "stub" completeness (`name` only, kind inferred from the edge's target
   kind in the field-map table) and queues it into the next ring.
5. **User picks "Surprise me, flag it as yours" on a field that already has a
   user-authored value.** Required behavior: agent proposes a replacement as a
   staged edit (per the agent-loop staged-edit envelope, 02-ARCHITECTURE.md
   "The agent"), never overwrites directly; provenance updates only on commit.
6. **World has zero pins (fresh Forge session).** Required behavior:
   `computeWorldGraph` and continuity checks both return empty results without
   error; not an error state (matches "stop anywhere" philosophy, applied to the
   zero end too).
7. **Continuity check runs while an interview ring is mid-flight (pin exists as a
   stub, missing required fields).** Required behavior: a stub pin (case 4) is
   exempt from `orphan-pin` and `dangling-reference` findings about ITS OWN
   incomplete fields until the ring that created it completes; it can still be the
   unresolved TARGET of another pin's edge, which does raise `dangling-reference`
   normally.
8. **Export to a foreign non-lorebook format** (e.g. a `person` pin exported
   directly as a `chara_card_v2` Character). Required behavior: out of scope for
   this spec's export mapping (section 5 only covers Lorebook-family targets);
   promotion to a Character entity (section 6) is a distinct, explicit user
   action that goes through the Character codecs' own capabilities matrix, not
   this spec's field-map table.
9. **AI-backed continuity check requested with no provider key configured.**
   Required behavior: `runAiContinuityChecks` returns `[]` and the caller (CLI or
   agent loop) surfaces a plain-language notice that deep contradiction checks
   are unavailable without a key; deterministic findings are unaffected and still
   reported (M1 "works with zero AI key" invariant, 00-MASTER-PLAN.md line 40).

## Test plan

- Fixtures required (new corpus under `fixtures/world-forge/`):
  - `minimal-world/` — one `person`, one `place`, one `relationship` edge and one
    `current_location` edge; exercises the base field-map and `computeWorldGraph`
    happy path.
  - `five-kinds/` — one pin of each of the 5 kinds with every field-map row
    populated at least once; exercises full edge-type coverage and the
    `structured_data` -> `LorebookEntry.metadata` mapping end to end.
  - `dangling-reference/` — a `person.current_location` naming a place that does
    not exist; exercises deterministic check 1.
  - `reciprocal-asymmetry/` — pin A names B in `relationships`, B does not name A
    back; exercises deterministic check 3.
  - `structured-disagreement/` — two `faction` pins both list the same `place` in
    `territory` without a shared-territory marker; exercises deterministic check 4.
  - `secret-dependents/` — one `secret` pin named by three other pins'
    `depends_on`; exercises the "3 cards depend on this" incoming-edge count via
    `computeReciprocalPinLinks`.
  - `self-reference/` — a `faction` pin listing itself in `allies`; exercises edge
    case 2 (silent drop, no finding).
  - `stub-pin-mid-ring/` — a `person` pin created via edge case 4 with only
    `name` set; exercises edge case 7 (exemption from self-incompleteness
    findings, non-exemption as a target).
- Round-Trip Law applicability: World -> RoleCall-lorebook-format -> World is
  `semantic` level per section 5; requires the same fixture-driven round-trip
  harness as any other codec (escrow-and-roundtrip.md), scoped to
  `fixtures/world-forge/**` once `specs/formats/rolecall-lorebook.md` ships its
  own serializer. World -> ST-world-info-format -> World is also `semantic`
  level, exercised once `specs/formats/st-worldinfo.md` ships.
- Property/unit tests beyond fixtures:
  - `resolveByName` case-insensitivity and kind-scoping (edge case 1) as a
    property test over generated pin sets with controlled name collisions.
  - `computeWorldGraph` never includes a self-edge (edge case 2), as a property
    test (`forEach edge: edge.from !== edge.to` after name resolution).
  - `runDeterministicContinuityChecks` is idempotent and pure: same World input
    twice yields identical `findings` (order-independent set comparison).
  - `runAiContinuityChecks` with a stub/mock provider returning canned
    contradiction text, to test the finding-shape mapping without a live key
    (deterministic test law, 03-CONVENTIONS.md line 31).

## Non-goals

- The World Forge pin taxonomy is fixed at 5 kinds (person/place/faction/secret/
  event) per the production bible brief. It deliberately does NOT cover
  VAUDEVILLE compendium's fuller 11-type taxonomy (item, plot, threat,
  worldbuilding, summary, creature, power) or its calendar/renown/quest dossier
  systems (`apps/rc/src/components/compendium/dossiers/*`). Those remain
  RoleCall-specific product surfaces; a later spec may propose widening the
  taxonomy, but that is out of scope here.
- No calendar, renown/reputation, or quest-dependency systems (VAUDEVILLE
  `dossiers/calendar`, `dossiers/renown`, `dossiers/quests`) are ported. World
  Forge is the pin + relation + continuity layer only.
- No automatic two-way sync between a `person` pin and a linked Character entity
  (section 6). Promotion/linking is explicit and one-directional per action.
- The AI-backed continuity checks (section 4, item 5) do not auto-resolve
  disputes; they only propose resolutions for the user/agent staged-edit flow to
  act on.
- This spec does not define the CLI command grammar for World Forge
  (`vaud world ...` or similar); that belongs in a `specs/features/cli-*.md`-style
  spec once M7 CLI surface is planned, per 03-CONVENTIONS.md CLI section and the
  master-plan rule that every feature exists in the CLI before the app.
- This spec does not define the app-face (Studio) corkboard rendering (WF-1);
  that is a Studio (M6+) UI concern layered over `computeWorldGraph`, not part of
  the engine behavior specified here.

## Sources consulted

- `docs/00-MASTER-PLAN.md` (line 40:
  "v0.1: The Converter: works with zero AI key"; line 59-60: M7 milestone
  description)
- `docs/02-ARCHITECTURE.md` (lines
  8-33: package layout, `packages/lore`, `packages/interview`; lines 54-69: agent
  loop staged-edit envelope)
- `docs/06-PRODUCTION-BIBLE.md` (line
  80: world-forge.md brief — pin taxonomy, interview spiral, export mapping,
  continuity desk; line 76: table-read.md brief — event stream contract)
- `specs/formats/canonical-model.md`
  (lines 7-11: content types, "World/compendium arrives with M7 and extends
  Lorebook rather than replacing it"; lines 52-58: Lorebook/LorebookEntry
  baseline adoption instruction)
- `specs/formats/escrow-and-roundtrip.md`
  (full file: Round-Trip Law, escrow envelope rules 1-5, byte-identity tiers,
  Reports section)
- `docs/03-CONVENTIONS.md` (line 31:
  deterministic-tests-only law; CLI conventions section)
- `wireframes/magic/world-forge.html`
  (WF-1 "The Corkboard" lines 27-52; WF-2 "The Interview Spiral" lines 54-90;
  WF-3 "The Continuity Desk" lines 92-112)
- `<RoleCall>/apps/rc/src/lib/compendium/computed.ts`
  (structuredOf/typeOf/nameOf helpers :17-38; SCAN_RULES table :241-318;
  computeCrossReferenceGraph :335-416; computeEntryLinks :439-546) — reused for
  the relation-scan MECHANISM only, not the 11-type catalog (see Non-goals)
- `<RoleCall>/packages/lorebook/src/types.ts`
  (`LorebookEntry` :216-331, `metadata` field :320; `Lorebook` :342-393)

## OPEN QUESTIONS

- OPEN QUESTION: should `PersonData.affiliations` carry a per-affiliation role
  string (as VAUDEVILLE's `computed.ts` :244 does via `array_of_objects`/`org`),
  or stay plain names as drafted here? Left as plain names in this spec for
  taxonomy simplicity; revisit once the interview spiral's actual question
  patterns are prototyped.
- OPEN QUESTION: is `PlaceData.district` (or similar structured field) needed to
  make the wireframe's "Lumen Room is dockside vs uptown" example (WF-3 line 107)
  actually deterministic, or is that dispute meant to stay AI-backed? This spec's
  field-map table does not include a `district`/region field; adding one is a
  scope decision for the ticket that implements deterministic check 4.
- OPEN QUESTION: should a `person` pin linked to a Character entity
  (`characterRef`, section 6) get its own continuity check that flags drift
  between the pin's `structured_data` and the linked Character's fields (e.g.
  `PersonData.description` vs. `Character.description`)? Not included in the
  deterministic or AI-backed check lists in section 4; left for a follow-up spec
  once Character<->World linkage usage is observed.
- OPEN QUESTION: exact behavior when two pins of the SAME kind share the exact
  same name (edge case 1's "still ambiguous" branch) — this spec states edges are
  recorded against both matches but does not define a first-class "duplicate
  name" continuity finding. Should one be added to the deterministic check list?
- OPEN QUESTION: `packages/core` vs `packages/lore` package boundary for the
  `WorldPinMetadata`/`StructuredData` type definitions themselves (as opposed to
  the graph/continuity functions, which this spec places in `packages/lore`
  following `computed.ts`'s import of `@/lib/lorebook/types`). This spec places
  the types in `packages/core` alongside `Lorebook`/`LorebookEntry` since they
  are data-shape-only with no logic, consistent with core's "zero deps on other
  packages" rule (02-ARCHITECTURE.md line 8), but this has not been confirmed
  against an actual M7 ticket breakdown.
