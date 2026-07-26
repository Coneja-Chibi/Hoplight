---
id: reference/platforms/marinara/sprites-and-galleries
title: Marinara sprites, galleries, colors, and stats
audience: user
summary: Expression and full-body sprites with folder AI and cleanup, gallery formats and scoped emoji stickers, Name Display Dialogue Highlight and Message Box colors, character pools attributes and persona status bars.
tags: [platform, marinara, sprites, gallery, stats, colors]
related: [reference/platforms/marinara/characters, reference/platforms/marinara/visual-and-css]
---

# Marinara sprites, galleries, colors, and stats

Sources: `characters/sprites.md`, `galleries.md`, `colors-and-stats.md`.

## Sprites

Facial Expressions vs Full-body (Clips = calls). Display Roleplay/Game only; assets attach anytime.

Upload single (name + file; transparent PNG preferred); Quick add names; Upload Folder (basename =
expression; `happy_01` variants of happy); Frame/Download/Replace/Delete; Delete All Expressions/Full-Body.

AI Generate: image connection; animated portraits need video; references; Appearance required; transparent
via native alpha or adaptive matte; Match existing expression names for full-body; review/crop before save;
Android may disable with reason.

Cleanup editor: erase/paint, undo/reset, dark/light/checker. Arrange mode positions in Roleplay/Game.

## Galleries

Ordered media for character/persona. Upload common image formats; optional video; download/delete per item.
Custom emoji/sticker tagging from gallery with **scope** (profile vs chat) and naming/size rules matching
Conversation custom media limits. Failure: oversized or invalid format rejected at upload. Galleries are
not expression grids and not scene backgrounds.

## Colors (exact fields)

Leave empty for theme defaults. Extract Colors from Avatar disabled until avatar exists.

1. **Name Display Color**: name color; supports CSS gradients e.g. `linear-gradient(90deg, #f59e0b, #ef4444)`.
2. **Dialogue Highlight Color**: quoted dialogue text color e.g. `#ffd700`.
3. **Message Box Color**: bubble background; prefer semi-transparent `rgba(..., a)`.

Name color also tints sidebar tabs (character) or persona pickers (persona). Dialogue color works with
quote styles; optional bold from Settings. Message box applies Conversation and Roleplay.

## Stats

Values are **starting defaults** for new chats; agents change them during play.

**Character**: Enable RPG Stats → **Pools** (HP/MP 100/100 default, add/remove, color) and **Attributes**
(STR DEX CON INT WIS CHA default 10). Off = nothing shown or sent.

**Persona**: Enable Persona Stats → status bars Satiety/Energy/Hygiene/Mood 100/100; Enable RPG Attributes
→ same pools/attributes as characters.

Agents: Character Tracker updates character RPG and persona RPG attributes; Persona Stats agent updates
status bars. Without agents, defaults stay fixed. HUD shows enabled stats as gradient bars.

## Hoplight

Compatible card exports drop sprites/galleries/colors/stats.
