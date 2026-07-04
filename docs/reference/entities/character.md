# Entity: character

The canonical character superset. Source of truth for the types: `src/entities/character/schema.ts`.
A `CanonicalCharacter` is `CanonicalEntity<"character", CharacterBody>`. This page documents what every
field in `CharacterBody` *means* and which formats produce it.

`CharacterBody` groups fields into eight always-present sub-objects plus three optional ones:

```
identity  persona  prompts  greetings  examples  media  attribution  discovery
                        presentation?   knowledgeRefs?   behaviorRefs?
```

Grouping keeps related fields together and mirrors how a card is authored, not how any one app happens
to store it.

## identity

Who the character is.

| Field | Type | Meaning | Formats |
| --- | --- | --- | --- |
| `name` | `string` | The canonical character name. `{{char}}` resolves to this. | all |
| `nickname` | `string?` | A display-name override that does **not** change the canonical name (Risu/Backyard `aiName`, CCv3 `nickname`). | Risu, Backyard, CCv3 |
| `tagline` | `string?` | Short one-liner / creator comment. | some |
| `description` | `string?` | The main description / persona block (CCv2/v3 `description`). The largest and most important prompt field. | all |
| `characterVersion` | `string?` | Creator's version string for the card (CCv2/v3 `character_version`). | CCv2/v3 |

## persona

How the character behaves and looks.

| Field | Type | Meaning | Formats |
| --- | --- | --- | --- |
| `personality` | `string?` | Personality summary (CCv2/v3 `personality`). | most |
| `scenario` | `string?` | The situation / setting the chat opens in (CCv2/v3 `scenario`). | most |
| `appearance` | `string?` | Free-text physical description, kept separate for image-gen (Agnai-only; other formats fold it into `description`). | Agnai |
| `structured` | discriminated union | Structured persona encoding that preserves attribute maps (Agnai `persona.kind` + attributes: W++, square-bracket, boostyle). `{ kind: "text" }` carries no attributes; every attribute-map kind requires its attributes, so illegal states cannot be represented. | Agnai |

## prompts

Instruction-layer text sent to the model.

| Field | Type | Meaning | Formats |
| --- | --- | --- | --- |
| `systemPrompt` | `string?` | The card's system prompt (CCv2/v3 `system_prompt`). | CCv2/v3, Risu |
| `postHistoryInstructions` | `string?` | The "jailbreak" / post-history instructions slot in SillyTavern (CCv2/v3 `post_history_instructions`). | CCv2/v3 |
| `depthInjections` | `DepthInjection[]?` | Text injected at a fixed depth in the chat (see below). | RoleCall, CCv3 depth prompt |
| `prefill` | `string?` | Assistant-response prefill, prepended to the model reply (Agnai; common with Claude). | Agnai |

### DepthInjection

| Field | Type | Meaning |
| --- | --- | --- |
| `text` | `string` | The injected text. |
| `depth` | `number` | How many messages from the end to inject at. |
| `role` | `"system" \| "user" \| "assistant"?` | Which role the injection speaks as. |
| `origin` | `"depth_prompt" \| "rolecall_details" \| "worldinfo"?` | Which source mechanism produced it, so it re-emits to its original home on export. |
| `enabled` | `boolean?` | Creator toggle; `undefined` means enabled. |

## greetings

The opening messages.

| Field | Type | Meaning | Formats |
| --- | --- | --- | --- |
| `firstMessage` | `string?` | The primary greeting (CCv2/v3 `first_mes`). | all |
| `alternateGreetings` | `Greeting[]?` | Swipeable alternate openings. Each is `{ text, title? }`; the optional `title` preserves RoleCall's per-greeting names. | CCv2/v3, RoleCall |
| `groupOnlyGreetings` | `Greeting[]?` | CCv3 group-chat-only greetings, distinct from `alternateGreetings`. | CCv3 |

## examples

| Field | Type | Meaning | Formats |
| --- | --- | --- | --- |
| `exampleMessages` | `string?` | Example dialogue (CCv2/v3 `mes_example`). | most |

## media

