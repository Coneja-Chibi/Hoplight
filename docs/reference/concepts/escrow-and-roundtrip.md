---
id: reference/concepts/escrow-and-roundtrip
title: Escrow and round-trip
audience: dev
summary: How the escrow envelope, the canonical original field, makes a same-format round-trip lossless and keeps a cross-format conversion to contained loss by design.
tags: [concept, escrow, round-trip, lossless, canonical, original]
related: [reference/architecture, reference/entities/character, reference/entities/lorebook, reference/formats/sillytavern]
---

# Escrow and round-trip

Every canonical entity carries a lossless copy of what it was imported from. The architecture calls this
concept **escrow**; the wrapper field that holds it is named `original` (`canonical.ts:80`). That one
carry buys two guarantees at once: a **same-format round-trip loses nothing**, and a **cross-format
conversion loses only what will not cross, on purpose**. This page explains the field, the round-trip
mechanism, and why cross-format containment is a safety guarantee rather than a gap. For where escrow sits
in the whole engine, see [../architecture.md](../architecture.md).

@fig roundtrip

## The escrow envelope

Escrow is a per-source record on the canonical wrapper, `Record<FormatId, OriginalEntry>`, keyed by the id
of the format it came from (`canonical.ts:39-51`):

```ts
interface OriginalEntry {
  raw: unknown;                                  // the source payload, verbatim
  unmapped?: Record<string, unknown>;            // fields canonical does not (yet) express
  sourceMedia?: { b64: string; mime: string };   // the binary carrier the payload arrived inside
}
type Original = Record<FormatId, OriginalEntry>; // one entry per source format id
```

- `raw` is the entire parsed source payload, stored untouched. It is the twin the exporter re-projects onto.
- `unmapped` holds source facts the canonical model does not first-class as its own field, for example the
  round-trip variant a Tavern card was read as (`v1` / `flat` / `v2` / `v3`).
- `sourceMedia` is the binary **carrier** the payload arrived inside, not content the canonical body
  expresses. A PNG character card's pixels are authored art, so the carrier is kept as a raw-bytes twin
  (`canonical.ts:44-47`).

The `original` field is filled automatically on import and is never hand-edited (`canonical.ts:50`). Each
adapter stores its twin under its own format id, so a SillyTavern card's twin lives at
`original.sillytavern` and an adapter only ever reads its own key. `primaryOriginalRaw(original)` is the one
owner for "which entry is the source", reading the first entry's `raw` so the labeler and the bundle layer
cannot drift on it (`canonical.ts:58-59`).

A field earns a first-class canonical slot only if some real wire format serializes it; anything no format
produces does not become a canonical field and at most rides in escrow (`architecture.md`, "The superset
rule"). Escrow is where that residue lives.

## A same-format round-trip loses nothing

The adapter contract is symmetric around escrow: `toCanonical` stashes the original payload while it reads,
and `fromCanonical` re-emits from that original for the round-trip (`adapter.ts:65-68`). SillyTavern's
character codec is the worked example: on import it stores the whole parsed card as the twin, plus the
variant and any PNG carrier (`index.ts:105-108`); on export it overlays the canonical body onto a clone of
the twin and re-wraps it in the original variant (`index.ts:112-148`).

The overlay is three-state against the twin's own decode (`applyBodyToData`, `tavern-fields.ts:146-156`):

1. a canonical value equal to the twin leaves the raw bytes untouched;
2. a changed value is written at its exact wire home;
3. a value the twin had but canonical no longer carries is cleared at that same home.

When both the decoded twin and canonical are absent, raw is left alone, which protects values the reader
deliberately cannot represent (for example RoleCall's object-form `source`) and any unknown keys
(`tavern-fields.ts:150-156`).

That is the precise sense of lossless: **every field, including ones the canonical model does not express,
survives unchanged straight from the twin, and only edited fields re-encode** (`architecture.md`, "Escrow:
lossless round-trips, contained cross-format loss"). The scope is fields and content, not the container.
The character writer emits pretty-printed JSON (`index.ts:147`), so a JSON source re-serializes rather
than returning byte-identical file bytes, and a PNG
source reads to JSON with its pixels held in escrow as `sourceMedia`, served as the entity's portrait and
restorable by a future same-format re-emit (`canonical.ts:44-47`). The guarantee is that no authored field
is silently dropped or fabricated, not that an untouched file is returned bit-for-bit through a container
change.

## A cross-format conversion is contained loss by design

`convertFile` narrows on `kind` and, for a same-kind conversion, passes the target adapter the full entity
(`convert.ts:96-115`), but only the canonical body plus any re-embedded lorebooks get projected into the
target file. The mechanism is the per-id keying: the entity still carries the source twin under
`original.<source>`, and that twin rides along in memory, but the target adapter reads only
`original.<target>`, finds no twin there for a fresh conversion, and full-encodes from the body alone. One
app's private junk (its `extensions` block, trigger scripts, bespoke layout, internal ids), the raw twin,
`unmapped`, and the carrier all stay in escrow and are deliberately not written into another app's file.

This is a safety posture, not a limitation. vaud never blind-copies one app's fields or executable payloads
into another; it denies by absence (`architecture.md`, "Escrow: lossless round-trips, contained cross-format
loss"). The future refinement is opt-in, per-field extension mappers, never a blind copy. Because the
canonical body is a superset of what real formats actually serialize, what does cross a conversion is the
portable core, and the loss is bounded to each app's non-portable extras.

The carrier follows the same rule: on a cross-format write the PNG pixels stay in escrow and are not
smuggled into the target file, but they remain the entity's portrait and can be restored on a same-format
re-emit (`canonical.ts:44-47`).

## Per-kind coverage of the same idea

Every entity kind carries escrow the same way, and each format's own page documents where its round-trip is
lossless and where a cross-format write collapses. The SillyTavern page details the character and lorebook
twins, the injection-slot collapse on a cross-format lorebook write, and the persona and regex codecs that
seal a whole multi-record file in escrow so every untouched record re-emits unchanged
([../formats/sillytavern.md](../formats/sillytavern.md), "Escrow and round-trip"). For what each canonical
slot means, see [../entities/character.md](../entities/character.md) and
[../entities/lorebook.md](../entities/lorebook.md).

## Source of truth

| Concern | File |
| --- | --- |
| Escrow envelope (`original`, `OriginalEntry`, `primaryOriginalRaw`) | `src/core/canonical.ts` |
| Adapter round-trip contract (`toCanonical` stash, `fromCanonical` re-emit) | `src/core/adapter.ts` |
| Cross-format conversion (only the body crosses) | `src/convert.ts` |
| Three-state overlay onto the twin (worked example) | `src/formats/_shared/tavern-fields.ts` |
| A codec that stores and re-emits its twin | `src/formats/sillytavern/index.ts` |
| Escrow in the whole-engine map | `docs/reference/architecture.md` |
