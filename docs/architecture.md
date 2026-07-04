# Architecture

vaud converts AI-roleplay content between formats without losing information. This page explains the
whole engine: how a file becomes a canonical entity and back, and why the design guarantees are what
they are.

## The one idea: hub and spoke

Every format converts through **one canonical superset model**, never format-to-format directly.

```
SillyTavern  ─┐                        ┌─ SillyTavern
RoleCall     ─┤                        ├─ RoleCall
Risu         ─┼──►  canonical entity  ─┼─ Risu
Backyard     ─┤     (the hub)          ├─ Backyard
Agnai        ─┘                        └─ Agnai
```

With `N` formats, a mesh of direct converters would need `N x (N-1)` of them. Hub-and-spoke needs `N`
adapters: each maps its format to and from the canonical model. **Adding a format is +1 adapter, and it
touches no other format and no core code.**

- `import` = read a file into the canonical model (`toCanonical`).
- `export` = write a canonical entity out to a format (`fromCanonical`).
- A conversion is just `import` then `export`.

## The canonical entity

`src/core/canonical.ts` defines the stable wrapper every entity shares:

```ts
interface CanonicalEntity<Kind, Body> {
  schemaVersion: "1";
  kind: Kind;          // "character" | "lorebook"
  id: string;          // stable slug derived from the name
  body: Body;          // the actual content, in the superset shape
  profiles?: ...;      // sparse per-app overrides (author once, differ per app)
  escrow?: ...;        // lossless carry of source-format specifics
}
```

Two kinds exist today: `CanonicalCharacter` and `CanonicalLorebook`. Their `Body` shapes are documented
in [entities/character.md](entities/character.md) and [entities/lorebook.md](entities/lorebook.md).

### The superset rule

The canonical body is a **superset**: the union of what all real formats express. A field earns a
first-class canonical slot **only if some real wire format actually serializes it**. If no format
produces a field, it does not become a canonical field; at most it rides in escrow. This is why the
lorebook schema, for example, drops five RoleCall in-memory-only fields to escrow (see
[entities/lorebook.md](entities/lorebook.md)) rather than pretending they are portable.

## Escrow: lossless round-trips, contained cross-format loss

Each entity carries an **escrow envelope** keyed by source format:

```ts
escrow["sillytavern"] = { raw: <the original card verbatim>, unmapped: { ... } }
```

- **Same-format round-trip is lossless.** Export re-projects the canonical body onto a clone of the
  escrowed `raw`, so any field the canonical model does not express (app-specific extensions, scripts,
  layout, ids) survives byte-for-byte. Edited fields re-encode; untouched fields come straight from the
  twin.
- **Cross-format conversion is contained-loss by design.** Only the canonical body crosses. One app's
  private junk (its extension blocks, trigger scripts, bespoke layout) is deliberately **not** copied
  into another app's file. This is a safety guarantee, not a gap: vaud never blind-copies one app's
  fields or executable payloads into another. The future refinement is opt-in per-field extension
  mappers, never a blind copy.

## The adapter contract

`src/core/adapter.ts` defines what every format plugin implements. It is a `kind`-discriminated union:

```ts
interface AdapterBase {
  id: string;
  label: string;
  outputExtensions: string[];        // extensions this adapter writes
  detect(input): number;             // 0..1 confidence it can read this input
}

interface CharacterAdapter extends AdapterBase {
  kind: "character";
  toCanonical(input): CanonicalCharacter;
  fromCanonical(entity, context?): AdapterOutput;   // context carries embedded lorebooks to re-embed
}

interface LorebookAdapter extends AdapterBase {
  kind: "lorebook";
  toCanonical(input): CanonicalLorebook;
  fromCanonical(entity): AdapterOutput;
}

type FormatAdapter = CharacterAdapter | LorebookAdapter;
```

