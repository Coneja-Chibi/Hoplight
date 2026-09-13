---
id: reference/platforms/sillytavern/chats-and-groups
title: SillyTavern chats and group configuration
audience: user
summary: SillyTavern chat file interchange (JSONL vs TXT), checkpoints, group reply strategies, generation handling modes, mute/force/auto, and scenario overrides as stored authored configuration.
tags: [platform, sillytavern, chat, group-chat, import-export]
related: [reference/platforms/sillytavern/README, reference/platforms/sillytavern/characters, reference/platforms/sillytavern/regex-and-automation]
---

# SillyTavern chats and group configuration

Chats and group chats are re-importable creative artifacts, not mere UI chrome. Primary sources at pin
`70e5e4d3c239253fca4692fe82e3936cb9c4b1b1`: `Usage/Characters/chatfilemanagement.md` and
`Usage/Characters/groupchats.md`.

## Solo versus group chats

A solo chat opens from one character card. A group chat is created with **Create New Chat Group** and
holds multiple member cards that share history while reply drafting and card-assembly rules apply.

## Chat import and export

### Import sources

SillyTavern can import chats from Character.AI (via CAI Tools extension) and from tools including
TavernAI, oobabooga text-generation-webui, Agnai, KoboldAI Lite, and RisuAI. Import formats and fidelity
depend on the source tool.

### Export as JSONL

Manage chat files lists each chat with export that produces a re-importable `.jsonl` including metadata
but excluding images and file attachments. Privacy scrubbing is the user's responsibility before share.

### Export as TXT

Plain-text download is human-readable and **cannot be re-imported**; metadata is lost.

### Checkpoints and rename

- **Create Branch** clones the chat up to a message and switches to the clone.
- **Create Checkpoint** clones up to a message, names it, and does not switch.
- Checkpoints link to the parent by chat file name. **Back to parent chat** returns from a checkpoint.
- Renaming a chat breaks checkpoint links that stored the old file name.

Default chat file names use start date/time; rename via the pencil control.

## Group reply order strategies

- **Manual**: user picks the speaker (menu or `/trigger`); empty user input can trigger a random unmuted
  member; user messages do not auto-trigger replies.
- **Natural Order**: extract whole-word name mentions from the last message (self-mentions ignored unless
  Allow Self Responses); then activate by Talkativeness (0% never unless mentioned, 100% always, default
  50%); if none activated, pick random.
- **List Order**: draft strictly by member list order.
- **Pooled Order**: pick a random member who has not spoken since the last user message; when all have
  spoken, pick randomly until the next user message.

## Group generation handling

History is always shared. Card assembly modes:

- **Swap character cards** (default): only the active speaker's card enters context.
- **Join character cards**: combine all members' cards in list order (hurts isolation; can confuse
  identity). Sub-modes include or exclude muted members. Combined fields: Description; Scenario unless
  chat override; Personality; Message examples; Character notes / Depth prompts. Join Prefix/Suffix can
  separate fields; macros and `{{char}}` / `<FIELDNAME>` replacement apply.
- Mute disables replies; Force Talk triggers one member even if muted; Auto-mode chains generations with
  a 5-second delay and disables when the user types (queued gens may continue); Allow Self Responses
  affects Natural Order self-mentions; Group Chat Scenario Override replaces each card's scenario for
  the group (branches inherit then can diverge); Peek Character Definitions edits the card itself;
  members can be added, removed, reordered.

## Hoplight boundary

Hoplight does not host SillyTavern chat runtime. Document interchange and group configuration so Kit
understands what stored artifacts mean; conversion of chat JSONL is out of scope unless a future adapter
exists. Character talkativeness remains a card field (see [Characters](characters.md)).
