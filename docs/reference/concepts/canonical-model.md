---
id: reference/concepts/canonical-model
title: The canonical superset model
audience: dev
summary: The one hub every format converts through, a versioned entity wrapper whose body is the union of what real formats express, governed by the superset rule that a field earns a canonical slot only when a real wire format serializes it.
tags: [concept, canonical, superset, escrow, profiles]
related: [reference/architecture, reference/entities/character, reference/entities/lorebook, reference/formats/sillytavern, reference/concepts/character-book]
---

# The canonical superset model

Every format converts through one canonical superset model, never format to format directly
(`architecture.md`, "The one idea: hub and spoke"). This page is the model itself: the wrapper every
entity shares, and the one rule that decides what its `body` may contain, the superset rule. For the whole
engine (hub-and-spoke, adapters, detection, escrow mechanics), see [architecture.md](../architecture.md).
For a specific kind's body shape and how it applies this rule, see the entity pages, starting with
[entities/character.md](../entities/character.md) and [entities/lorebook.md](../entities/lorebook.md).

The model is defined in `src/core/canonical.ts`. The comment at the top names the split this page turns on:
the STRUCTURE (wrapper, `original`, per-app profiles, format ids) is the stable spine; the per-kind field
details live in `src/entities/<kind>/schema.ts` (`canonical.ts:1-5`).

## The wrapper

`CanonicalEntity<Kind, Body>` is the stable shape every entity shares, whatever its kind (`canonical.ts:70-81`):

| Field | Type | What it is |
| --- | --- | --- |
| `schemaVersion` | `"1"` | The single canonical version, `CANONICAL_SCHEMA_VERSION` (`canonical.ts:13,71`). |
| `kind` | closed union | The entity kind: `character`, `lorebook`, `persona`, or `regex` today (`canonical.ts:70,72`). |
| `id` | `string` | A stable storage-safe slug minted from the name by one owner, `canonicalId` (`canonical.ts:23-36,73-74`). |
| `body` | `Body` | The content in the superset shape. The superset rule governs what lives here (`canonical.ts:75-76`). |
| `profiles?` | `Record<FormatId, Partial<Body>>` | Sparse per-app overrides: author once, set only what differs (`canonical.ts:61-67,78`). |
| `original?` | `Record<FormatId, OriginalEntry>` | The escrow envelope: lossless carry of source-format specifics (`canonical.ts:38-51,80`). |

`FormatId` is an open string on purpose: a drop-in adapter folder can claim any id, and the core never
hardcodes the set of formats (`canonical.ts:8-11`). `id` is not that: `canonicalId` normalizes the name to
NFKC, lowercases, collapses non-letter/number runs to single hyphens, caps length, and falls back to
`"character"` when empty, so every adapter mints ids the same way and the result always passes the studio's
path policy (`canonical.ts:23-36`).

`kind` is a small closed union. Four kinds are adapter-backed today, the four members of `FormatAdapter`
(`adapter.ts:62-106`); two more canonical schemas, `preset` and `pack`, are defined under `src/entities/`
without an adapter yet (`architecture.md`, "The canonical entity"). Formats are open, entity kinds are
closed: a kind grows only by adding a union member here plus a sibling `entities/<kind>/` folder, which is
the trade that buys compile-time safety across the engine (`adapter.ts:99-106`).

## The superset rule

The `body` is a superset: the union of what all real formats express, not any one format's shape
(`architecture.md`, "The superset rule"). One rule decides what earns a place in it.

**A field earns a first-class canonical slot only if some real wire format serializes it** (`lorebook/schema.ts:15`).
Put the other way: only fields a real, currently-supported format actually produces are first-classed;
everything else rides in `original` (`character/schema.ts:5-7`). The rule has two edges, and both are
load-bearing.

@fig gate

**Not serialized means no slot.** Two things fail this edge and stay out of the body:

- Platform and database baggage. Creator, stats, publishing status, fork lineage, versioning, timestamps,
  token counts, and per-session runtime state are not portable format content, so they ride `original` or
  the entity wrapper, never the body, exactly as the character body strips its own DB fields
  (`lorebook/schema.ts:9-12`).
- In-memory-only residue. Fields a running app holds but no serializer ever writes stay out. In the
  lorebook body the concrete set is RoleCall's `allowRecursion`, `boostIds`, `boostAmount`, `scanPreset`,
  and `probabilityMode`, verified absent from both the RoleCall and the SillyTavern serializers, so they
  ride `original` (`lorebook/schema.ts:15-18`). First-classing a field nothing serializes is dead surface.

**Single-platform is not a reason to relegate.** The gate is "does any real wire format serialize it",
not "do many". An authored field that even one format serializes earns a slot, because the schema is the
editor and an editable slot must map to something a format can carry (`lorebook/schema.ts:19-20`). The
lorebook body first-classes several fields only SillyTavern produces on exactly this ground: its extra scan
sources (`matchCharacterDepthPrompt`, `matchCreatorNotes`), the `vectorized` / group-override /
group-scoring toggles, the automation binding, and the distinct `displayIndex` axis, because each is a wire
field a creator sets, not runtime residue (`lorebook/schema.ts:19-23`).

The distinction the rule polices is authored-and-serialized versus derived-or-runtime. A field a creator
sets and a format writes to disk is content; a field an app computes or holds only in memory is not, no
matter how many apps hold it. The character schema states the same gate for its own body: seeded from the
real formats, widened by the format deep-dive, and first-classing only what a real now-tier format produces
(`character/schema.ts:4-7`).

## Escrow: what the rule leaves out

A field failing the superset rule is not dropped, it is contained. Everything the body does not express
rides the escrow envelope, the wrapper's `original` field, a `Record<FormatId, OriginalEntry>` keyed by
source format (`canonical.ts:38-51`). Each `OriginalEntry` carries the source payload verbatim (`raw`), the
fields canonical did not express (`unmapped`), and, for a binary source, the carrier it arrived inside
(`sourceMedia`), for example a PNG card's authored pixels (`canonical.ts:39-48`). This is what makes a
same-format round-trip byte-lossless and a cross-format conversion contained-loss by design; the full
mechanics are in [architecture.md](../architecture.md) ("Escrow: lossless round-trips, contained
cross-format loss"). The superset rule and escrow are the two halves of one promise: the body stays a clean
portable union, and nothing outside it is lost.

## Profiles: one superset, many apps

The single superset body still lets one entity differ per app without duplication. `profiles` is a sparse
map of per-app deltas, `Record<FormatId, Partial<Body>>`, empty by default (`canonical.ts:61-67`). You
author the entity once and set only the fields you want to differ for a given app; a per-app version is the
canonical body plus that app's overrides, projected by its adapter, never a full duplicate record
(`canonical.ts:61-66`). Because both `profiles` and `original` are keyed by `FormatId`, the same open
format-id space threads the whole wrapper: what an app overrides, and what it left in escrow.

## Source of truth

| Concern | File |
| --- | --- |
| Canonical wrapper, schema version, id policy | `src/core/canonical.ts` |
| Escrow envelope (`original`, `OriginalEntry`) | `src/core/canonical.ts` |
| Per-app profiles | `src/core/canonical.ts` |
| Entity-kind union (the closed set) | `src/core/adapter.ts` |
| Superset rule, character body | `src/entities/character/schema.ts` |
| Superset rule, lorebook body (worked example) | `src/entities/lorebook/schema.ts` |
| Whole-engine context (hub-and-spoke, escrow, detection) | `docs/reference/architecture.md` |
