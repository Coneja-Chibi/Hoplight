---
id: reference/platforms/marinara/chats-and-interchange
title: Marinara chats and group chats
audience: user
summary: JSONL and non-reimportable Text export, bulk zip, mode-tab import, branch import reuse, reasoning-export privacy, group Roleplay/Conversation modes, disabled-member fallback, connected chats, and chat-setting ownership.
tags: [platform, marinara, chat, group-chat, jsonl]
related: [reference/platforms/marinara/data-and-interop, reference/platforms/marinara/README]
---

# Marinara chats and group chats

Source: `chats/export-import.md`, `group-chats.md`, `connected-chats.md`, `chat-settings.md` at the
Marinara pin.

## File formats

- **JSONL** (default): one message per line; **re-importable** into Marinara (and accepted for ST JSONL).
- **Text** (`.txt`): human-readable transcript; **cannot be re-imported**.

There is no separate undocumented Marinara-native chat container beyond JSONL/Text as documented.

## Single export

Open chat → Switch branch panel → **JSONL** or **Text** downloads the open chat including messages.

## Bulk export

Mode tab CONVO / RP / GM → Select chats → Export → zip of **JSONL only**, one file per selected chat of
that mode.

## Import as new chat

Chat list import (tooltip: Import SillyTavern or Marinara chat JSONL) creates a **new** chat in the
**currently open mode tab** (CONVO/RP/GM), not a mode encoded in the file. Success: "Imported N messages"
and switch into the chat.

## Import as branch

Branch panel → Import → JSONL becomes a new branch of the open chat and **reuses** that chat's characters,
persona, connection, and prompt preset.

## Reasoning in exports

Settings → Advanced → Message Tools → **Include reasoning in exports** defaults **off**. Off strips hidden
thinking from both JSONL and Text (single and bulk). On includes reasoning; leave off before sharing.

## Group chats

A chat becomes a group when two or more characters are present (no separate group button). Modes:
Conversation and Roleplay. Game Mode uses party systems elsewhere.

Create via New Conversation/Roleplay wizard with multiple characters or Add from Folder / Dice pick.
Chat Settings → Characters: add, remove, drag reorder (order matters for Sequential), eye disable without
remove. **If every character is disabled, Marinara re-enables all** as a safety fallback. Disable state is
per-chat.

### Roleplay group settings

- Mode **Merged (Narrator)** default vs **Individual**.
- Merged: optional **Color Dialogues** using character Colors tab.
- Individual **Response Order**: Sequential (list order), Smart (hidden AI pick; @mention override; may
  queue multiple with Trigger Response / empty send), Manual (Trigger Response only).
- Individual toggles: Add Turn To Prompt (default on), Name Prefix History (default off).
- Scenario Override for the group (when present) can replace card scenarios; mode-specific preset exceptions
  follow chat-settings ownership.

### Conversation group speaking

Conversation groups do not use the Roleplay Group Chat panel. By default one reply may voice several
characters, and speaker dialogue is colored automatically.

- **Reply When Mentioned** changes the group to one-character-at-a-time replies. Characters wait for an
  `@Name` mention or a manual **Trigger Response** selection. Desktop exposes that picker beside Send;
  mobile places it in the message-tools tray.
- **Character Exchanges** is off by default. When enabled, characters may talk to each other while the
  Marinara browser is open. Exchanges stop when the app closes and share the autonomous-message daily
  limit.
- Character enable/disable remains per chat. Conversation schedules and presence can further limit when
  a member initiates messages; they do not create a Roleplay Sequential/Smart/Manual response order.

## Connected chats

Connected Chats creates a deliberate one-to-one link between one Conversation and one Roleplay or Game
chat. Each chat may have only one such link. The direction is asymmetric:

- The Conversation automatically reads recent messages from the linked story chat on every turn.
- The Roleplay or Game chat does not automatically read the Conversation.
- `<influence>` sends a one-turn steer from Conversation to the next linked story turn.
- `<note>` creates a durable Conversation Note in the story chat prompt until the user deletes it.
- `<ooc>` lets a Roleplay character send text back into the linked Conversation.

This is different from **Cross-Chat Awareness**, which is on by default in Conversation and
automatically supplies recent sibling Conversation messages when the same character appears in more
than one chat. Cross-Chat Awareness requires no explicit link and matches by shared character.

Create a link from Conversation with Chat Settings > Connected Chats > **Link to Roleplay or Game**, or
from Game with **Link to Conversation**. Roleplay displays a link created from the Conversation side
but does not initiate one itself. Pickers exclude already-linked chats. Both linked chats gain a toolbar
switch. Disconnecting clears pending influences and saved notes; deleting either chat also disconnects
the pair. Story-side Chat Settings exposes individual Conversation Notes plus a confirmed, irreversible
Clear all action.

## Chat settings ownership

Chat Settings owns per-chat lorebook pins, agent enables, budgets, persona override, group modes, scoped
regex mode, tool use, autonomous messaging, and Advanced Parameters. Library cards/presets are separate
objects; chat settings do not rewrite library defaults unless a control says so. Chat Settings Presets
can capture connection, prompt preset, agents, tools, translation, memory, and Advanced Parameters, but
never copy characters, persona, lorebooks, sprites, summary, tags, scene prompt, or Roleplay Scenario
Override. The built-in Default cannot be renamed, overwritten, or deleted.

## Hoplight

Hoplight does not convert Marinara chat JSONL unless an adapter exists.
