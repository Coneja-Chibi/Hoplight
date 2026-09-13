---
id: reference/platforms/marinara/macro-reference
title: Marinara documented macro catalog
audience: user
summary: Exhaustive catalog of every built-in prompt macro named by the pinned Marinara Engine macros guide, with signatures, aliases, returns, scopes, and failure modes.
tags: [platform, marinara, macros, catalog]
related: [reference/platforms/marinara/prompts-and-macros, reference/platforms/marinara/README]
---

# Marinara documented macro catalog

Every name below is taken from `Pasta-Devs/Marinara-Engine` docs `prompts/macros.md` at commit
`b7545a63e7e264a1cd9eeea1a5490d50c08ddb29`. Built-in names are case-insensitive. Fields that support
macros are listed on [Prompts and macros](prompts-and-macros.md). The in-app Macro Reference and
`/macros` are live-engine authorities and may list the same names generated from engine code.

This page does **not** invent extension macros. Unknown `{{NAME}}` tags (letters, numbers, underscores)
resolve as preset variables or remain literal when no preset variable matches.

## Identity and card macros

| Macro / aliases | Return | Notes |
| --- | --- | --- |
| `{{user}}`, `{{userName}}` | Active user/persona display name | Defaults to `User` when no persona is set |
| `{{userNamePhonetic}}` | Persona phonetic name | Falls back to `{{user}}` when empty |
| `{{char}}`, `{{charName}}` | Current character name | Defaults to `Character` |
| `{{charNamePhonetic}}` | Character phonetic name | Falls back to `{{char}}` when empty |
| `{{characters}}` | All characters in chat, comma-joined | Group roster |
| `{{group}}` | Other active group characters excluding current responder | Persona is not in this roster; follows current speaker during group generations |
| `{{persona}}` | Persona Description, Personality, Backstory, Appearance, Scenario joined by newlines | Multi-field block |
| `{{personaDescription}}` | Persona Description only | |
| `{{personaPersonality}}` | Persona Personality only | |
| `{{personaBackstory}}` | Persona Backstory only | |
| `{{personaAppearance}}` | Persona Appearance only | |
| `{{personaScenario}}` | Persona Scenario only | |
| `{{description}}` | Character Description | Solo: current character; group: first character by default unless group blocks iterate |
| `{{personality}}` | Character Personality | Same group default |
| `{{backstory}}` | Character Backstory | Same group default |
| `{{appearance}}` | Character Appearance | Same group default |
| `{{scenario}}` | Character Scenario | Same group default |
| `{{example}}` | Character Example Dialogue | Same group default |
| `{{charSysInfo}}` | Character System Prompt | |
| `{{charPostHistory}}` | Character Post-History Instructions | |

## Conversation Mode only

These resolve to empty outside Conversation Mode.

| Macro / aliases | Return |
| --- | --- |
| `{{convo_display}}` | Character Convo Display Name, or card name when empty |
| `{{char_about}}` | Character About Me (per-chat override if set, else card default) |
| `{{persona_about}}` | Persona About Me |
| `{{convo_behavior}}` | Character Convo Behavior when insertion setting places it at this macro |

## Conversation placement (move + suppress auto-insert)

Using a placement macro renders the block at the macro and **skips** automatic insertion to avoid
duplication. Conversation Mode only.

| Macro / aliases | Places |
| --- | --- |
| `{{context}}`, `{{status}}` | Conversation context / status block |
| `{{commands}}`, `{{commandList}}` | Available-commands reminder |
| `{{reactRules}}`, `{{emojiReact}}` | Custom-emoji reaction rules |
| `{{replyRules}}` | Custom-emoji and sticker reply rules |
| `{{memories}}`, `{{memoryRecall}}` | Memory-recall block |
| `{{lorebook}}`, `{{lore}}` | Lorebook injections |

In one-character Conversation, placing `{{char_about}}` / `{{persona_about}}` yourself similarly skips the
automatic participant About block. Group Conversation keeps the automatic participant block because a
singular about macro covers only one participant.

## Context and request macros

