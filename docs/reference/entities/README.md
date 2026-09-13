---
id: reference/entities/README
title: Entities
audience: dev
summary: Index of the six canonical entity kinds, character, lorebook, pack, persona, preset, and regex, linking each one's field reference and the shapes they share.
tags: [entity, index, canonical]
related: [reference/architecture, reference/concepts/canonical-model, reference/formats/README]
---

# Entities

Every canonical shape hoplight converts through. An **entity** is a `CanonicalEntity<Kind, Body>` (see
[../architecture.md](../architecture.md), "The canonical entity"): a stable wrapper around a `Body`, the
superset shape for one `kind`. The kind union is closed: `STUDIO_ENTITY_KINDS` in
`src/studio/path-policy.ts` names exactly six kinds, alphabetically `character`, `lorebook`, `pack`,
`persona`, `preset`, `regex`, and it grows only by adding a member there plus a sibling
`src/entities/<kind>/` folder (see [../architecture.md](../architecture.md), "The adapter contract").
Four of the six also have a format adapter (`src/core/adapter.ts`): `character`, `lorebook`, `persona`,
`regex` read and write real wire formats. The other two, `pack` and `preset`, are authored only in the
studio, with no `toCanonical` / `fromCanonical` pair and no row in the formats coverage matrix. Every
kind stores at `studio/<kind>/<id>.json` under the studio root (`resolveStudioPath` in
`src/studio/path-policy.ts`), the same rule for all six regardless of adapter status.

## Generated field tables

Each entity page embeds its field table verbatim from `docs/generated/fields.<kind>.md`, generated from
the live schema JSDoc by `scripts/docs-fields.ts` (`bun run scripts/docs-fields.ts`, checked with
`--check`). Do not hand-edit a table cell on an entity page: improve the doc comment in
`src/entities/<kind>/schema.ts` and regenerate.

## Reference pages

| Entity | Page | Covers |
| --- | --- | --- |
| Character | [character.md](character.md) | the roleplay character: identity, persona and voice, prompts and injections, greetings and examples, media, presentation, settings and behavior, attribution and discovery |
| Lorebook | [lorebook.md](lorebook.md) | world info / character book: the entry set, triggers, position and depth, per-entry and per-book settings |
| Pack | [pack.md](pack.md) | a reusable expression/sprite pack, attachable to more than one character (no format adapter, studio-only) |
| Persona | [persona.md](persona.md) | the user's identity, the counterpart to a character: name, content, sections, chat injection |
| Preset | [preset.md](preset.md) | a chat-completion prompt-manager preset: ordered prompt blocks, samplers, behavior settings (no format adapter, studio-only) |
| Regex | [regex.md](regex.md) | a named, ordered find/replace rule set: the character-card twin and standalone script files |

## Cross-cutting

| Concept | Reference |
| --- | --- |
| Sprite pack hub shape (`SpritePackValue` / `SpritePackItem`, `src/core/media/pack.ts`): Character's `media.assets` (role `emotion`) and Pack's `pack` / `groups` project through the same shape | [character.md, "Media"](character.md#media), [pack.md, "The sprite pack hub shape"](pack.md#the-sprite-pack-hub-shape) |
| `RegexScript`: Character's `behavior.regexScripts` is the card-embedded twin of Regex's standalone set shape | [character.md, "Settings and behavior"](character.md#settings-and-behavior), [regex.md, "The character-card twin"](regex.md#the-character-card-twin) |
| `knowledgeRefs` / `behaviorRefs`: Character links a standalone Lorebook or Regex entity by canonical id | [character.md, "Composition and variants"](character.md#composition-and-variants), [lorebook.md](lorebook.md), [regex.md](regex.md) |
| Persona is Character's opposite-voice counterpart, sharing the same prompt-injection machinery: first person `{{user}}` versus third person `{{char}}` | [persona.md](persona.md), [character.md](character.md) |
