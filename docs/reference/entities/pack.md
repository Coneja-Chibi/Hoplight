---
id: reference/entities/pack
title: Pack entity
audience: dev
summary: The canonical studio entity for a reusable expression/sprite pack: every PackBody field, its type, and its meaning.
tags: [entity, pack, canonical, fields]
related: [reference/architecture, reference/entities/character]
---

# Pack entity

A `CanonicalPack` is `CanonicalEntity<"pack", PackBody>`: the same stable canonical wrapper (see
[architecture.md](../architecture.md)) every entity uses, around a `PackBody`. `src/entities/pack/schema.ts`
is the source of truth for the `PackBody` type; this page is the source of truth for what each field means.

Pack differs from character, lorebook, persona, and regex in one load-bearing way: it has no format
adapter. No `toCanonical`/`fromCanonical` pair reads or writes a pack (see architecture.md, "The adapter
contract"), and it does not appear in the formats coverage matrix ([formats/README.md](../formats/README.md)).
A pack is authored directly in the studio, stored at `studio/pack/<id>.json`, and exists to hold one
reusable expression/sprite pack so it can be attached to more than one character.

## How to read the field table

The field table on this page is generated from the schema by `scripts/docs-fields.ts` and embedded
verbatim. Do not hand-edit a cell: improve the schema doc comment and regenerate, and the docs follow.

- **Field** is the canonical name. A trailing `?` marks an optional field.
- **Type** is the TypeScript type in the schema.
- **Producers** are the source formats named in the field's schema doc comment. Pack has no adapter, so
  every Producers cell on this page reads `-`: the field is authored in the studio, not carried in from
  a wire format.
- **Meaning** is what the field is for. A blank Meaning cell is a self-evident primitive named by its own
  field; none occur on this page. Any richer explanation lives in the prose around the table, never
  inside a cell.

## Composition

`PackBody` stays flat: a `name`, an optional shelf `brief`, the `pack` itself, and an optional multi-character
`groups` map. There are no always-present sub-objects to group the way `CharacterBody` has eight: the
whole body is one small record. `pack` and each entry of `groups` are a `SpritePackValue`, the label-to-image
hub shape a character's `media.assets` (role `emotion`) project through as well; see
[entities/character.md](character.md), "Media". `SpritePackValue` and its `SpritePackItem` rows live in
`src/core/media/pack.ts`, not in `src/entities/pack/schema.ts`, so `scripts/docs-fields.ts` does not generate
a table for them on this page; they are described in prose below, in "The sprite pack hub shape".

@fig composition

The table below is pasted verbatim from [docs/generated/fields.pack.md](../../generated/fields.pack.md).

## Pack body

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `name` | `string` | - | Library / tab name |
| `brief?` | `string` | - | Short blurb on the shelf card (never host wire) |
| `pack` | `SpritePackValue` | - | The emotion pack (label -> image). Hub shape shared with character media. |
| `groups?` | `Record<string, SpritePackValue>` | - | Optional multi-character groups (Lumi-style); flat pack is the default group. |

## The sprite pack hub shape

`SpritePackValue` (`src/core/media/pack.ts`) is the label-to-image hub every pack-shaped field converts
through, on a character card and in the library alike:

- `items: SpritePackItem[]`, the faces. Each item is `{ id: string; label: string; ref: string; mime?:
  string }`: a stable id, the display label ("neutral", "happy", ...), a `ref` into the entity's asset
  store or a data URI, and an optional mime type.
- `enabled?: boolean`, a creator on/off toggle for the pack as a whole.
- `defaultLabel?: string`, which face is the resting/default face. `resolvePackFace` falls back to a
  face literally labelled "neutral", then to the first item, when this is absent or matches nothing.

This is the same shape `packFromMedia` reads off a character's `media.assets` (role `emotion`) and
`emotionAssetsFromPack` writes back onto, so a face pack means the same thing whether it lives on a
character card or as a standalone library `pack` entity.

`groups?: Record<string, SpritePackValue>` holds one full `SpritePackValue` per named group member,
keyed by that member's name: a multi-character scene, Lumiverse's `expression_groups` block
(`src/formats/_shared/media-bridge/lumi-expressions.ts`). When `groups` is absent or empty, `pack` alone
is the default group.

## What rides escrow, not a field

Pack is never a `toCanonical`/`fromCanonical` target, so it never carries a foreign source payload to
round-trip against. Every save path (the `PackEditor` room, the Workbench's "New pack", and "Save as
library pack" from a character's Manage Sprites dialog) writes a bare `CanonicalEntity<"pack", PackBody>`
with no `original` entry: `body` is the whole record.

Rides escrow: nothing. There is no wire format a pack round-trips against, so there is no app-local
leftover to seal away, and the `original` escrow envelope defined in [architecture.md](../architecture.md)
never gets populated for a pack entity.

Does NOT ride escrow, because there is nothing for it to carry: an item's `ref` (a data URI, or a
reference into the entity's asset store) is the image itself, authored inline, not a binary carrier kept
beside a canonical field the way a character's PNG `sourceMedia` carrier is. See architecture.md,
"Binary carriers", for the contrast.

## See also

- [architecture.md](../architecture.md): the canonical model, the adapter contract, escrow.
- [entities/character.md](character.md): the `Media` section, and the character-attached form of this
  same `SpritePackValue` hub shape.
- [formats/README.md](../formats/README.md): the coverage matrix; pack has no listed adapter because it
  is studio-native.