Images attached to the card.

| Field | Type | Meaning | Formats |
| --- | --- | --- | --- |
| `portrait` | `MediaAsset?` | The primary portrait. | all |
| `assets` | `MediaAsset[]?` | Extra images: expression/outfit/pose packs (Risu `.charx` assets, RoleCall sprites). | Risu, RoleCall |

### MediaAsset

| Field | Type | Meaning |
| --- | --- | --- |
| `role` | `"portrait" \| "emotion" \| "outfit" \| "pose" \| "background" \| "other"` | What kind of asset it is. |
| `name` | `string?` | Machine name. |
| `label` | `string?` | Human label for an expression/outfit/pose variant. |
| `primary` | `boolean?` | The primary asset of its role. |
| `ref` | `string` | Reference into the entity's asset store, or a data URI. |
| `mime` | `string?` | Asset mime type. |

## attribution

Credit and provenance.

| Field | Type | Meaning | Formats |
| --- | --- | --- | --- |
| `creator` | `string?` | Card creator (CCv2/v3 `creator`). | CCv2/v3 |
| `originalCreator` | `string?` | Original creator, when adapted. | some |
| `source` | `string[]?` | Source references (CCv3 `source`). | CCv3 |
| `sourceUrl` | `string?` | Canonical/origin URL (RoleCall `source_url`). | RoleCall |
| `license` | `string?` | License string. | some |
| `creatorNotes` | `string?` | Single-language creator notes (CCv2/v3 `creator_notes`). | CCv2/v3 |
| `creatorNotesMultilingual` | `Record<string,string>?` | Localized creator notes, keyed by ISO 639-1. CCv3 prefers this. | CCv3 |
| `createdAt` / `updatedAt` | `number?` | Unix seconds. | some |

## discovery

How the card is found and categorized.

| Field | Type | Meaning | Formats |
| --- | --- | --- | --- |
| `tags` | `string[]?` | Free-text tags. | most |
| `genre` | `string?` | Genre. | some |
| `fandom` | `string?` | Fandom / source work. | some |
| `rating` | `"all-ages" \| "mature" \| "explicit"?` | Explicit content rating, kept out of free-text tags. RoleCall grades this (all_hours / late_night / after_dark); a boolean `nsfw` maps to all-ages/explicit. | RoleCall, CCv2/v3 |
| `contentWarnings` | `string[]?` | Optional trigger/content warnings, card-portable. | some |

## presentation (optional)

The casting-card presentation layer: a creator's visual identity for the character. Formats without a
presentation concept simply omit it.

| Field | Type | Meaning | Formats |
| --- | --- | --- | --- |
| `accentColor` | `string?` | Signature accent color. | RoleCall |
| `gradientColors` | `string[]?` | Gradient palette. | RoleCall |
| `palette` | `Swatch[]?` | Named color swatches (`{ label?, name?, hex }`). | RoleCall |
| `background` | `Background?` | Curated background, possibly a video (`{ ref, overlayOpacity?, videoPlaybackRate? }`). | RoleCall |
| `fieldOrder` | `string[]?` | Creator-chosen display order of definition fields (bento layout). | RoleCall |
| `spoilers` | `{ mode?, order? }?` | Spoiler / reveal-order config over public definition fields. | RoleCall |

## Cross-entity links

| Field | Type | Meaning |
| --- | --- | --- |
| `knowledgeRefs` | `string[]?` | Ordered ids of linked canonical **lorebooks**. An embedded `character_book` is extracted to a standalone lorebook and referenced here, then re-embedded on export. See [concepts/character-book.md](../concepts/character-book.md). |
| `behaviorRefs` | `string[]?` | Ordered ids of linked canonical regex/script entities (a future kind). |

## What rides escrow, not a field

Anything a single format keeps but no shared model expresses stays in `escrow[formatId].raw` and
survives a same-format round-trip verbatim: SillyTavern's full extension block, Risu's scripts and
module bundle, RoleCall's private ids, and so on. It is deliberately not carried across formats. See the
escrow rule in [architecture.md](../architecture.md).
