---
id: reference/platforms/marinara/visual-and-css
title: Marinara visual assets and card CSS
audience: user
summary: Card CSS Creator Notes scoping Exclusive/Chat modes, style profiles grammar and precedence, scene backgrounds, animated expressions, and Roleplay background lifecycle.
tags: [platform, marinara, css, style-profiles, backgrounds]
related: [reference/platforms/marinara/sprites-and-galleries, reference/platforms/marinara/README]
---

# Marinara visual assets and card CSS

Sources: `appearance/card-css-theming.md`, `media/style-profiles.md`, `media/scene-backgrounds.md`,
`media/animated-expressions.md`, `roleplay/backgrounds.md`.

## Card CSS theming

Embed `<style>` blocks in character/persona **Creator Notes**. Chat Settings → **Card Theming** appears
only when an **active character** in the chat has CSS (persona CSS alone does not show the control).

Modes: **Disabled** (default), **Exclusive** (each character's CSS only its messages), **Chat** (all card
CSS affects whole chat area). Engine sanitizes dangerous CSS, scopes to chat, injects over app message
styles. Selectors must stay under `[data-card-css]` chat surfaces (message bubble, name, content). Linear
Conversation layout has no `.mari-message-bubble`; Bubbles/Roleplay do. Forbidden: styling outside chat,
breakout to app chrome, unsafe constructs (stripped). Export ownership: CSS rides Creator Notes on
**Marinara Native** character/persona export; compatible CCv2/PNG does not preserve custom CSS as a first-
class field.

## Style profiles

Settings → Generations → Image Generation → Style Profiles. Ten built-ins: Off, Auto (default), Anime,
Danbooru/Illustrious, Realistic SDXL, Photorealistic, Cinematic, Digital Painting, Painterly Fantasy,
Z-Image Turbo Narrative. Clone creates editable copy and sets it default; Reset restores built-ins; Delete
user clones only when more than one profile exists. Prompt grammar: Hybrid, Danbooru tags, Tags, Natural
language. Style text, positive/negative tags, per-image-kind tags (avatar, portrait, selfie, background,
illustration, sprite). Test bench validates. Precedence: app default → connection override → chat override
(later wins). Cleaning regenerates tags from style text.

## Scene backgrounds and Roleplay backgrounds

Scene background generation works in Roleplay and Game, not Conversation. From Gallery, **Background**
builds a 1280x720-by-default prompt from current scene context such as setting, location, weather, and
time, generates through the Illustrator agent's image connection or image default, saves the result to
the background library, and applies it immediately. A missing connection fails before generation.

Gallery separates Images and Videos and conditionally exposes Illustrate, Selfie, Background, Video,
Create/View storyboard, and Browse Images. Uploaded images join the chat gallery. Per-image actions open,
pin, download, animate, copy a saved prompt, or confirm deletion. With **Expose media prompts before
sending**, Review Image Prompt exposes positive and negative prompts, kind, size, and character count;
empty prompts disable Generate, and Cancel stops the request.

The background library accepts JPG, PNG, GIF, WebP, and AVIF up to 20 MB. User backgrounds can be renamed,
tagged, and deleted; built-in game assets can be selected but not mutated. Roleplay can pin one background
per chat or remove it to return to the default. Its optional Background agent runs after replies and
selects from every library folder; it never generates. Manual generation is a separate Illustrator
operation. Roleplay cross-fades backdrop changes and falls back to a solid color without generation.

## Animated expressions

Animated expressions are short looping GIF portrait sprites selected like still expressions by the
Expression Engine. Generation needs both a Video Generation connection and `ffmpeg`. From a character or
persona Facial Expressions tab, **Generate animated portraits** switches the sprite generator to one
9:16 expression at a time, takes an appearance description and chosen expressions, then converts each
video independently so successful results survive partial failure.

Settings control duration from 1 to 8 seconds, default 3; output is 512 pixels wide. GIF output skips
static sheet slicing, frame cropping, and background cleanup. The transparent-style option only adds a
prompt hint and cannot guarantee transparency. Prompt exposure pauses for review of each expression.
Missing `ffmpeg` or video connection fails explicitly; some Android/Termux builds that cannot load the
image library disable sprite generation entirely.

## Hoplight

Native Marinara export may carry CSS in Creator Notes and media folders. Compatible Tavern PNG does not
prove preservation of Marinara-specific CSS, background libraries, animated expressions, or media
generation settings, and Hoplight does not execute those assets during import.
