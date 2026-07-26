---
id: reference/platforms/marinara/characters
title: Marinara characters and personas
audience: user
summary: Marinara character and persona fields, Convo tabs, version lifecycle, import tag/regex/lorebook choices, bulk export, and agent-proposed card updates.
tags: [platform, marinara, character, persona, card]
related: [reference/platforms/marinara/README, reference/formats/marinara]
---

# Marinara characters and personas

Sources: `characters/creating-and-editing-characters.md`, `personas.md`, `choosing-your-persona.md`,
`import-export.md` at commit `b7545a63e7e264a1cd9eeea1a5490d50c08ddb29`.

## Character create and editor

New requires Name; optional avatar. Tabs: Metadata, Card, Convo, Lorebook, Sprites, Gallery, Colors,
Stats, Advanced. Unsaved leave: Keep editing / Discard / Save & close. Save disabled until dirty; states
Uploading/Embedding/Saving. Header: Favorite, Export, Import as persona, Duplicate, Delete.

### Metadata

Character ID (copy after save), Name (`{{char}}`), Phonetic name (TTS + macros), Creator, Version,
Talkativeness 0-100% default 50 (group speak rate), Tags (comma multi-add, remove all), Creator Notes
(never AI), Version history panel, avatar crop.

### Card

Description, Personality, Backstory, Appearance (also seeds AI avatar prompt), Scenario, First Message,
Alternate Greetings (reorder/remove), Example Dialogue (`<START>`, `{{user}}`/`{{char}}`).

### Convo tab (Conversation Mode only)

Source: `conversation/profiles.md`. Fields are never used in Roleplay or Game.

- **Convo Display Name**: Conversation-mode display name; blank uses card name; updates existing messages
  immediately. Characters only: **Declare this name on the card in the prompt** requires a display name and
  injects a short mapping line into card text for the model.
- **About Me**: short bio; by default every present character/persona About Me is auto-listed into the
  Conversation prompt each turn. Professor Mari can write/revise About Me with Keep/Restore. Manual edits
  show Revert to pre-edit text.
- **Chat-specific About Me override**: open profile popout from avatar/name in Conversation chat; badge
  Default vs Chat-specific; Edit/Save/Clear/empty-save clears override; characters also show Online/Away/
  Busy/Offline status in the popout.
- **update_about_me tool**: off by default; enable Tool Use and add the tool. Public scope changes global
  About Me with approval; Chat scope is private to the conversation.
- **Convo Behavior**: free-text directive. **Insertion** modes: Constant after card (default), Constant
  before card, Append/Prepend/Replace post-history, or Only where `{{convo_behavior}}` is placed.
- Macros (Conversation only): `{{convo_display}}`, `{{char_about}}`, `{{persona_about}}`,
  `{{convo_behavior}}`. Auto About list and Behavior insertion run without macros; macros place values in
  custom prompts.

### Advanced

System Prompt (does not replace main system prompt; mode-specific insertion), Post-History Instructions
(near generation), Depth Prompt (default depth 4, roles System/User/Assistant). Apply in Conversation,
Roleplay, VN, Game; presets do not disable PHI/Depth.

### Version history and agent updates

Version history stores prior saves for restore. Agents (including Professor Mari) may propose card updates
that apply then expose Keep/Restore review; treat as reversible product workflow, not silent overwrite.

## Personas

Personas panel: full library, New, Import, Select bulk, search, sort A-Z/Z-A/Newest/Oldest/Tokens, folders,
All/Active/Inactive and tags filters. At most one **active** global persona; new/import/duplicate never
auto-activate. Chat can override persona separately (choosing-your-persona guide).

Persona editor tabs: Metadata (Persona ID, crop, Name, Creator, Phonetic, Title/Comment, Version default
1.0, Tags, Creator Notes, Version history), Card (same five prose fields + macros), Convo, Lorebook,
Sprites, Gallery, Colors, Stats. Header: Export persona, **Add persona as character**, Duplicate, Delete.
Unsaved leave banner same as characters.

`{{user}}` uses chat persona if set else active persona else generic `User` with no persona details.

## Import / export

Formats: `.json` (CCv2), `.png` (embedded), `.charx` (CCv3 zip), `.marinara` / `.marinara.json` (richest).
Batch drop supported.

Import options for whole batch:

- Tags: All (default) / No tags / Existing only.
- Regex: Character only (default) / Global Presets → Regexes.
- Embedded lorebook: Import Lorebook (standalone linked) / No Import (keep only in card).

Export single: Marinara Native (metadata, sprites, gallery, attached lorebooks), Compatible JSON CCv2,
Compatible PNG. Compatible drops Marinara-only extras. Bulk select → zip of Native only
(`marinara-characters.zip`).

ST folder import is Settings → Imports (see data-and-interop).

## Hoplight

No dedicated marinara character codec; Tavern-shaped cards often use SillyTavern adapters. Persona/regex
Marinara codecs exist. Do not invent sprite/gallery fidelity on compatible PNG export.
