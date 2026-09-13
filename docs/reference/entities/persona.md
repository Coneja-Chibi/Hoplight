---
id: reference/entities/persona
title: Persona entity
audience: dev
summary: The canonical superset entity for a user persona: every PersonaBody field, its type, the formats that produce it, and its meaning.
tags: [entity, persona, canonical, fields]
related: [reference/architecture, reference/entities/character, reference/formats/rolecall, reference/formats/sillytavern]
---

# Persona entity

A `CanonicalPersona` is `CanonicalEntity<"persona", PersonaBody>`: the stable canonical wrapper (see
[architecture.md](../architecture.md)) around a `PersonaBody`, the superset shape that unions what every
real persona format expresses. A persona is the USER's identity, not the AI's: the counterpart to a
character, sharing the same prompt-injection machinery but speaking in the opposite voice, first person
as `{{user}}` instead of third person as `{{char}}`. `src/entities/persona/schema.ts` is the source of
truth for the types; this page is the source of truth for what each field MEANS and which formats
produce it.

## How to read the field tables

The field tables on this page are generated from the schema by `scripts/docs-fields.ts` and embedded
verbatim. Do not hand-edit a cell: improve the schema doc comment and regenerate, and the docs follow.

- **Field** is the canonical name. A trailing `?` marks an optional field.
- **Type** is the TypeScript type in the schema.
- **Producers** are the source formats named in the field's schema doc comment. A `-` means the doc
  comment names no specific producer. Many such fields are the universal core every producer carries
  (`name`, `content`, `brief`); others simply have their provenance described in prose rather than
  tagged inline.
- **Meaning** is what the field is for. A blank Meaning cell is a self-evident primitive named by its
  own field, and marks a field the schema doc comment did not annotate. Non-obvious fields carry their
  meaning from the schema doc comment. Any richer explanation lives in the prose around a table, never
  inside a cell.

## Composition

`PersonaBody` is flatter than `CharacterBody`: two fields are required (`name`, `content`), and eleven
further fields are optional. Six of those optional fields nest a named shape (`sections`, `identity`,
`presentation`, `chatInjection`, `attribution`, `media`); the rest are scalars or reference lists. The
full `PersonaBody` table is in [PersonaBody](#personabody) at the end.

Four adapters produce personas today: RoleCall in two shapes, SillyTavern, Lumiverse, and Marinara. A
legacy RoleOut PNG shape and a generic foreign-V2/V3-card-as-persona path are specced in
`specs/formats/personas.md` but have no shipped adapter; [formats/rolecall.md](../formats/rolecall.md)
lists both explicitly as pending.

@fig composition

The sections below walk each nested shape, grouped by concern. Every field table is pasted verbatim from
[docs/generated/fields.persona.md](../../generated/fields.persona.md).

## Core content

The persona's own voice, and how it is found on a shelf. `name` is the canonical identifier; `brief` is
the short library-card blurb and is NEVER the injected text; `content` is the full first-person text
actually injected as `{{user}}`'s voice. Getting `brief` and `content` swapped was a live RoleCall
production bug; every codec on this page replicates the fix, not the bug. `sectionOrder` records the
creator's chosen display order for `sections`; `traits` are personality-descriptor tags (RC
`details.traits` / card tags).

`sections` is a structured alternative source for `content`. Canonical keeps both, unlike the source
formats' own "content wins, sections ignored" read rule, so the editor can offer structured editing even
when the source was flat text. Compiling sections into content is a codec's job at serialize time, in
the fixed order `appearance, body, personality, quirks, history`, each rendered as an
`"<Label>: <text>"` block.

### Sections

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `appearance?` | `string` | - |  |
| `body?` | `string` | - |  |
| `personality?` | `string` | - |  |
| `quirks?` | `string` | - |  |
| `history?` | `string` | - |  |

## Identity

Authored identity attributes, RoleCall's casting-card details. `pronouns` is a free-text display
string, kept for RC/ST round-trip; `pronounSet` is Lumiverse's structured triplet, real data an engine
can conjugate with, additive and absent everywhere else.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `tagline?` | `string` | - |  |
| `age?` | `string` | - | free TEXT ("23", "ageless"), never an int |
| `height?` | `string` | - |  |
| `pronouns?` | `string` | - |  |
| `pronounSet?` | `PersonaPronounSet` | - |  |

### Pronoun set

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `subjective` | `string` | - |  |
| `objective` | `string` | - |  |
| `possessive` | `string` | - |  |

## Presentation

