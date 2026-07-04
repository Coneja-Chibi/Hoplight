# Spec: The Canonical Model

**Package:** `packages/core` · **Status:** hand-written skeleton, authoritative for
shape philosophy; field-level detail grows with codec specs. ADR-005 is the law
behind it.

## Content types (v1 surface)

`Character`, `Lorebook` (+ `LorebookEntry`), `Preset`, `Persona`, `RegexScript`,
`Production` (workspace manifest). `World`/compendium arrives with M7 and extends
Lorebook rather than replacing it.

## Shared envelope

Every canonical entity is wrapped:

```ts
interface Entity<T> {
  id: string;              // ulid, assigned on first parse, stable thereafter
  type: ContentType;
  data: T;                 // the canonical payload (zod-validated)
  escrow: Escrow;          // see escrow-and-roundtrip.md
  meta: {
    origin: { format: FormatId; version?: string; file?: string };
    importedAt: string;    // ISO
    hash: string;          // content hash of data+escrow, for history
  };
}
```

## Character (canonical superset — sources it must cover)

- chara_card_v2 / v3 (public specs): name, description, personality, scenario,
  first_mes, mes_example, creator_notes, system_prompt, post_history_instructions,
  alternate_greetings, tags, creator, character_version, extensions, character_book,
  V3 additions (assets, nickname, creator_notes_multilingual, source, group_only_greetings).
- RoleCall native (`rcpersona`, packages/types character.ts): tagline, details
  (palette/signature colors, full_name, title, age, pronouns, fieldOrder,
  prompt_depth_injections), sprites, content rating, trigger warnings.
- Risu charx extensions; Backyard fields (see their codec specs for the field maps).

Design rules:

1. Prompt-bearing fields are first-class and format-neutral: `description`,
   `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `systemPrompt`,
   `postHistoryInstructions`, `alternateGreetings[]`, `depthInjections[]`.
2. Identity/presentation metadata is grouped (`identity`, `presentation`), not flat.
3. An embedded lorebook is a REFERENCE to a canonical Lorebook entity, not an inline
   blob; codecs inline/extract at the boundary.
4. `extensions` maps pass through untouched inside escrow unless a codec claims them.

## Lorebook / LorebookEntry

Start from VAUDEVILLE `packages/lorebook/src/types.ts` (`Lorebook` :342,
`LorebookEntry` :216): it is already a practical superset of ST world info + Agnai +
RC. Adopt its field surface as the canonical baseline; rename DB-isms; keep
`origin`/`unsupportedFields` semantics but migrate them into the shared escrow
envelope.

## Preset

Two-layer, as in presets-core: `RawPreset` stays codec-side; canonical `Preset` is
the parsed shape (`prompts[]`, `promptOrder`, `samplers`, `systemPrompts`,
`templates`, `behavior`, `apiOptions`) — see extraction map.

## Token counting

`core` defines `TokenCounter` as an interface (count(text, model?) -> number);
implementations live outside core. Every canonical entity exposes computed token
stats through it, never stores them.

## Open items (grow via codec specs)

- Field-level table per source format lives in each codec spec's capabilities matrix.
- Asset handling (card art, sprites, charx embedded assets): binary assets stored
  beside the entity in productions; canonical model stores typed references.
