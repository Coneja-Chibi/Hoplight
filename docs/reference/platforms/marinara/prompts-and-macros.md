---
id: reference/platforms/marinara/prompts-and-macros
title: Marinara prompts and macros
audience: user
summary: Macro rules, conditionals, preset variables, preset editor lifecycle, overrides, chat-settings presets, and exact generation parameter ranges, Send toggles, prefill, thinking tags, custom parameters, and precedence.
tags: [platform, marinara, macros, presets, generation]
related: [reference/platforms/marinara/macro-reference, reference/platforms/marinara/README]
---

# Marinara prompts and macros

Built-in names: [Macro catalog](macro-reference.md). Pin `b7545a63e7e264a1cd9eeea1a5490d50c08ddb29`.

## Macro system rules

See catalog for names. Rules: always-on in macro fields; nested resolve; Custom Tools never resolve;
left-to-right vars; setvar-in-random prepass exception; agent::TYPE last and empty until agent output;
literal unknown names; silent truncation; `/macros` live authority.

## Conditionals

`{{#if}}` / `else if` / `else` / `{{/if}}`. Operators `==` `=` `is` `!=` `is not` `>` `<` `>=` `<=`
`contains` `includes` `not contains` `not includes`. `&&` before `||`; parentheses; compact equality
lists; group blocks; truthy checks. First true branch wins.

## Preset variables

Letters/numbers/underscores names. Single-choice, boolean (one option), multi-select, multi+random pick.
Configure modal on assign; Confirm needs every single-choice filled; Boolean/multi do not block. Save as
default / Skip. Edit from chat settings pencil. Switching presets clears choices. Conversation mode does
not use section preset variables (single prompt override instead).

## Preset editor

The Presets panel supports new, JSON import, multi-select export/delete, search, four sort orders, folders,
and a starred default. Creating a preset requires a name; edits do not autosave. Leaving dirty work offers
Keep editing, Discard, or Save & close.

The editor has:

- **Overview**: name, description, author, and XML, Markdown, or None wrap format.
- **Sections**: ordered Prompt Blocks plus live markers for Character Info, Persona, Chat History, Chat
  Summary, Dialogue Examples, and Lorebook All/Before/After. Missing lore markers produce a warning.
  Without a Dialogue Examples marker, examples append to Character Info once.
- **Prompts**: Conversation and Game mode prompt fields; Roleplay is assembled from Sections.

Sections have role, enable, duplicate, delete, drag/arrow order, macro-aware content, optional group, and
Ordered or Depth-from-end placement. Groups become parent XML tags or Markdown headings. Enabled custom
agents that inject as sections appear in the add menu and insert `{{agent::TYPE}}`.

A library preset does nothing until assigned. Roleplay assignment is available from the Presets panel or
Chat Settings. Conversation and Game instead choose a preset-backed single mode prompt, then may edit it
into a chat-local **Custom** version or reset it. Game adds up to 2,000 characters of Extra instructions.
**Peek Prompt** is the authority for the fully assembled request.

## Prompt overrides

Settings > Generations exposes separate **Image Generation Prompt Overrides** and **Video Generation
Prompt Overrides**. These are reusable media-template overrides, not chat-prompt section patches. Image
templates cover registered builders such as selfies, portraits, sprites, scenes, storyboards, Game NPCs,
and Noodle posts; video templates cover scene video, call clips, and animated expressions.

Each editor selects a registered template, shows Default, Custom active, or Custom paused status, exposes
valid `${variable}` chips, renders an example preview, and warns about unknown variables. Save activates
the custom template; **Apply this override** off keeps it saved but paused; **Reset to Default** removes
it after confirmation. The override only participates when the matching media feature and generation
connection run.

## Chat-settings presets

Conversation and Roleplay, but not Game, can save a wider per-chat setup bundle. It includes connection,
prompt preset or Conversation prompt source, agents, tools, translation, Memory Recall, Advanced
Parameters, and other chat settings. It excludes chat-owned content: characters, persona, lorebooks,
sprites, summary, tags, and scene prompt.

The Chat Settings preset bar applies a bundle immediately and distinguishes matching, Custom settings,
and Missing preset states. Actions save into the selected preset, rename, Save As, JSON import/export,
and delete. Import creates a new non-default preset rather than overwriting. One preset per mode can be
starred as the default for new chats. Each supported mode also has an immutable, empty **Default** preset
that resets preset-controlled settings to system defaults.

## Generation parameters

Chat Settings → Advanced Parameters (all modes). Help: override only if you know what you are doing.

| Parameter | Range / choices | Starting value | Sent by default |
| --- | --- | --- | --- |
| Temperature | 0-2 | 1 | No |
| Max Output Tokens | no fixed upper in box | 4096 Conversation; 8192 Roleplay/Game | Yes |
| Top P | 0-1 | 1 | No |
| Top K | 0-500 (0 off) | 0 | No |
| Frequency | -2 to 2 | 0 | No |
| Presence | -2 to 2 | 0 | No |
| Reasoning Effort | None, Low, Medium, High, Xhigh, Maximum | Maximum | Yes |
| Verbosity | None, Low, Medium, High | High | No |

**Send switch** (per parameter): off omits the field entirely (provider default); on sends the shown value.
Only Max Output Tokens and Reasoning Effort start sent.

**Assistant Prefill**: optional prefix at start of AI reply; leave blank unless model needs it.

**Thinking Tags**: one wrapper per line for unusual reasoning wrappers; common think/thinking tags already
recognized for View thoughts.

**Custom Parameters**: JSON object merged into request; lowercase true/false/null. Connection-level customs
apply to all API text gen on that connection (Conversation, Roleplay, Game, Noodle, summaries, agents) and
local custom endpoints. Per-chat customs override same keys.

**OpenRouter Service Tier**: Default (no tier), Flex, Priority when connection is OpenRouter.

**Limit Context Messages**: off by default; when on, last N messages (default start 50, range 1-9999).

**Exclude Past Reasoning**: on by default; strips saved thinking from new prompts.

**Image Captioning**: off by default; describes attachments via Captioning Connection for non-vision models.

**Save as Connection Default**: writes current Advanced Parameters onto the connection for new chats.

Precedence: baseline → connection defaults → chat Advanced Parameters / custom keys (chat wins on conflict).

## Hoplight

Macros and generation controls are not executed at import.
