---
id: reference/extending/add-a-format
title: Add a format adapter
audience: dev
summary: How to add a new hoplight format adapter, copy the template folder, implement detect, toCanonical, and fromCanonical, declare coverage, and the loader picks it up with no core edits.
tags: [extending, format, adapter, contribution, folders-as-schema]
related: [reference/architecture, reference/concepts/canonical-model, reference/entities/character, reference/formats/pygmalion]
---

# Add a format adapter

Every format converts through one canonical superset model, never format to format directly; adding
a format is one adapter, and it touches no other format and no core code
(`architecture.md`, "The one idea: hub and spoke"). This page is that one adapter's build steps.
For the whole engine, canonical model, escrow, and detection, see
[architecture.md](../architecture.md). For what a canonical character field means, see
[entities/character.md](../entities/character.md). For a real, filled-in example smaller than any
deep-dive on this page, see [formats/pygmalion.md](../formats/pygmalion.md).

A format **is** a folder under `src/formats/<name>/`. Nothing central lists formats: the loader
scans the filesystem, and a folder whose name starts with `_` (`_template`, `_shared`) is skipped
(`loader.ts:8,26`). A folder's `index.ts` default-exports one adapter, or an array of adapters when
one format family ships more than one codec, for example SillyTavern exporting both its character
and lorebook codecs (`loader.ts:6-9,27-34`; `architecture.md`, "Folders-as-schema").

@fig steps

## The contract

`src/core/adapter.ts` defines what every format plugin implements. Fields every adapter carries,
whatever kind it reads and writes (`adapter.ts:38-60`):

```ts
interface AdapterBase {
  id: FormatId;                        // also the escrow key: entity.original[id]
  label: string;
  outputExtensions: string[];          // extensions this adapter writes, no dot
  detect(input: AdapterInput): number; // 0..1 confidence it can read this input
  native?: boolean;                    // hoplight's own storage format; never a "publish to" platform
  generic?: boolean;                   // the plain reader of a family; UI shows "Default", not a platform
  coverage?: CoverageDecl;             // canonical body paths this wire actually carries, see below
  lens?: boolean;                      // false hides this format from the editor's platform strip
}
```

A `CharacterAdapter` (`adapter.ts:63-76`), the kind `_template` ships as:

```ts
interface CharacterAdapter extends AdapterBase {
  kind: "character";
  toCanonical(input: AdapterInput): CanonicalCharacter;
  fromCanonical(entity: CanonicalCharacter, context?: EmitContext): AdapterOutput;
  extractLorebook?(entity: CanonicalCharacter): CanonicalLorebook | null; // optional, see below
}
```

`LorebookAdapter`, `PersonaAdapter`, and `RegexAdapter` follow the identical shape for `kind:
"lorebook"`, `"persona"`, `"regex"`, with `toCanonical`/`fromCanonical` typed to
`CanonicalLorebook`, `CanonicalPersona`, `CanonicalRegexSet` in place of `CanonicalCharacter`
(`adapter.ts:79-97`). `FormatAdapter` is the union of the four, discriminated on `kind`
(`adapter.ts:106`); pick the kind before you copy the template.

Input and output are plain data, not a stream or a handle (`adapter.ts:9-20`):

```ts
interface AdapterInput { bytes?: Uint8Array; text?: string; filename?: string; }
interface AdapterOutput { bytes?: Uint8Array; text?: string; suggestedExtension: string; }
```

A binary format (PNG, ZIP) reads `bytes`; a text or JSON format reads `text`. `fromCanonical`
returns whichever it writes, plus `suggestedExtension`, normally one of the adapter's own
`outputExtensions`.

## Steps

1. **Copy the template.** `cp -r src/formats/_template src/formats/<name>` (`_template/index.ts:4`).
   `<name>` becomes the folder name, the adapter's `id`, and the key its escrow twin is stored
   under, `original.<name>` (`canonical.ts:38-51`). Pick `kind` on the adapter object,
   `"character"` by default in the template (`_template/index.ts:15`).

2. **Implement `detect(input)`.** Return `0..1`. The registry runs every adapter's `detect()` and
   keeps the single highest score at or above `0.5` (`registry.ts:9-10,29-40`), so more specific
   formats must outrank generic ones on the same bytes, not merely return `1`. A format that can
   share wire shape with another, a bare JSON object, a PNG `chara` chunk, should reject the other
   format's known markers first and only then look for its own positive signal, the way Pygmalion
   rejects CCv2/v3, vaud-json, Agnai, and Backyard shapes before checking its own keys
   (`pygmalion/index.ts:24-39`). A parse failure or the wrong input shape returns `0`, never throws.

3. **Implement `toCanonical(input)`.** Read the file into the matching canonical shape and mint the
   entity's `id` with `canonicalId(name)`, the one owner for that policy so every adapter mints ids
   the same way (`canonical.ts:23-36`). Stash the parsed source verbatim at `original.<name>.raw` so
   the round-trip stays lossless; a PNG carrier's pixels go in `original.<name>.sourceMedia`
   (`adapter.ts:65-66`, `canonical.ts:38-51`, `pygmalion/index.ts:141-147`). Only map a field into
   the canonical `body` when some real wire format actually serializes it, the superset rule;
   anything else stays in `original` rather than inventing a canonical slot for it
   ([concepts/canonical-model.md](../concepts/canonical-model.md), "The superset rule").

4. **Implement `fromCanonical(entity, context?)`.** Clone the stashed twin when one exists, overlay
   the current (possibly edited) canonical body onto the clone, and fall back to a bare minimal
   object when there is no twin, for example a cross-format import with nothing to overlay onto
   (`pygmalion/index.ts:92-100,150-169`). A character adapter reading an embedded lorebook in a
   dialect the shared CCv2/v3 extractor does not cover implements the optional
   `extractLorebook(entity)`, returning `null` when the card carries none (`adapter.ts:69-76`); a
   character adapter re-embedding a linked lorebook on export reads it off `context.lorebooks`
   (`adapter.ts:22-35`).