The persona's visual identity, RoleCall theming. `imageUrl` is an external image URL for a JSON export;
a PNG export instead carries the image as the file body itself, the same binary-carrier pattern
[architecture.md](../architecture.md) describes for character portraits. `colors` reuses character's
`Swatch` shape (see [entities/character.md](character.md#swatch)).

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `signatureColor?` | `string` | - |  |
| `colors?` | `Swatch[]` | - |  |
| `imageUrl?` | `string` | - | external image URL (JSON export) - PNG exports carry the image as the file body instead |

## Knowledge, rating, and chat injection

`knowledgeRefs` links canonical lorebook ids, ordered: the same reference-not-inline rule as
`CharacterBody.knowledgeRefs`, an embedded book is never copied in. `rating` reuses the canonical
`ContentRating` (see [entities/character.md](character.md#discovery)); RoleCall's own wire is a two-way
boolean (`all_hours` / `after_dark`), so a canonical `mature` rating narrows to `after_dark` on export to
RC, a documented, one-way loss.

`chatInjection` is where and how the content is injected into the prompt. Two dialects share the one
`position` slot: RoleCall's four stops (`world`, `character`, `scene`, `depth`) and SillyTavern's five
(`prompt`, `author_note_top`, `author_note_bottom`, `in_chat`, `none`), plus an open string for anything
else. `wrapper` is RoleCall's custom text prepended to the injected block. Which stops a given
platform's editor lens shows is decided in `core/persona/platform-fields.ts` (`injectionsForProfile`),
never hardcoded in the UI.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `position` | `\| "prompt" \| "author_note_top" \| "author_note_bottom" \| "in_chat" \| "none" \| "world" \| "character" \| "scene" \| "depth" \| (string & {})` | - |  |
| `depth?` | `number` | - |  |
| `role?` | `"system" \| "user" \| "assistant"` | - |  |
| `wrapper?` | `string` | RC | RC's custom wrapper text prepended to the injected block (injection_prefix). |

## Attribution

Credit and provenance. `source` is an open origin-platform tag (`"rolecall"`, `"sillytavern"`,
`"custom"`, ...). `createdAt` is ISO 8601 text here, not the unix-seconds number
`CharacterBody.attribution.createdAt` uses: the `rcpersona` wire itself carries a string.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `creator?` | `string` | - |  |
| `version?` | `string` | - |  |
| `createdAt?` | `string` | - | ISO 8601 (the rcpersona wire carries strings, not unix seconds) |
| `source?` | `string` | - | origin platform tag ("rolecall", "sillytavern", "custom", ...) |

## Media

Studio-side only. `media.portrait` is the same slot `CharacterBody.media.portrait` fills: the studio
portrait resolver reads it, a data-URI `MediaAsset` from an in-editor upload (see
[entities/character.md](character.md#mediaasset)). Codecs map explicit fields only, so this field never
leaks into a foreign wire.

## PersonaBody

The full shape, assembled from every field above.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `name` | `string` | - |  |
| `brief?` | `string` | - | short user-facing summary (library card blurb) - NEVER the injected text |
| `content` | `string` | - | the full first-person text injected as {{user}}'s voice |
| `sections?` | `PersonaSections` | - | structured alternative source for `content`. Canonical keeps BOTH (unlike the source formats' "content wins, sections ignored" read rule) so the editor can offer structured editing even when the source was flat; compiling sections into content happens in codecs at serialize time. |
| `sectionOrder?` | `string[]` | - | creator-chosen display order of sections |
| `traits?` | `string[]` | RC | personality-descriptor traits (RC details.traits / card tags) |
| `identity?` | `PersonaIdentity` | - |  |
| `presentation?` | `PersonaPresentation` | - |  |
| `knowledgeRefs?` | `string[]` | - | linked canonical lorebook id(s), ordered - same reference-not-inline rule as CharacterBody |
| `rating?` | `ContentRating` | RC | reuses the canonical graded rating (RC all_hours -> "all-ages", after_dark -> "explicit") |
| `chatInjection?` | `PersonaChatInjection` | - |  |
| `attribution?` | `PersonaAttribution` | - |  |
| `media?` | `{ portrait?: MediaAsset }` | - | Same slot as CharacterBody: the studio portrait resolver reads media.portrait (a data-URI MediaAsset from in-editor upload). Studio-side; codecs map explicit fields only, so this never leaks into a foreign wire. |

## What rides escrow, not a field

Anything a single source format keeps but no canonical field expresses stays in
`original[formatId].raw` and survives a same-format round-trip byte-for-byte. Cross-format conversion
carries only the canonical body, so one app's private data is never copied into another app's file. See
the escrow rule in
[architecture.md](../architecture.md#escrow-lossless-round-trips-contained-cross-format-loss).

Rides escrow, because it has no canonical slot: RoleCall's private ids and any unmapped
`extensions.rolecall` keys on the twin card. Every OTHER persona in a SillyTavern personas backup rides
too, since the adapter contract is one entity per file, `toCanonical` imports only the default persona
(falling back to the first), and export overlays the edited persona back onto the sealed backup so the
rest re-emit byte-true. Lumiverse's `folder`, `is_narrator`, `metadata`, and timestamps ride the twin
untouched. Marinara's whole game layer rides sealed: per-persona chat theming (name, dialogue, and box
colors, tracker paint), stat bars, avatar crop, tags, and `scenario`, a field its own section map gives
no canonical home.

Does NOT ride escrow, because it is modeled: Lumiverse's structured pronoun triplet is first-classed as
`identity.pronounSet`; SillyTavern's injection positioning is first-classed as `chatInjection`;
RoleCall's sections, identity attributes, and presentation are first-classed as `sections`, `identity`,
and `presentation`. Each survives cross-format conversion instead of being trapped in one app's escrow.

## See also

- [architecture.md](../architecture.md): the canonical model, escrow, hub-and-spoke, the adapter contract.
- [entities/character.md](character.md): the sibling superset entity; shares `ContentRating`, `Swatch`,
  and `MediaAsset`.
- [formats/rolecall.md](../formats/rolecall.md): the RoleCall persona codec, both shapes, and the
  cross-kind firewall against the character adapter.
- [formats/sillytavern.md](../formats/sillytavern.md): the SillyTavern personas-backup codec.
- [formats/README.md](../formats/README.md): the coverage matrix of every format and the fields it
  produces.
