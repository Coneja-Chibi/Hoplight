---
id: reference/platforms/sillytavern/characters
title: SillyTavern character authoring
audience: user
summary: Field semantics and lifecycle of SillyTavern character cards, including permanent definitions, greetings, prompt overrides, examples, metadata, lore links, and portability.
tags: [platform, sillytavern, character, card, ccv2, ccv3]
related: [reference/platforms/sillytavern/README, reference/formats/sillytavern, reference/entities/character]
---

# SillyTavern character authoring

A SillyTavern character is both a portable card and a prompt component. The card describes the role the
model should play, provides one or more openings, and may carry platform-specific behavior alongside
portable Character Card fields. Character name is the only required authoring field, but leaving other
fields empty changes how much identity and style the model receives.

Primary sources: [Characters](https://docs.sillytavern.app/usage/characters/) and
[Character Design](https://docs.sillytavern.app/usage/core-concepts/characterdesign/).

## Identity and permanent definitions

Name identifies the character and supplies `{{char}}`. Description is the broad always-present definition:
appearance, background, world facts, behavior, or any other durable context. Personality is a shorter trait
summary, and Scenario establishes the circumstances of the conversation. SillyTavern treats name,
description, personality, and scenario as permanent prompt content on every generation.

Permanent content consumes context before chat history. A large card does not become invalid, but it
leaves less room for examples, World Info, retrieved documents, and prior messages. Authors should put
stable, necessary facts in permanent fields and move conditional or situational material into World Info,
Author's Note, or depth-based injections.

The fields are prose, not a mandated mini-language. Free text, structured lists, and pseudo-dialogue are
all possible. Their actual effect depends on model behavior and the prompt template that surrounds them.
Hoplight preserves the authored strings and must not normalize one writing method into another.

## Greetings and dialogue examples

First Message is the initial assistant message in a new chat. It is not permanent context in the same
sense as the core definition, but it strongly demonstrates expected voice, formatting, pacing, and response
length. Markdown and HTML may be present as authored text.

Alternate Greetings are additional openings exposed as first-message swipes. Group chats may select among
them when initiating a conversation. A card can therefore represent several entry scenarios without
duplicating the whole character.

Example Messages demonstrate speaking and writing style. Blocks begin with `<START>` and normally label
participants with `{{user}}:` and `{{char}}:`. SillyTavern replaces the marker with the active example
separator or utility prompt. Example blocks are included only while context space remains unless settings
force retention, so they should teach style rather than carry facts required on every turn.

## Advanced definitions and metadata

Main Prompt and Post-History Instructions can override global prompts when the corresponding preference is
enabled. `{{original}}` inserts the global value inside a character override instead of replacing it
completely. These fields can materially change model instructions and must remain distinct from description
or creator notes.

Character's Note is a static in-chat injection with a depth and role. Depth zero places it after the most
recent message; larger values move it earlier in history. It is useful for persistent behavioral emphasis
whose recency matters. Talkativeness controls response probability in natural-order group chats rather
than prose style.

Creator, character version, creator notes, source references, and embedded tags are attribution or
discovery metadata. SillyTavern does not normally insert creator metadata into the model prompt. A
conversion must not fold these values into character prose merely because another platform has fewer
metadata slots.

## Lore, attachments, and platform links

A character can link a named World Info book, carry an embedded character book, or participate in chat
lore selected for one conversation. These relationships are not interchangeable. An embedded book travels
inside a compatible card; a named link depends on a separate book in the receiving installation; chat lore
belongs to a chat rather than the character.

Character-scoped Data Bank attachments are also separate. SillyTavern stores them locally and does not
export them with the character card. Treating those documents as card assets would create a false portability
promise.

Character tags support organization and filtering. Primary source:
[Tags](https://docs.sillytavern.app/usage/core-concepts/tags/).

Tags can be assigned on the card, during import of embedded tags, or through bulk edit. Groups cannot be
mass tagged. Manage Tags holds the local tag list, colors, order, and folder-like "bogus folder" modes
when enabled in UI settings. Tag backup JSON is installation-specific and not a shareable content artifact.
Embedded tags for export live under creator metadata as "Tags to Embed" (comma-separated). Import can ask
whether to create local tags, attach existing matching tags, import all, or import none. Filtering toggles
include, exclude, or ignore each tag, and multiple tags combine. Local folder organization and mutual tag
removal are library state. They are not required for a card to function and must not be rewritten into
description prose during conversion.

Character locks, chat history, favorites, and UI layout remain installation state rather than portable
character definition.

## Character expressions (sprites)

Primary source: [Character Expressions](https://docs.sillytavern.app/extensions/expression-images/)
(`extensions/Expression-Images.md` at the pin).

Expression images live under `/data/<user-handle>/characters/(character_name)/` as per-emotion files, not
as the single card avatar. Upload per emotion, or **Upload sprite pack (ZIP)** into the currently selected
character. ZIP contents must be a flat folder of correctly named files; import does not rename files to
match emotions.

Manual display: click a sprite, or `/expression-set (name)`, or a Quick Reply that runs that command.
Automatic change: Local classifier (one-time ~100 MB model download; 28-label default or 6-label via
`extensions.models.classification` in `config.yaml`), Main API LLM classification (Limited Context =
last message + instruction; Full Context = full history + card), WebLLM extension, or deprecated Extras
`--enable-modules=classify` with optional alternate classification models.

**Custom Expressions** add author-named labels; Local/Extras classifiers only know fixed label sets unless
you train a model or use LLM/WebLLM which see default plus custom labels. Supported image formats include
PNG (common with transparency), webp, and animated gifs.

**Default / Fallback Expression**: choose a fallback expression when missing, **[No Fallback]**, or
**[Default emojis]** built into SillyTavern. **Allow multiple sprites per expression** enables random
selection among images; optional **Re-roll if same sprite is used again**. Multi-image naming must start
with the expression name then a suffix separated by `.` or `-` (examples: `joy.png`, `joy-1.png`,
`joy.expressive.png`) for upload and ZIP. Manual multi pick via click or `/expression-set type=sprite`.

**Sprite Folder Override**: display name (not file name) chooses the image set; same-named characters share
sprites unless override folder under `/data/<user-handle>/characters/<folder>` is set, or `/costume Name`.
A leading `\` resolves a subfolder under the current character's sprite folder (e.g. `/costume \tracksuit`).

Portable PNG cards do not carry the full expression grid. Treat sprites as local installation assets unless
a native Marinara-style pack export is used.

## Import, export, and Hoplight boundaries

SillyTavern imports character cards from files and external URLs and exports cards for sharing. Portable
cards commonly use Character Card JSON or PNG carriers. PNG artwork and embedded data are separate layers:
the image is presentation, while the encoded card is the semantic record.

Hoplight maps portable character fields to its canonical character and keeps the complete source snapshot
in escrow. Same-format export can restore SillyTavern-specific fields that have no canonical editing
surface. Cross-format export carries only fields represented by the target platform. See
[SillyTavern format](../../formats/sillytavern.md) for the exact current field map and loss behavior.

Do not infer that every SillyTavern extension value is safe to transplant. Regex scripts, automation
identifiers, local World Info names, and installation-specific links may only work in SillyTavern. Imported
scripts remain sealed data in Hoplight and are never executed during import or conversion.
