---
id: reference/platforms/marinara/data-and-interop
title: Marinara data and SillyTavern import
audience: user
summary: DATA_DIR layout, encryption key, backup zip versus profile export/restore, and exact SillyTavern import non-transfer list, folder access rules, and wizard handling.
tags: [platform, marinara, import, backup, data]
related: [reference/platforms/marinara/README, guide/platforms/marinara]
---

# Marinara data and SillyTavern import

Sources: `data/where-data-is-stored.md`, `backup-and-restore.md`, `importing-from-sillytavern.md`.

## DATA_DIR layout

**DATA_DIR** holds all user content (default `data` beside server; Docker `/app/data`). Log line
`[storage] DATA_DIR=`. Env change needs restart.

- **`storage/`**: characters, chats, messages, lorebooks, presets, connections.
- Assets: `avatars`, `sprites`, `backgrounds`, `gallery`, `fonts`, `knowledge-sources`, `game-assets`,
  `custom-emojis`, `custom-stickers`.
- **`.encryption-key`**: decrypts stored API keys; copy with data or re-enter keys. Or `ENCRYPTION_KEY` env
  with no file. Android/iOS: use Download Backup (includes key when present).

## Backup versus profile

Settings → Advanced → Backup & Export (remote needs Admin Access secret).

| Action | Contents | Restorable |
| --- | --- | --- |
| Download Backup | Full zip: storage, settings, media, RESTORE.txt, encryption key when present | Manual / Import Profile accepts backup zip |
| Export Profile Native | Account + media (`marinara-profile.json` or zip if large) | Yes via Import Profile |
| Export Profile Compatible | Zip of plain character/persona/lore for other tools | **No** Import Profile restore |

## Restore

Imports tab → Import Profile (JSON/ZIP). Scan then confirm (cannot undo). Recent profiles match by item
identity (re-import updates in place). Very old profiles can duplicate. Missing media: amber warning, rest
imports. Secrets stripped from profile exports: **re-enter API keys and webhooks after restore**.

## SillyTavern single-file import

Settings → Imports → SillyTavern Import:

- Character JSON/PNG, Chat JSONL (always Roleplay + switch), Preset JSON, Lorebook JSON.
- Embedded character book may prompt standalone lorebook import.
- Quick buttons: all tags, regex Character only. Characters panel Import exposes tag mode and regex scope.
- Chat list import uses open mode tab (CONVO/RP/GM).

## Folder wizard access

- Loopback: no extra secret.
- Remote browser: server admin secret + Settings → Advanced → Admin Access.
- `IMPORT_ALLOWED_ROOTS`: typed paths outside roots rejected; Browse/in-app picker always allowed.

## Folder wizard stages

1. Path to ST root (`data/` or `public/` inside) → Scan Folder.
2. Choose categories: Characters, Chats, Group Chats, Presets, Lorebooks, Backgrounds, Personas. Built-in
   ST presets (`default`, `deterministic`, `neutral`, `universal-*`) start **unchecked**. Tag mode All / No /
   Existing only (default All). Regex Character only / Global.
3. Progress per item.
4. Results: counts; per-item failure lines; Done.

## Wizard handling rules

- Best-effort: one failure records warning and continues.
- Several chat files for one character import as **branches of one chat**.
- Group chats always import as **Roleplay**.
- Imported items keep **source last-changed date**, not import time.

## What does not transfer

Documented non-transfer / non-scan:

- Only the seven categories above are scanned. **Global app settings and Quick Replies are not read and
  not imported.**
- Built-in ST presets stay out unless you check them.
- Any item that fails conversion is skipped (listed in warnings).
- Secrets and non-selected categories do not come over.

## Hoplight

Hoplight hub-and-spoke conversion is not this wizard.
