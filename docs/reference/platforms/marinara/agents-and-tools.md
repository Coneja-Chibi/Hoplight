---
id: reference/platforms/marinara/agents-and-tools
title: Marinara agents, tools, and regex
audience: user
summary: Agent phases abilities result types, Memory Recall and Roleplay/Conversation summaries, custom tools Static Result Webhook Script, regex trim test apply modes depth scoped chats, Professor Mari, and maps pointer.
tags: [platform, marinara, agents, tools, regex, memory]
related: [reference/platforms/marinara/maps-and-game-content, reference/formats/marinara]
---

# Marinara agents, tools, and regex

Sources: agents/* , extending/custom-tools.md, extending/regex-scripts.md, home/professor-mari.md.

## Agents

Per-chat enable (Chat Settings). Official packages mode-limited; custom agents all modes. Copy official to
edit. Import/export packages where documented.

Phases: Pre-Generation, Parallel, Post-Processing (result types may force phase). Post optional Turn Data
Access: pre-generation injections, parallel results.

Abilities (opt-in): create/edit lorebooks (target one book), edit messages, edit trackers, frontend
styling, image generation, vectors/embeddings, main prompt edits.

Result types: Context Injection, Text Rewrite, Lorebook Update, Character Tracker, Persona Stats, Custom
Tracker, Game State, Image Prompt, Prompt Patch, Frontend Style.

Activation keywords skip irrelevant turns. Attach custom tools. Built-in inventory is dynamic (built-in-
agents.md + Marinara-Agents repo); static pages do not freeze the list.

## Memory systems (two)

1. **Memory Recall** (all modes; Game has this only, no summaries): semantic search over past messages.
   Per-chat Enable defaults: on in Conversation; on in Roleplay/Game with active Scene; else off. Embedding
   source on connection (or local sidecar/fallback). Memories for This Chat modal: chunks Vectorized /
   Waiting / Embedding unavailable; export `.marinara.json`, import merge, rebuild, clear, per-chunk forget.
   Chunks need ≥5 new messages; similarity filter may return none; small prompt budget; rebuild after model
   change. Storage continues when toggle off if embedding available. Lite may hide Memory Recall.
2. **Summaries**: Roleplay **Chat Summary** compresses old messages; Conversation **Automatic
   Summarization**. Different jobs; can combine with Memory Recall. Not "short-lived agent notes."

## Custom tools (Functions)

Presets → Functions. Name lowercase snake_case 1-100; description 1-500 for the model. Unique; reserved
built-in names blocked. Admin secret for remote manage. Export ZIP / import ZIP or JSON.

**Parameters**: name, type string|number|boolean|array|object, Required, description. Empty names dropped.
Invalid imported params can skip the tool at generation (server log only).

**Execution types** (exact):

| Type | Behavior |
| --- | --- |
| **Static Result** | Fixed string (empty → `OK`) |
| **Webhook** | POST JSON `{ tool, arguments }` to URL; reply ≤512 KB; default 60s; https only; private/localhost blocked unless admin allows; failures return error result |
| **Script** | Server JS with `args`, `JSON`, `Math`, `Date`; must return; **off by default** until `CUSTOM_TOOL_SCRIPT_ENABLED=true`; greyed card when disabled |

**Include hidden chat context** (default off) for Webhook/Script: mode, persona, characters, chat variables,
game state without AI-passed args.

Chat Settings → Enable Tool Use (off default). No explicit list = all globally enabled tools; adding any
tool restricts to that set.

## Regex scripts

Presets → Regexes. Find without slashes; Replace with `$1` and `\u`/`\U`/`\l`/`\L`; flags g/i/m/s/u/y/d;
**Trim Strings** after replace; **Live Test** (pattern only; not placement/enable/scope/depth). Macros in
find/replace/trim.

**Apply To**: AI Output and/or User Input (at least one).

**Apply Mode**: Only Display (default), Only Prompt, Both. User Input + Only Display/Both rewrites the
saved/sent message (no pure display-only for outbound user text).

**Execution Order** lower first (default auto-assigned). **Depth** Min/Max from newest=0; empty = any;
min>max blocks save.

**Specific Characters** toggle or character Advanced → Regex Scripts (save character first). Per-chat
**Scoped Regex Scripts**: Disabled (default), Exclusive, Chat; per-script toggles. Prompt-side scripts
follow generating character.

ST card import: Character only / Global; empty or unsafe patterns skipped. Safety blocks nested quantifiers,
ambiguous quantified alternatives, oversized patterns (>1000 chars), multi broad wildcards; slow run skips
that message only.

## Professor Mari

Professor Mari is the Home-screen assistant. It can explain Marinara, compare the downloadable-agent
catalog with installed packages, and create or edit characters, personas, lorebooks, themes, agents,
prompt presets, avatars, sprites, and backgrounds. Guided suggestion chips ask one focused question at a
time and fill an editable draft rather than submitting immediately. Public Fandom lookup and image work
need network or generation connections respectively.

It reads an existing item before editing it and asks for missing details. Existing-data edits save first
and then show a **Review Mari's changes** card: **Keep** confirms the new version and **Restore** replaces
it with the previous snapshot. The card expires after 10 minutes. New items normally have no Restore
card because they did not overwrite an earlier item. Character and persona editor history remains a
second recovery path.

The selected text-generation connection is remembered in the browser; sending without one opens
Connections. Attachments accept images, PDFs, and common text formats up to 20 MB, while image reading
also requires a vision-capable model. Custom Skills are named Markdown or text instruction documents
with description, enable toggle, edit, upload, and delete lifecycle. **Restart** or `/restart` archives
the current Mari chat into its separate chat history before starting fresh; Stop cancels the current
task.

Professor Mari also has an explicitly powerful repair boundary: it may inspect and change files or run
short-lived commands only inside the Marinara install folder. It cannot write directly into saved app
data through that path; saved-data changes use the reviewable application flow. Remote editing actions
require Marinara remote access. This install-folder command ability is an upstream Marinara surface, not
a capability Hoplight imports or executes.

## Maps

Hierarchical Maps has its complete authoring, save, travel, lore-link, import, archive, and Game-binding
lifecycle under [Maps and game content](maps-and-game-content.md). Agent Game State or tracker results do
not bypass that map's enable, save, current-location, and one-move rules.

## Hoplight

Hoplight currently provides Marinara regex and persona codecs for this cluster. Imported scripts remain
sealed data. Hoplight does not run Marinara custom tools, agent pipelines, Professor Mari commands, or
map updates during import.
