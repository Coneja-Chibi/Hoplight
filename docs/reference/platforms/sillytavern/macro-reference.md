---
id: reference/platforms/sillytavern/macro-reference
title: SillyTavern documented macro catalog
audience: user
summary: Complete catalog of every built-in macro named by the pinned official SillyTavern macro manual, organized by content domain with signatures, returned values, mutation behavior, and scope notes.
tags: [platform, sillytavern, macros, catalog, prompts, variables]
related: [reference/platforms/sillytavern/macros, reference/platforms/sillytavern/macro-operators, reference/platforms/sillytavern/source-coverage]
---

# SillyTavern documented macro catalog

This page names every macro in the official SillyTavern macro manual pinned by this collection. It is a
reference catalog, not merely a sample list. Read [Macro language](macros.md) for evaluation order and
portability rules, and [Macro operators](macro-operators.md) for nesting, scoped blocks, conditionals,
flags, and variable shorthand.

Primary source: [Macros](https://docs.sillytavern.app/usage/core-concepts/macros/), pinned through
`SillyTavern/SillyTavern-Docs` commit `70e5e4d3c239253fca4692fe82e3936cb9c4b1b1`.

## Catalog authority and limits

The tables are complete for names documented on the pinned official page. SillyTavern's registry is
runtime-extensible, so an extension or newer installation can add macros not present here. Inside a live
installation, `/? macros` is the complete registry and field autocomplete reports supported arguments.
That dynamic boundary does not make this static catalog partial relative to its pinned source.

Signatures show recommended modern syntax. A field may reject or defer a macro because fields are processed
at different stages. A listed macro is not proof that every card, lore, prompt, regex, or script field can
resolve it. State-changing macros remain sealed in Hoplight and are never evaluated during conversion.

## Names, participants, cards, and personas

| Signature | Value or effect | Scope note |
| --- | --- | --- |
| `{{user}}` | Current user or persona name | Participant identity |
| `{{char}}` | Current character name | Current speaker in character contexts |
| `{{group}}` | Comma-separated group members, including muted members | Falls back to the character in solo chat |
| `{{groupNotMuted}}` | Comma-separated non-muted group members | Group-aware |
| `{{charIfNotGroup}}` | Character name outside group chat, otherwise empty | Useful for solo-only labels |
| `{{notChar}}` | All participants except the current speaker | Context-dependent |
| `{{description}}` | Character description | Card field |
| `{{personality}}` | Character personality | Card field |
| `{{scenario}}` | Character scenario | Card field |
| `{{persona}}` | Current persona description | User identity context |
| `{{charPrompt}}` | Character Main Prompt override | Empty when none exists |
| `{{charInstruction}}` | Character Post-History Instructions override | Empty when none exists |
| `{{charDepthPrompt}}` | Character depth note | Card advanced definition |
| `{{charCreatorNotes}}` | Character creator notes | Metadata, not ordinary character prose |
| `{{charVersion}}` | Character version | Card metadata |
| `{{mesExamples}}` | Dialogue examples formatted for active Instruct Mode | Prompt-ready form |
| `{{mesExamplesRaw}}` | Unformatted card dialogue examples | Source-like form |
| `{{charFirstMessage}}` | Primary greeting | Card greeting |
| `{{charFirstMessage::index}}` | Greeting at the optional alternate index | Index selects an alternate greeting |
| `{{original}}` | Original global value inside a character prompt override | Valid only in an override composition context |

The first-message index and `{{original}}` demonstrate why names alone are insufficient. Arguments and
evaluation context are part of the behavior. Character-to-persona conversion can also require swapping
`{{char}}` and `{{user}}`, because the authored subject changes roles.

## Chat history, messages, time, and date

| Signature | Value or effect | Scope note |
| --- | --- | --- |
| `{{lastMessage}}` | Latest chat message text | Any speaker |
| `{{lastMessageId}}` | Latest message index | Numeric chat position |
| `{{lastUserMessage}}` | Latest user message text | User messages only |
| `{{lastCharMessage}}` | Latest character message text | Character messages only |
| `{{firstIncludedMessageId}}` | First message index included in current context | Changes with context fitting |
| `{{firstDisplayedMessageId}}` | First message index currently displayed | UI history window |
| `{{lastSwipeId}}` | One-based final swipe index on the latest message | Swipe state |
| `{{currentSwipeId}}` | One-based selected swipe index | Swipe state |
| `{{allChatRange}}` | Range covering the full chat | Intended for range-taking commands |
| `{{summary}}` | Latest summary supplied by the Summarize extension | Empty or unavailable without the extension |
| `{{time}}` | Current local time | Runtime clock |
| `{{time::UTC±offset}}` | Current time at the requested UTC offset | Offset argument |
| `{{date}}` | Current local date in short form | Runtime calendar |
| `{{weekday}}` | Current weekday | Runtime calendar |
| `{{isotime}}` | Current time in `HH:mm` form | Stable numeric form |
| `{{isodate}}` | Current date in `YYYY-MM-DD` form | Stable numeric form |
| `{{datetimeformat::format}}` | Current date and time rendered with the requested format | Format argument |
| `{{idleDuration}}` | Human-readable time since the latest user message | Chat activity state |
| `{{timeDiff::left::right}}` | Human-readable difference between two time values | Two arguments |

History macros expose current runtime state, not immutable card data. Their output can differ between a
preview, a later generation, a branch, and another installation. Time output also depends on the local
clock unless an explicit offset and stable format are used.

## Variables, randomization, and runtime state

| Signature | Value or effect | Mutation |
| --- | --- | --- |
| `{{getvar::name}}` | Reads a chat-local variable | No |
| `{{setvar::name::value}}` | Writes a chat-local variable and returns empty text | Yes |
| `{{addvar::name::value}}` | Adds numerically or appends text to a local variable | Yes |
| `{{incvar::name}}` | Adds one to a local variable and returns the new value | Yes |
| `{{decvar::name}}` | Subtracts one and returns the new value | Yes |
| `{{hasvar::name}}` | Returns `"true"` or `"false"` for local existence | No |
| `{{deletevar::name}}` | Deletes a chat-local variable | Yes |
| `{{getglobalvar::name}}` | Reads an installation-global variable | No |
| `{{setglobalvar::name::value}}` | Writes an installation-global variable | Yes |
| `{{addglobalvar::name::value}}` | Adds numerically or appends text to a global variable | Yes |
| `{{incglobalvar::name}}` | Adds one to a global variable and returns the new value | Yes |
| `{{decglobalvar::name}}` | Subtracts one and returns the new value | Yes |
| `{{hasglobalvar::name}}` | Returns `"true"` or `"false"` for global existence | No |
| `{{deleteglobalvar::name}}` | Deletes an installation-global variable | Yes |
| `{{random::a::b::c}}` | Selects one listed value and rerolls on evaluation | No |
| `{{pick::a::b::c}}` | Selects one listed value stably for its chat position | No |
| `{{roll::expression}}` | Evaluates a dice expression | No |
| `{{maxPrompt}}` | Maximum prompt tokens after reserving response space | No |
| `{{maxContextTokens}}` | Configured total context-token limit | No |
| `{{maxResponseTokens}}` | Configured response-token limit | No |
| `{{model}}` | Current API model name | No |
| `{{isMobile}}` | `"true"` in a mobile environment, otherwise `"false"` | No |
| `{{lastGenerationType}}` | Latest queued generation kind | No |
| `{{hasExtension::name}}` | Whether the named extension is active | No |

Random takes a list, not a numeric range. Pick is stable for a chat and position but can be rerolled by
SillyTavern's reroll command. Dice uses droll-style expressions. The global variable operations affect the
installation rather than only the open chat, which makes them materially different from passive prompt
substitution.

## Prompt, Instruct, reasoning, and image templates

| Signature | Value or effect |
| --- | --- |
| `{{systemPrompt}}` | Active system prompt, including an allowed character override |
| `{{defaultSystemPrompt}}` | Default system prompt |
| `{{authorsNote}}` | Active Author's Note |
| `{{charAuthorsNote}}` | Character-specific Author's Note |
| `{{defaultAuthorsNote}}` | Default Author's Note |
| `{{instructStoryStringPrefix}}` | Instruct prefix around the story string |
| `{{instructStoryStringSuffix}}` | Instruct suffix around the story string |
| `{{instructUserPrefix}}` | Ordinary user-message prefix |
| `{{instructUserSuffix}}` | Ordinary user-message suffix |
| `{{instructAssistantPrefix}}` | Ordinary assistant-message prefix |
| `{{instructAssistantSuffix}}` | Ordinary assistant-message suffix |
| `{{instructSeparator}}` | Instruct message separator |
| `{{instructSystemPrefix}}` | System-message prefix |
| `{{instructSystemSuffix}}` | System-message suffix |
| `{{instructFirstAssistantPrefix}}` | First assistant-message prefix variant |
| `{{instructLastAssistantPrefix}}` | Last assistant-message prefix variant |
| `{{instructFirstUserPrefix}}` | First user-message prefix variant |
| `{{instructLastUserPrefix}}` | Last user-message prefix variant |
| `{{instructStop}}` | Active Instruct stop sequence |
| `{{instructUserFiller}}` | User alignment filler |
| `{{instructSystemInstructionPrefix}}` | Prefix for a system instruction |
| `{{chatSeparator}}` | Separator between example-chat blocks in Text Completion |
| `{{chatStart}}` | Text Completion chat-start marker |
| `{{reasoningPrefix}}` | Prefix before a reasoning block |
| `{{reasoningSuffix}}` | Suffix after a reasoning block |
| `{{reasoningSeparator}}` | Separator between reasoning or content and the response |
| `{{charPrefix}}` | Character positive image-generation prompt prefix |
| `{{charNegativePrefix}}` | Character negative image-generation prompt prefix |

These macros expose active template material and should not be flattened into card identity. Many are
meaningful only in Advanced Formatting, Context Template, Instruct, reasoning, or image-generation stages.
Another platform may have similar strings but different placement or role semantics.

## Utility and World Info values

| Signature | Value or effect | Important qualification |
| --- | --- | --- |
| `{{newline}}` | One newline | Whitespace output |
| `{{newline::count}}` | Requested number of newlines | Numeric count |
| `{{space}}` | One space | Whitespace output |
| `{{space::count}}` | Requested number of spaces | Numeric count |
| `{{noop}}` | Empty string | Can preserve meaningful spacing in a larger expression |
| `{{trim}}` | Removes surrounding newlines | Field processing utility |
| `{{reverse::text}}` | Reverses the supplied text | Accepts scoped form |
| `{{input}}` | Current chat input field content | Runtime UI input |
| `{{banned::word}}` | Adds a banned word for a Text Completion backend | Backend-dependent side effect |
| `{{outlet::key}}` | Content collected for the named World Info outlet | Case-sensitive key and stage-dependent |

An outlet is withheld until an exact matching outlet macro is encountered in a compatible later-processed
field. It does not resolve inside World Info entry content, early card fields, or Author's Note. Outlet keys
cannot be assumed portable across applications.

## Conditional and structural forms

`{{if condition}}...{{/if}}`, `{{else}}`, and `{{// comment}}` are control forms rather than ordinary
value lookups. They are fully specified in [Macro operators](macro-operators.md). The closing marker and
preserve-whitespace marker are implemented flags; planned immediate, delayed, re-evaluate, and filter flags
must not be treated as current features.

## Runtime discovery rule

When Kit answers about a name present here, this page supplies the pinned documented behavior. When the
user asks whether a macro exists in their particular SillyTavern installation, Kit should recommend
`/? macros` or field autocomplete. Extensions can register additional names, and fields can expose
different subsets. Kit must label installation-specific claims instead of inventing certainty from this
snapshot.
