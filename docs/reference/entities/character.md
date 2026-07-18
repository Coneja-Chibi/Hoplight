---
id: reference/entities/character
title: Character entity
audience: dev
summary: The canonical superset entity for a roleplay character: every CharacterBody field, its type, the formats that produce it, and its meaning.
tags: [entity, character, canonical, fields]
related: [reference/architecture, reference/formats/sillytavern]
---

# Character entity

A `CanonicalCharacter` is `CanonicalEntity<"character", CharacterBody>`: the stable canonical wrapper
(see [architecture.md](../architecture.md)) around a `CharacterBody`, the superset shape that unions
what every real character format expresses. `src/entities/character/schema.ts` is the source of truth
for the types; this page is the source of truth for what each field MEANS and which formats produce it.

## How to read the field tables

The field tables on this page are generated from the schema by `scripts/docs-fields.ts` and embedded
verbatim. Do not hand-edit a cell: improve the schema doc comment and regenerate, and the docs follow.

- **Field** is the canonical name. A trailing `?` marks an optional field.
- **Type** is the TypeScript type in the schema.
- **Producers** are the source formats named in the field's schema doc comment. A `-` means the doc
  comment names no specific producer. Many such fields are the universal core every format carries
  (`name`, `personality`, `scenario`, `systemPrompt`, `tags`); others simply have their provenance
  described in prose rather than tagged inline.
- **Meaning** is what the field is for. A blank Meaning cell is a self-evident primitive named by its
  own field, and marks a field the schema doc comment did not annotate. Non-obvious fields carry their
  meaning from the schema doc comment. Any richer explanation lives in the prose around a table, never
  inside a cell.

## Composition

