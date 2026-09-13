---
id: reference/platforms/marinara/conversation-mode
title: Marinara Conversation Mode authoring
audience: user
summary: Conversation Mode profiles, schedules and autonomous messaging, custom emojis stickers GIFs, calls clips, selfies, and table games as authored Conversation content.
tags: [platform, marinara, conversation, schedules, emoji]
related: [reference/platforms/marinara/characters, reference/platforms/marinara/README]
---

# Marinara Conversation Mode authoring

Sources at pin `b7545a63e7e264a1cd9eeea1a5490d50c08ddb29`: `conversation/profiles.md`,
`getting-started.md`, `schedules.md`, `emoji-stickers-gifs.md`, `calls.md`, `selfies.md`,
`table-games.md`. Conversation Mode is messenger-style chat distinct from Roleplay and Game.

## Profiles (Display Name, About Me, Behavior)

Covered fully under [Characters](characters.md#convo-tab-conversation-mode-only): Convo Display Name
(declare-on-card checkbox for characters), About Me defaults and per-chat overrides, update_about_me tool
scopes, Convo Behavior insertion modes, and Conversation-only macros.

## Getting started boundary

Conversation is the messenger-style mode for continuing relationships. Conversation-only state includes
profiles, presence, schedules, autonomous messages, reactions, selfies, calls, and table games; none of
it applies in Roleplay or Game merely because the same card is reused.

The new-chat wizard has four authored steps:

1. **Name & Connection** chooses the chat label and saved text-generation connection.
2. **Prompt Preset** chooses the Conversation prompt.
3. **Persona & Characters** assigns a persona and one or more characters.
4. **Automation** starts Autonomous Messages on and Generate Schedules off.

When optional agent packages contribute commands, Automation exposes a master **Commands** switch and up
to 17 per-family toggles. Families include schedule updates, cross-posting, selfies, memories, scenes,
music, haptics, connected-chat influence and notes, calls, reactions, and the six table games. The master
switch gates all families even if their individual toggles remain selected. These are model-driven hidden
actions, not slash commands the user types.

The user's global presence can be Active, automatic or manual Idle, Do Not Disturb, or Invisible, with a
120-character activity. Do Not Disturb suppresses autonomous messages; Idle does not. Characters may add
emoji reactions when Reactions is enabled. Provider installation details remain outside this collection.

## Schedules and autonomous messaging

Chat Settings → Autonomous Messaging (Conversation only):

- **Autonomous Messages** toggle (default on in new-chat wizard): characters may message first.
- **Chat Check-In Cap**: Default talkativeness-based ceiling (80+ → 8/day, 60-79 → 6, 40-59 → 5, 20-39 →
  3, below 20 → 2) or numeric positive whole-number ceiling for the whole chat; character schedule limits
  can only lower, not raise, the chat cap.
- **Schedules** toggle (default off): first enable generates weekly routines; Edit schedules / Generate /
  Regenerate; per-character editor with days, routine profile summary (Generate/Refresh; stale note after
  edits), and per-character daily caps that cannot exceed the chat cap.
- Per-character **Tuning**: Rare/Quiet/Balanced/Social/Very frequent, with Balanced default; Wait before
  checking in 15-360 minutes, default 120; Morning, Goodnight, Meal breaks, After busy, and Long absence
  moments, all enabled initially.
- **Advanced timing**: Daily safety limit Default or 1-8, Away delay 0-120 minutes with blank random 1-3,
  and Busy delay 0-120 with blank random 2-5.
- Schedule AI can Rewrite, Adjust, Vary, or Repair a draft week from guidance. Nothing changes until
  **Save schedule**. Daily blocks carry Online/Away/Busy/Offline, time range, and activity; Offline never
  initiates messages and Busy waits three times longer.
- **/status** applies or clears a temporary character status without rewriting the saved schedule.
  User presence is global; manual status disables automatic Idle until Active is selected again.

## Custom emojis, stickers, and GIFs

Conversation input **Emoji, GIFs & stickers** panel (Roleplay/Game only get plain emoji):

- Custom emoji names: 1-32 chars, lowercase letters/numbers/underscores only; max 256 by 256; unique names;
  animated GIF allowed as emoji; shortcode `:name:`.
- Upload/rename/delete/export/import in edit mode. Export writes `marinara-custom-emojis.json` with image
  data; import skips collisions and invalid names or dimensions. Deleting leaves old messages as text
  shortcodes.
- Stickers use the same lifecycle with a 512 by 512 limit. **Send & reply** posts immediately;
  **Add to message** inserts `sticker:name:` for more prose.
- GIFs use live Giphy search and require a configured key; without one the tab shows setup. The fixed
  mature rating cannot be changed and no offline or safe-only source exists.
- Gallery images may be tagged as profile-scoped emoji or stickers without copying the source image.
- Per-chat selection preferences are Semantic (local embedder, random fallback), Random, or Tool-call
  (connection required; semantic fallback; skipped for multi-speaker group turns). Max offered defaults
  to 20 of each, range 1-100. Reactions use only the global emoji pool.

## Calls and clips

Calls are an optional Conversation-only agent package. Starting any call requires per-chat
**Audio/Video Calls** plus the global **Call Audio Pipeline**, even for typed or listen-only use. TTS is
optional; a participant without a resolved voice becomes text-only.

Audio input modes are Mic recording + Local Whisper (default), browser speech recognition with Whisper
fallback, manual system dictation, and provider-native audio/video. Camera and screen input works only
with provider-native mode. Local Whisper Tiny is the default download; Base trades more memory for
accuracy. Uninstalling Calls deletes downloaded Whisper models and their selection.

Per-chat defaults: Audio/Video Calls off, character-initiated Calls command on, and bracketed voice cues
on. Global defaults: Call Audio Pipeline, camera/screen, Character video presence, Automatic clip
generation, and Custom clips off. A user may start from the phone button; incoming calls always require
Answer or Decline and are never auto-answered. Active calls persist as a floating popout while navigating.
The call chat supports text and the Conversation media picker, but not file attachments.

The soundboard ships Soft Chime, Tap, Sparkle, and Pop. User sounds accept mp3, wav, ogg, webm, or m4a up
to 8 MB. Character volume is 0-100 and browser-saved.

Character Video Presence uses per-character Sprites > **Clips**, not Gallery Videos. Standard reusable
clips are Idle, Talking, Laughing, Angry, Crying, and Sighing. Automatic generation creates only missing
Idle and Talking clips; reaction and custom clips remain manual. Turning video presence off also disables
automatic and custom clips. Call-end summaries record the call in chat history rather than preserving a
separate portable call artifact.

## Selfies

Selfies are Conversation-only image events supplied by the optional Illustrator package. Commands and
**Generated Selfies** must be on. Each chat owns:

- **Selfie Connection**, initially None and required before generation.
- **Prompt Model**, default Main chat model.
- **Image Style**, default global Style Profile.
- **Send Avatar References**, off by default and provider-dependent.
- **Attach Card Appearance**, off by default.
- **Resolution**, available after connection selection and defaulting to 896x1152; other presets are
  512x512, 512x768, 768x768, 768x1024, and 1024x1024.

A character can choose to send a selfie through its hidden command. The user can request one from Gallery
and choose a character in group chats. When Expose media prompts before sending is enabled, the compiled
prompt is editable and Cancel sends no image request. Every completed selfie consumes one request from
the selected image connection. Selfies are not Roleplay scene backgrounds.

## Table games

Six optional Conversation-only packages provide UNO, Chess, Texas Hold'em Poker, 8-Ball Pool,
Tic-Tac-Toe, and Rock-Paper-Scissors. Each installed package exposes a slash command, chat-phrase
recognition, and an independently gated character invitation command. Installation takes effect without
restart. One game may be active per chat; starting another replaces existing state. At least one
character is required.

- **UNO** seats 2-10. All characters and You go first default on; five house rules default off; starting
  hand defaults 7 in range 1-10; missed-UNO penalty defaults on.
- **Chess** is one-on-one. Opponent defaults to the first character; color defaults Random.
- **Poker** seats 2-8. House dealer is silent by default; starting stack 1000, small blind 10, blind
  doubling 0/never, hand limit 0/until one stack remains.
- **8-Ball Pool** is one-on-one with optional announcer, Race to 1/3/5, and You/Random/Them first break.
- **Tic-Tac-Toe** chooses opponent and X/O/Random; X moves first.
- **Rock-Paper-Scissors** chooses opponent and best of 3/5/7 with simultaneous reveal.

Boards enforce legal state and characters narrate their moves through the normal chat connection.
Early End/Resign confirms where documented, deletes game state, and records no winner. Disabling a
character command stops autonomous invitations but does not disable installed slash commands or the
"let's play" phrase path. This state is distinct from Game Mode party, HUD, and save systems.

## Hoplight

Conversation Mode is a Marinara product surface. Hoplight does not host schedules, call media, or emoji
libraries unless a future adapter exists.
