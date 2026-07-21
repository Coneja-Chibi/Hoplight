# hoplight documentation

This is the reference documentation for **hoplight**, the Vaudeville Studios converter for AI-roleplay
content. It is **docs-as-code**: it lives in the repo, is versioned with the code, and is kept true by
being updated in the same change that adds or alters a feature. If a doc and the code disagree, the code
is right and the doc is a bug; file it as one.

## The contract

- **Based in truth.** Every claim here is checked against the actual source. Field tables mirror the real
  schema; detection scores mirror the real `detect()`; quirks mirror the real mapping code. No
  aspirational or invented behavior. When something is planned-but-not-built, it is labeled as such.
- **Updated per feature.** Adding a format, an entity kind, a field, or a CLI command is not done until
  its docs are written or updated in the same commit. New format -> a `formats/<name>.md` plus a row in
  `formats/README.md`. New canonical field -> a row in the relevant `entities/*.md`. New concept -> a
  `concepts/*.md`.
- **One concept per file**, mirroring the code's own house rule.

## Map

| Doc | What it covers |
| --- | --- |
| [architecture.md](architecture.md) | The engine: canonical model, escrow, the adapter contract, entity kinds, the registry, folders-as-schema, bundles, the CLI. Start here. |
| [entities/character.md](entities/character.md) | The canonical character superset: every `CharacterBody` field, what it means, which formats produce it. |
| [entities/lorebook.md](entities/lorebook.md) | The canonical lorebook superset: every entry and book field, and the fields that ride escrow instead of a canonical slot. |
| [concepts/character-book.md](concepts/character-book.md) | The embedded CCv2/v3 `character_book` dialect and how a card's lorebook is extracted and re-embedded. |
| [formats/README.md](formats/README.md) | The coverage matrix: every format, its entity kinds, container, and detection. |
| formats/*.md | One reference per format family: detection, field map, escrow, quirks, source of truth. |

## How to read the field tables

Each canonical field is documented with:

- **Field** the canonical name (what you see in `vaud-json` output).
- **Type** the TypeScript type in `src/entities/<kind>/schema.ts`.
- **Meaning** what it is used for in a roleplay client.
- **Formats** which source formats actually produce or consume it. A field with no producer would not
  exist as a canonical slot (see the escrow rule in [architecture.md](architecture.md)).

The schema file is the source of truth for the type; this doc is the source of truth for the *meaning*.