`CharacterBody` groups its fields into eight always-present sub-objects (`identity`, `persona`,
`prompts`, `greetings`, `examples`, `media`, `attribution`, `discovery`) plus eight optional fields:
three further sub-objects (`presentation`, `settings`, `behavior`) and five standalone fields
(`bias`, `worldName`, `knowledgeRefs`, `behaviorRefs`, `variants`). Grouping keeps related fields
together and mirrors how a card is authored, not how any one app stores it. The full `CharacterBody`
and `CharacterVariant` tables are in [Composition and variants](#composition-and-variants) at the end.

@fig composition

The sections below walk each group. Every field table is pasted verbatim from
[docs/generated/fields.character.md](../../generated/fields.character.md).

## Identity

Who the character is: the canonical `name` plus authored identity attributes (RoleCall casting-card
details and Agnai culture). `{{char}}` resolves to `name`; `nickname` overrides the display name
without changing the canonical `name`.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `name` | `string` | - |  |
| `nickname?` | `string` | CCv3, Risu, Backyard | {{char}} override that does NOT change the canonical name (Risu/Backyard aiName, CCv3 nickname) |
| `tagline?` | `string` | - | short one-liner / creator comment |
| `description?` | `string` | CCv2/v3 | the main character description / persona block (CCv2/v3 `description`) |
| `characterVersion?` | `string` | - |  |
| `fullName?` | `string` | RC | full/formal name distinct from the display name (RC details.full_name) |
| `title?` | `string` | RC | honorific / role title (RC details.title) |
| `age?` | `string` | RC | free TEXT in every producer ("23", "ageless", "300+ years"), never an int (RC details.age) |
| `pronouns?` | `string` | RC | RC details.pronouns |
| `culture?` | `string` | Agnai | Agnai culture: drives default language/voice selection |

## Persona and voice

How the character behaves, sounds, and looks. `persona` carries the core behavior text (`personality`,
`scenario`, `appearance`) and nests two authored sub-shapes plus a structured encoding: `voice` (a
`Voice`, the TTS selection, never the audio bytes), `imagePrompt` (an `ImagePrompt`, the creator's
image-gen hints), and `structured` (a discriminated union that preserves attribute maps such as W++).

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `personality?` | `string` | - |  |
| `scenario?` | `string` | - |  |
| `appearance?` | `string` | Agnai | Agnai-only free-text physical description (image-gen); other formats fold it into description |
| `voice?` | `Voice` | Risu, Agnai | per-character voice/TTS selection (Agnai voice, Risu vits) |
| `imagePrompt?` | `ImagePrompt` | Risu, Agnai | authored image-gen prompt hints (Agnai imageSettings affixes, Risu sdData/newGenData) |
| `structured?` | `\| { kind: "text" } \| { kind: "attributes" \| "wpp" \| "sbf" \| "boostyle"; attributes: Record<string, string[]> }` | Agnai | structured persona encoding (Agnai persona.kind + attributes); preserves W++/attribute maps. Discriminated so illegal states are unrepresentable: plain "text" carries no attributes; every attribute-map kind requires its attributes. |

### Voice

The authored voice/TTS selection and its config, not the model bytes (those are assets or escrow).

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `provider` | `string` | - | open union: "elevenlabs" \| "webspeechsynthesis" \| "novel" \| "agnaistic" \| "vits" \| ... |
| `voiceId?` | `string` | - |  |
| `rate?` | `number` | - |  |
| `pitch?` | `number` | - |  |
| `disabled?` | `boolean` | Agnai | creator turned voice off without discarding the config (Agnai voiceDisabled) |
| `extras?` | `Record<string, unknown>` | - | provider-specific extras (stability, similarityBoost, model seed, vits config...) - authored, open |

### ImagePrompt

The text a creator writes to steer image generation for this character. Sampler and provider knobs are
platform config and are not modeled here.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `prompt?` | `string` | Risu | full base prompt (Risu newGenData.prompt) |
| `prefix?` | `string` | - |  |
| `suffix?` | `string` | - |  |
| `negative?` | `string` | - |  |
| `template?` | `string` | Agnai | prompt template (Agnai imageSettings.template) |
| `instructions?` | `string` | Risu | freeform instruction text (Risu newGenData.instructions) |
| `emotionInstructions?` | `string` | Risu | emotion-pack generation instructions (Risu newGenData.emotionInstructions) |
| `rows?` | `{ label: string; value: string }[]` | Risu | labeled prompt rows (Risu sdData: [["always","solo, 1girl"], ...]) |

## Prompts and injections

Instruction-layer text sent to the model.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `systemPrompt?` | `string` | - |  |
| `postHistoryInstructions?` | `string` | SillyTavern | the "jailbreak" / post-history slot in SillyTavern |
| `depthInjections?` | `DepthInjection[]` | - |  |
| `prefill?` | `string` | Agnai | assistant-response prefill, prepended to the model reply (Agnai; common with Claude) |
| `additionalText?` | `string` | Risu | authored plain-append prompt text (Risu additionalText) - a simple append, not a depth injection |

### DepthInjection

Text injected at a fixed depth in the chat. `origin` records which source mechanism produced the
injection so it re-emits to its original home on export.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `text` | `string` | - |  |
| `depth` | `number` | - |  |
| `role?` | `"system" \| "user" \| "assistant"` | - |  |
| `origin?` | `"depth_prompt" \| "rolecall_details" \| "worldinfo"` | - | which source mechanism produced this, so it re-emits to its original home on export |
| `enabled?` | `boolean` | - | creator toggle; undefined = enabled |

## Greetings and examples

The opening messages and example dialogue.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `firstMessage?` | `string` | - |  |
| `alternateGreetings?` | `Greeting[]` | - |  |
| `groupOnlyGreetings?` | `Greeting[]` | CCv3 | CCv3 group-chat-only greetings, distinct from alternateGreetings |

### Greeting

One greeting with an optional creator-given title. `id` is format-local editing provenance, not
portable content: other format writers emit only `text` and `title`.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `text` | `string` | - |  |
| `title?` | `string` | - |  |
| `id?` | `string` | - | stable editing identity (format-local provenance); not user-facing content |

### Examples

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `exampleMessages?` | `string` | - | mes_example |

## Media

Images attached to the card, plus the Agnai composite-avatar recipe. Image bytes live in the entity's
asset store or as data URIs; these shapes hold the references and the authored recipe.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `portrait?` | `MediaAsset` | - |  |
| `assets?` | `MediaAsset[]` | RoleCall, Risu | extra images / expression + outfit + pose packs (Risu .charx, RoleCall sprites) |
| `sprite?` | `Sprite` | Agnai | Agnai composite-avatar recipe (visualType "sprite") |
| `visualKind?` | `string` | Agnai | which visual mode the creator chose: "avatar" \| "sprite" (open; Agnai visualType) |
| `faceLabel?` | `string` | - | Preferred expression-pack label for this body (or variant override). Display binds the portrait stage to that pack face when present; not a second asset store. |

### MediaAsset

One image reference and what it is for.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `role` | `"portrait" \| "emotion" \| "outfit" \| "pose" \| "background" \| "other"` | - |  |
| `name?` | `string` | - |  |
| `label?` | `string` | RoleCall | human label for an expression/outfit/pose variant (RoleCall sprite label) |
| `primary?` | `boolean` | - | the primary asset of its role (e.g. the "main" portrait among many) |
| `ref` | `string` | - | reference into the entity's asset store, or a data URI |
| `mime?` | `string` | - |  |

### Sprite

The Agnai builder-authored composite avatar: named part selections plus palette. The rendered images
are assets; this is the authored recipe.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `parts` | `Record<string, string>` | - |  |
| `gender?` | `string` | - |  |
| `eyeColor?` | `string` | - |  |
| `bodyColor?` | `string` | - |  |
| `hairColor?` | `string` | - |  |

## Presentation

The casting-card presentation layer: a creator's visual identity for the character. Optional; formats
without a presentation concept omit it. A single solid signature rides `signatureColor`; a 2 to 3 color
blend rides `gradientColors`.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `signatureColor?` | `string` | RC, Risu | the character's signature color when it is a single solid (RC details.signature_color, Risu theme color). A signature that is a blend rides in gradientColors instead - one concept, two storage shapes. Account-level accent color is deliberately not modeled here: it belongs to the user's account, not the card. |
| `gradientColors?` | `string[]` | RC | the character's signature when it is a blend of 2-3 colors (RC details.gradient_colors) |
| `palette?` | `Swatch[]` | - |  |
| `background?` | `Background` | - |  |
| `fieldOrder?` | `string[]` | - | creator-chosen display order of definition fields (bento layout) |
| `spoilers?` | `{ mode?: string; order?: string[]; fields?: Record<string, boolean> }` | RC | spoiler / reveal-order config over the public definition fields. `fields` is the authored per-field boolean map (RC publicDefinitionDisplay.spoilers) - previously collapsed to mode/order and LOST. |
| `mediaLinks?` | `string[]` | RC | creator-supplied external reference links on the casting card (RC details.media_links) |

### Swatch

A named color swatch in a card's palette.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `label?` | `string` | - |  |
| `name?` | `string` | - |  |
| `hex` | `string` | - |  |

### Background

A creator-curated background, optionally a video with playback controls.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `ref` | `string` | - |  |
| `overlayOpacity?` | `number` | - |  |
| `videoPlaybackRate?` | `number` | - |  |

## Settings and behavior

Authored inline dials and authored on-card behavior. The converter and editor NEVER execute any
behavior payload: no eval, no require, no DOM injection. Execution happens only inside the capability
sandbox, a later milestone. Behavior re-emits only on its own format's wire and is never blind-copied
across formats.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `talkativeness?` | `number` | SillyTavern | group-chat turn-frequency weight, 0..1 (SillyTavern `extensions.talkativeness`) |
| `risu?` | `{ /** side-screen mode: "none" \| "emotion" \| "imggen" (open) */ viewScreen?: string; largePortrait?: boolean; inlayViewScreen?: boolean; utilityBot?: boolean; lorePlus?: boolean; }` | Risu | Risu authored display/behavior toggles (single-platform but creator-set, so first-class per the schema-is-editor doctrine). Grouped so the origin is obvious and other formats never emit them. |
| `responseSchema?` | `Record<string, unknown>` | Agnai | Agnai structured-output config (`json` ResponseSchema): authored response-shaping the creator built in Agnai's schema editor. Carried verbatim-editable; likely migrates to the Preset entity later. |

### CharacterBehavior

The card's authored scripts and background markup, carried as editable data. `regexScripts` are
card-embedded find/replace twins: their shape is `RegexScript`, defined in the regex entity and
re-exported here so there is one definition, so it has no separate table on this page. See
[regex.md](regex.md), "The character-card twin". `privileged` records that the card requested the
low-level script API; it is a warning marker and a sandbox gating input, never an execution trigger.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `regexScripts?` | `RegexScript[]` | - |  |
| `triggerScripts?` | `TriggerScript[]` | - |  |
| `virtualScript?` | `string` | Risu | JS virtual-script payload, verbatim-editable text (Risu virtualscript) |
| `backgroundHTML?` | `string` | Risu | custom background markup/styles, verbatim-editable text (Risu backgroundHTML/backgroundCSS) |
| `backgroundCSS?` | `string` | - |  |
| `defaultVariables?` | `string` | Risu | script-engine seed values (Risu defaultVariables), verbatim-editable |
| `prebuiltAsset?` | `{ command?: string; exclude?: string[]; style?: string }` | Risu | prebuilt-asset generation config (Risu prebuiltAssetCommand/Exclude/Style) |
| `moduleToggles?` | `string` | Risu | module toggle config string (Risu customModuleToggle) |
| `privileged?` | `boolean` | Risu | the card REQUESTED the privileged low-level script API (Risu lowLevelAccess). A warning marker for the UI and a sandbox gating input - never an execution trigger. |

### TriggerScript

A trigger state-machine script: condition and effect rows, carried verbatim-editable.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `label?` | `string` | - |  |
| `event` | `string` | Risu | the triggering event (Risu `type`: "output", "input", "start", ...) |
| `conditions` | `unknown[]` | - |  |
| `effects` | `unknown[]` | - |  |

## Attribution and discovery

Credit and provenance, and how the card is found and categorized. Note two distinct notes fields:
`creatorNotes` is the CCv2/v3 single-language creator note, while `publicNote` is RoleCall's separate
public "from the creator" note shown on the card page.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `creator?` | `string` | - |  |
| `originalCreator?` | `string` | - |  |
| `source?` | `string[]` | - |  |
| `sourceUrl?` | `string` | RoleCall | canonical/origin URL for the card (RoleCall source_url) |
| `license?` | `string` | - |  |
| `creatorNotes?` | `string` | CCv2/v3 | single-language creator notes about the card (CCv2/v3 `creator_notes`) |
| `creatorNotesMultilingual?` | `Record<string, string>` | CCv3 | localized creator notes, map<ISO 639-1, text> (CCv3 prefers this over single-language notes) |
| `publicNote?` | `string` | RC | public "from the creator" note shown on the card page (RC creators_note; DISTINCT from creatorNotes) |
| `createdAt?` | `number` | - | unix seconds |
| `updatedAt?` | `number` | - |  |

### Discovery

`rating` is the explicit content rating (a `ContentRating`: `all-ages`, `mature`, or `explicit`), kept
out of free-text `tags`.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `tags?` | `string[]` | - |  |
| `genre?` | `string` | - |  |
| `fandom?` | `string` | - |  |
| `rating?` | `ContentRating` | - | explicit content rating; keep out of free-text tags |
| `contentWarnings?` | `string[]` | - | optional trigger/content warnings, card-portable |

## Composition and variants

`CharacterBody` is the top shape assembled from every group above. Two link fields are easy to confuse:
`worldName` is the creator's intent to auto-load an external worldbook BY NAME, while `knowledgeRefs`
links embedded lorebooks by canonical id. `behaviorRefs` likewise links standalone regex/script
entities by id, as opposed to `behavior`, which carries script content on the card itself.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `identity` | `Identity` | - |  |
| `persona` | `Persona` | - |  |
| `prompts` | `Prompts` | - |  |
| `greetings` | `Greetings` | - |  |
| `examples` | `Examples` | - |  |
| `media` | `Media` | - |  |
| `attribution` | `Attribution` | - |  |
| `discovery` | `Discovery` | - |  |
| `presentation?` | `Presentation` | - | creator's visual identity for the card, when the source format carries one |
| `settings?` | `CharacterSettings` | - | authored inline behavior dials (talkativeness, ...) |
| `bias?` | `{ phrase: string; weight: number }[]` | Risu, NovelAI | Character-level phrase/logit bias (Risu `bias` [phrase, weight] pairs). NOTE: a DIFFERENT axis than NovelAI's entry/category-level loreBiasGroups (rich groups, modeled on the lorebook side when its reconciled shape lands) - two homes because they are genuinely two concepts. |
| `worldName?` | `string` | SillyTavern | authored external worldbook link by NAME (SillyTavern `extensions.world`): the creator's intent to auto-load the worldbook called X. Distinct from knowledgeRefs, which links embedded books by canonical id. |
| `knowledgeRefs?` | `string[]` | - | linked canonical lorebook id(s), ordered; embedded on export where a format requires it |
| `behavior?` | `CharacterBehavior` | Risu | authored script/behavior content carried ON the card (Risu); see CharacterBehavior's security line |
| `behaviorRefs?` | `string[]` | ST, Lumiverse | linked canonical regex/script entity id(s) - for STANDALONE behavior files (ST/Lumiverse regex) |
| `variants?` | `CharacterVariant[]` | RoleCall | alternate versions of this character (copied from RoleCall's variant mechanic): each OVERRIDES a subset of fields; the editor shows the base with the active one merged in. See ./variant.ts. |

### CharacterVariant

An alternate version of the character. `overrides` is a deep partial of the body; `applyVariant`
(`./variant.ts`) deep-merges it onto the base, so a variant may change one field or a whole section. A
field counts as overridden when its key is PRESENT in `overrides` (set it to `""` to clear); absent
keys inherit from the base.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `id` | `string` | - |  |
| `label?` | `string` | - |  |
| `mirrorBase?` | `boolean` | RC | RC's two modes. true/undefined (mirror, default): deep-overlay the overrides, unset fields inherit from the base. false (full override): each section the variant defines REPLACES the base's whole section (base fields in it drop), untouched sections still inherit, and the character keeps a name (base name falls through when the override omits it). |
| `overrides` | `DeepPartial<Omit<CharacterBody, "variants">>` | - | the fields this variant changes - any subset of the canonical body, deep-merged onto the base |

## What rides escrow, not a field

Anything a single source format keeps but no canonical field expresses stays in `escrow[formatId].raw`
and survives a same-format round-trip byte-for-byte. Cross-format conversion carries only the canonical
body, so one app's private data is never copied into another app's file. See the escrow rule in
[architecture.md](../architecture.md).

Rides escrow, because it has no canonical slot: RoleCall's private ids, SillyTavern extension keys with
no canonical mapping, and other app-local layout or state. The source file's own bytes ride too: a PNG
card's pixels are kept as the escrow entry's `sourceMedia` carrier and served as the entity's portrait
(see architecture.md, "Binary carriers").

Does NOT ride escrow, because it is modeled: authored on-card behavior is first-classed in the
`behavior` field (a `CharacterBehavior`: regex scripts, trigger scripts, virtual script, background
markup, and so on). It is carried as editable data, re-emits only on its own format's wire, and is
never executed by the converter or editor.

## See also

- [architecture.md](../architecture.md): the canonical model, escrow, hub-and-spoke, the adapter contract.
- [entities/lorebook.md](lorebook.md): the canonical lorebook superset, linked from `knowledgeRefs`.
- [entities/regex.md](regex.md): the regex/script entity, linked from `behaviorRefs`, and the `RegexScript` card twin.
- [concepts/character-book.md](../concepts/character-book.md): how an embedded `character_book` is extracted and re-embedded.
- [formats/README.md](../formats/README.md): the coverage matrix of every format and the fields it produces.