| Macro | Return / behavior |
| --- | --- |
| `{{input}}` | Most recent user message available to the prompt |
| `{{model}}` | Current model name when selected |
| `{{chatId}}` | Current chat ID |
| `{{lastGenerationType}}` | Label for generation reason; documented examples include `normal`, `continue`, `regenerate`, `impersonate`, `guided`, `autonomous`, `turn_game`, `preview`, `game_setup`, `lorebook_scan`, `retry_agents` (open set) |
| `{{idle_duration}}` | Human-readable idle time such as `8 minutes` |
| `{{gameStoryboardKeyframeCount}}` | Game Mode keyframes-per-turn target 1-6; default `3`; narrative target not a hard paragraph quota |
| `{{agent::TYPE}}` | Saved output of agent type `TYPE`; resolved **last** so agent text cannot inject further macros |

## Time macros

All share one resolution timestamp; timezone from browser.

| Macro / aliases | Format |
| --- | --- |
| `{{date}}` | `YYYY-MM-DD` |
| `{{time}}` | `HH:MM` 24-hour |
| `{{datetime}}`, `{{isotime}}` | Full timestamp with timezone offset (same meaning) |
| `{{weekday}}` | Weekday name |
| `{{timezone}}` | Timezone name |

## Random and dice

| Form | Behavior |
| --- | --- |
| `{{random}}` | Integer 0-100 inclusive |
| `{{random:X:Y}}` | Integer between X and Y inclusive |
| `{{random::A::B::C}}` | Pick one option; macros resolve only inside the chosen option |
| `{{random::A@2::B@0.5}}` | Weighted pick; missing weight = 1; decimal weights allowed; weight 0 never selected; all weights 0 yields empty; only a final `@number` is a weight |
| `{{roll:XdY}}` | Dice total, e.g. `{{roll:2d6}}` |

## Reply-scoped variables

Exist only for one reply generation; reset every turn.

| Form | Behavior |
| --- | --- |
| `{{setvar::name::value}}` | Store value; emits empty |
| `{{getvar::name}}` | Read value; empty if unset |
| `{{addvar::name::value}}` | Append to stored value |
| `{{incvar::name}}` | Add 1 to numeric variable |
| `{{decvar::name}}` | Subtract 1 from numeric variable |

Do not put `{{setvar}}` inside `{{random::...}}` options: setvar runs for every option before the pick.

## Formatting macros

| Form | Behavior |
| --- | --- |
| `{{newline}}`, `{{\n}}` | Line break |
| `{{trim}}` | Remove itself and trim surrounding whitespace |
| `{{trimStart}}` | Trim start of surrounding text |
| `{{trimEnd}}` | Trim end of surrounding text |
| `{{uppercase}}...{{/uppercase}}` | Uppercase wrapped text |
| `{{lowercase}}...{{/lowercase}}` | Lowercase wrapped text |
| `{{noop}}` | Removed; harmless placeholder |
| `{{// comment}}` | Author note removed from output |
| `{{banned "text"}}` | Removed; does **not** filter or ban model output |

## Lifecycle rules (pinned)

- Built-in macros need **no API key**; they resolve inside Marinara. Preset variables need a defining
  preset. `{{agent::TYPE}}` stays **empty until** that agent has produced saved output; it resolves
  **last** so agent text cannot inject further macros.
- Variables evaluate **left to right** in one prompt build (early lore `setvar` can be read later).
- Random: macros resolve only inside the **chosen** option, **except** `setvar`/`addvar`/`incvar`/
  `decvar` which run for **every option before the pick**.
- Reply-scoped variables reset every generation.
- Weighted random: missing weight = 1; weight 0 never selected; all-zero weights yield empty.

## Non-macros and failure modes

- `{{prompt}}` alone opens Peek Prompt; it is not a resolving macro.
- No escape character for braces; unknown names stay literal unless a preset variable matches.
- Custom Tools do not resolve macros.
- Impersonate templates accept only a restricted placeholder set, not the full list.
- Very large or deeply nested expansions are cut off silently.
- Live `/macros` and Macro Reference may update with the engine; this catalog is the pinned static floor.

## Conditionals

Conditional operators live on [Prompts and macros](prompts-and-macros.md) (`{{#if}}`, `else`, operators,
`&&`/`||`). They are part of the macro system and apply wherever macros work.
