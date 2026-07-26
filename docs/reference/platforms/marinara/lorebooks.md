---
id: reference/platforms/marinara/lorebooks
title: Marinara lorebooks
audience: user
summary: Complete Marinara lorebook lifecycle: categories, global versus linked mutual exclusion, overview defaults, entry types keys position timing recursion, folders, budgets and skip reasons, semantic search, and export loss.
tags: [platform, marinara, lorebook, world-info]
related: [reference/platforms/marinara/README, reference/entities/lorebook]
---

# Marinara lorebooks

Primary sources at `b7545a63e7e264a1cd9eeea1a5490d50c08ddb29`: `lorebooks/overview.md`, `entries.md`,
`linking-to-characters.md`, `semantic-search.md`, `token-budgets.md`, `import-export.md`.

## What a lorebook is

A lorebook (World Info) holds entries with keys and content. Matching recent chat injects content into the
prompt. Keyword matching needs no API. Semantic matching is opt-in per book.

## Library panel

New, Import, Select multi-export/delete, search (name, description, linked names, tags), sort A-Z/Z-A/
Newest/Oldest/Token Budget, Copy, Delete, library folders (separate from in-book entry folders), OFF badge
when disabled, picture upload.

### Categories

Each book has one category label: World, Character, NPC, Spellbook, Other (Overview may label Other as
Uncategorized). Tabs: All, Active (relevant to open chat), and per-category. Category does not change
activation rules.

## Activation (how a book becomes active)

1. **Global** (Overview switch): every chat while enabled. Global and character/persona links are
   **mutually exclusive**; enabling Global clears links on save.
2. **Linked** to character or persona: auto-activates in chats that include that entity.
3. **Pinned** to one chat via chat Settings → Lorebooks.

**Enabled** must be on or no entries fire even if global/linked. Chat Settings can edit the active list.

## Overview defaults

| Setting | Default | Notes |
| --- | --- | --- |
| Scan Depth | 2 | Recent messages for keywords; 0 = whole chat |
| Token Budget | 2048 | Per-book token cap; 0 = unlimited |
| Entry Limit | 100 | Max entries per book per prompt; range 1-1000 |
| Max Depth | 3 | Recursive passes when Recursive on; range 1-10 |
| Enabled | on | Whole-book kill switch |
| Recursive | off | Activated text can trigger more entries |
| Vectors | off | Allow semantic embeddings for this book |

## Entries

Autosave with Autosaving/Saving/Saved; failed save keeps text and retries. Name required. Duplicate and
confirm Delete. Folders group entries; folder enable/clone/delete are folder-level controls (disabled
folders do not contribute). Multi-select copy/move/delete. Sort by Order, Entries, Name, Tokens, Keys,
Newest, Oldest.

### Content and keys

- **Primary Keys**: chip keywords; default case-insensitive substring.
- **Content**: injected text; macros allowed; live token estimate.
- **Secondary Keys**: Selective only.
- **Description**: Knowledge Router only; never main AI content.

Matching toggles: Whole Words (off), Case Sensitive (off), Regex (off; safety timeout; slow patterns fail
that scan). Keyword test tools may not prove live chat windows; rely on Active Context for live results.

### Types

- **Normal**: primary keys match.
- **Constant**: no keyword; still respects timing, probability, filters, budgets.
- **Selective**: primary + secondary logic AND Any / AND All / NOT Any / NOT All.

### Position, depth, order, probability

Position Before chat / After chat / @ Depth (default depth 4). Order default 100 (lower earlier).
Probability default 100%.

### Timing

Sticky, Cooldown, Delay in messages; Ephemeral in activations; 0 = off.

### Additional entry flags (from entries guide)

Role for @ Depth insertion, group/tag filters, Locked, No Vector (skip semantic), context filters, and
per-entry Recursion (whether this entry's text can chain) are entry-level controls distinct from
book-level Recursive.

## Budgets and skips

Two caps: per-book Token Budget and chat-wide Lorebook Token Budget (chat Settings, default 8192, 0 =
unlimited). Entry Limit is a count cap separate from tokens. Trim order: Constants first, then matches on
latest message, then remaining injection order. After a skip, later smaller entries may still fit. Active
Context lists skips with reasons: lorebook budget, chat budget, or both; shows keywords, size, budget
used; may suggest Knowledge Retrieval/Router agents.

Recursion does not bypass budgets or Entry Limit.

## Semantic search

Requires embedding source (connection embedding model e.g. `text-embedding-3-small`, or Local Model
sidecar when installed; Lite hides local). Vectors switch per book. Settings: Query Messages default 10
(0 = full history), Score Threshold default 0.3 (calibrated against neutral passages), Vector Limit
default 10 (semantic matches only). Vectorize missing / re-vectorize with confirm. Dimension mismatch or
missing vectors fail quietly for those entries (keywords still work). Semantic and keyword matches share
budget priority; configured order breaks ties.

## Linking and ownership

- **Linked** books are shared library objects attached to characters/personas; editing the library book
  affects every chat that activates it.
- **Embedded** books travel inside a character card when the export includes them; character import can
  promote an embedded book to a **standalone linked** Marinara lorebook or leave it only inside the card.
- **Chat-pinned** books are chat-owned activation, not library membership.
- Global vs linked mutual exclusion remains: Global clears links on save.

Manage embedded books from character Lorebook tab and export formats (Native keeps attached lorebooks).

## Import / export

Detects Marinara native vs foreign World Info / V2 character-book JSON automatically (`.json`).

- Import single or bulk drop; per-file success/error rows; **created date preserved from source file**.
- Export: **Marinara Native** `.marinara.json` (folders + every field) or **Compatible JSON** folderless
  World Info (Marinara-only details dropped).
- Bulk export: Select → Export → `marinara-lorebooks.zip` **always Native**.
- ST folder wizard can pull lorebooks with other categories (see data-and-interop).

### After import

Keywords work immediately. **Semantic search requires re-vectorization** after import (Vectors + Vectorize
missing / Re-vectorize). Old vectors from another install are not assumed valid.

## Hoplight

Canonical lorebook mapping is adapter-specific. Do not claim Marinara budgets/recursion/vectors round-trip
through every format.