The registry stores the union heterogeneously. A converter narrows on `kind` before it ever hands an
entity to `fromCanonical`, so a cross-kind call (handing a lorebook to a character writer) is not even
representable. **Formats are open (drop in any folder); entity kinds are a small closed union** that
grows only by adding a member here plus a sibling `entities/<kind>/` folder. That trade buys
compile-time safety across the whole engine.

## Detection and the registry

`src/core/registry.ts` is the pure, in-memory adapter table. `detect(input)` runs every adapter's
`detect()` and returns the single highest-confidence match above a `0.5` threshold. Scores are chosen so
more specific formats outrank generic ones (an RoleCall card scores `1.0` and beats the generic
SillyTavern reader's `0.9` on the same CCv3 card).

**The cross-kind firewall.** Because both character and lorebook adapters share one registry, a detector
must not claim another kind's files. The load-bearing case: a SillyTavern worldbook is also
`{ name, ... }` json, so the character reader's flat/v1 path is tightened to require a real character
signal (`description` / `personality` / `scenario` / `first_mes` / `mes_example`), not a bare `name`. A
lorebook has none of those, so it can never be mistaken for a character.

## Folders-as-schema (the moddability promise)

`src/core/loader.ts` is the one impure edge: it scans `src/formats/*/index.ts` with `Bun.Glob`,
dynamically imports each, and registers what it default-exports. Folders whose name starts with `_`
(`_template`, `_shared`) are skipped.

- A format **is** a folder. Nothing central lists formats; the filesystem is the schema.
- A folder's `index.ts` default-exports one adapter, **or an array of adapters** when a format family
  ships more than one codec (SillyTavern and RoleCall each export `[character, lorebook]`).
- `FormatId` is an open string, so a drop-in can claim any id.

To add a format: copy `src/formats/_template`, fill in `detect` / `toCanonical` / `fromCanonical`, done.
No core edits, nothing to register by hand.

## Bundles: a card plus its lorebook

A character card can embed a lorebook (`data.character_book` in CCv2/v3). That embedded book is treated
as a **reference** to a canonical lorebook, not an inlined blob:

- On **import**, a shared layer extracts the embedded book into a standalone `CanonicalLorebook` and
  links it from the character via `knowledgeRefs`. This is format-agnostic (any CCv2/v3 card).
- On **export**, the target character adapter re-embeds the referenced lorebook into that format's own
  book slot, via the `EmitContext` it receives. This is format-specific.

`src/convert.ts` `convertFile` ties it together: extract on import, re-embed on export, for same-kind
conversions. Details in [concepts/character-book.md](concepts/character-book.md).

## Layering

Strict inward dependencies, never outward:

```
core        depends on nothing
  ^
formats     depend on core (+ shared helpers in formats/_shared)
  ^
cli / app   depend on formats + core
```

The engine never imports UI, a database, or a framework. Prove the converter (canonical + adapters +
tests) before any UI. This is why the CLI is the first and, for now, only surface.

## The CLI

`src/cli.ts` is the thin app layer. Commands:

| Command | Does |
| --- | --- |
| `vaud convert <in> <out> [--to <format>]` | Convert a file. Target resolved by `--to` or the output extension. |
| `vaud inspect <file>` | Show what is inside a file (kind, name, key fields). |
| `vaud label <file>` | Guess a card's format and likely origin app. |
| `vaud formats` | List every adapter the registry discovered (the single source of truth). |
| `vaud version` / `vaud help` | The obvious. |

## Source of truth

| Concern | File |
| --- | --- |
| Canonical wrapper, escrow, id policy | `src/core/canonical.ts` |
| Adapter contract, entity kinds, emit context | `src/core/adapter.ts` |
| Registry (detection, lookup) | `src/core/registry.ts` |
| Loader (folders-as-schema) | `src/core/loader.ts` |
| Bundle extract/re-embed orchestration | `src/convert.ts` |
| Character superset | `src/entities/character/schema.ts` |
| Lorebook superset | `src/entities/lorebook/schema.ts` |