5. **Declare coverage.** See [Declaring coverage](#declaring-coverage) below.

6. **Done. No core edits.** `loadFormats()` globs `src/formats/*/index.ts`, dynamically imports
   each match, and calls `register()` on whatever it default-exports, one adapter or an array of
   them (`loader.ts:20-37`). Nothing outside the new folder changes. `bun run hoplight formats` lists
   the new adapter immediately (`cli.ts:146-166`), and its own help text says the same thing this
   page does: "Drop a folder into src/formats/ to add one (copy src/formats/_template)."
   (`cli.ts:172-173`). `bun run matrix` regenerates [FORMAT-SUPPORT.md](../../FORMAT-SUPPORT.md)
   with its row, and `matrix:check` fails CI if that file is stale (`format-matrix.ts:1-5,93-115`).

## Declaring coverage

`src/core/coverage.ts` is what makes the editor's per-platform lens honest: the editor knows zero
platforms, so each format folder declares which canonical body paths its own wire actually reads
and re-emits, and every lens state is computed from that claim (`coverage.ts:1-9`).

```ts
interface CoverageDecl {
  carries: string[];              // canonical body path prefixes this format reads AND re-emits
  notes?: Record<string, string>; // honest per-path remarks, surfaced as lens tooltips
}
```

A path prefix matches on dot boundaries only: `"greetings"` covers `"greetings.firstMessage"` but
never `"greetingsX"` (`coverage.ts:5-6,27-32`). Add `src/formats/<name>/coverage.ts` default-exporting
a `CoverageDecl`, and set `coverage` on the adapter object. Pygmalion's is the whole pattern
(`pygmalion/coverage.ts:7-25`):

```ts
const coverage: CoverageDecl = {
  carries: [
    "identity.name", "persona.personality", "persona.scenario",
    "greetings.firstMessage", "examples.exampleMessages",
    "identity.description", "media.portrait",
  ],
  notes: {
    "persona.personality": "wire char_persona (the one persona blob)",
    "identity.description": "mirrors char_persona on import for shared UI; re-export prefers personality",
  },
};
```

An absent `coverage` is not an error: the lens shows the platform tab marked as not declared and
dims nothing for it, deny-by-absence stays honest either way (`adapter.ts:51-54`). In this codebase
every non-native character adapter declares coverage (agnai, backyard, lumiverse, pygmalion, risu,
rolecall, sillytavern); the lorebook, persona, and regex codecs, and the native `vaud-json`
passthrough, which already carries the canonical body verbatim, do not. Coverage also feeds the
export dialog's honesty lines, what a target platform will keep or drop for a given card, so an
undeclared coverage understates that dialog for your format too.

## Testing

A format's tests live beside it, `src/formats/<name>/<name>.test.ts`, run under `bun:test`. The
Pygmalion suite is the shape to copy: `isPygmalionCard` accepts the real shape and rejects every
sibling format's shape, `detect()` scores your format `1` (or higher-tiered) and every sibling `0`
on your own fixture, `toCanonical` maps every field, a same-format round-trip with no edits is
byte-identical, an edit reaches the wire, and a cross-format conversion to one other format keeps
the core text (`pygmalion.test.ts:1-108`). `bun run test` runs the whole suite, including
`src/formats` (`package.json:14`); scope a single format with `bun test src/formats/<name>`. A
lorebook-kind format additionally earns a round-trip fixture under `samples/lorebooks/<name>/`, a
real input file plus its expected canonical parse, alongside the other lorebook formats already
there.

## Non-negotiables

- **No core edits.** Adding a format changes only its own folder. If a change to `src/core/` or
  another format's folder looks necessary, the new format is not actually a drop-in and the design
  needs to change, not the core.
- **The cross-kind firewall holds.** A character detector must never claim a lorebook's bytes or
  vice versa; both kinds share one registry (`architecture.md`, "Detection and the registry").
- **Escrow, not a blind copy.** Only the canonical body crosses a cross-format conversion; a
  format's own extensions, scripts, and internal ids stay in its own escrow key and are never
  copied into another format's file ([concepts/escrow-and-roundtrip.md](../concepts/escrow-and-roundtrip.md)).
- **The underscore prefix means inert.** Use it only to keep a folder out of discovery, shared
  helpers (`_shared`), fixtures (`_fixtures`), or the template itself, never to half-ship a real
  format.

## Source of truth

| Concern | File |
| --- | --- |
| Starting point to copy | `src/formats/_template/index.ts` |
| Adapter contract, entity kinds, `AdapterInput`/`AdapterOutput`/`EmitContext` | `src/core/adapter.ts` |
| Loader (folders-as-schema, auto-discovery) | `src/core/loader.ts` |
| Registry (detection, the `0.5` threshold, lookup) | `src/core/registry.ts` |
| Coverage contract | `src/core/coverage.ts` |
| Canonical wrapper, escrow (`original`), id policy (`canonicalId`) | `src/core/canonical.ts` |
| Smallest real worked example (one file, five fields) | `src/formats/pygmalion/index.ts`, `src/formats/pygmalion/coverage.ts` |
| Test shape to copy | `src/formats/pygmalion/pygmalion.test.ts` |
| Matrix generator (`bun run matrix`, `matrix:check`) | `scripts/format-matrix.ts` |
| `hoplight formats` CLI command | `src/cli.ts` |
| Whole-engine context (hub-and-spoke, escrow, detection) | `docs/reference/architecture.md` |
