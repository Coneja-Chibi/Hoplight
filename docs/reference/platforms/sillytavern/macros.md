---
id: reference/platforms/sillytavern/macros
title: SillyTavern macro language
audience: user
summary: Authoring reference for SillyTavern macro syntax, arguments, nesting, scoped and conditional forms, variables, common macro families, and portability hazards.
tags: [platform, sillytavern, macros, templates, variables, conditionals]
related: [reference/platforms/sillytavern/README, reference/platforms/sillytavern/macro-reference, reference/platforms/sillytavern/macro-operators, reference/platforms/sillytavern/prompts-and-presets, reference/formats/sillytavern]
---

# SillyTavern macro language

Macros are dynamic placeholders expanded when SillyTavern processes prompt-capable text. They appear in
prompts, cards, World Info, Quick Replies, regex configuration, and scripts. Support depends on the field
and evaluation stage, so syntactically valid markup is not guaranteed to resolve everywhere.

Primary source: [Macros](https://docs.sillytavern.app/usage/core-concepts/macros/).

This page explains the language as a system. For exhaustive lookup, use
[Documented macro catalog](macro-reference.md), which names every macro on the pinned official page, and
[Macro operators](macro-operators.md), which specifies every shorthand operator and structural form.

## Core syntax and composition

Modern macros use double braces, such as `{{user}}`. Names are case-insensitive. A single argument may
follow a space, while multiple arguments use `::`, as in `{{random::red::green::blue}}`. The single-colon
form remains legacy syntax and should not be authored for new content.

Whitespace around names and separators is ignored. Macros may nest, with inner expressions resolving
before their outer consumer. Any macro accepting an argument can use a scoped block whose body becomes the
last argument. Scoped content is trimmed and dedented unless the `#` flag preserves whitespace.

`{{if}}` blocks support truthy tests, inversion, and an `{{else}}` branch. Empty string, `false`, `0`,
`off`, and `no` are falsy. Comments use `{{// ...}}` or a scoped comment block. Backslashes escape braces
when literal macro text is required.

Only `/` for closing blocks and `#` for preserved whitespace are implemented macro flags in the pinned
documentation. Immediate, delayed, re-evaluate, and filter flags are described as planned, not available.
Kit must not teach planned syntax as current behavior.

## Variables and state

Local variables belong to the current chat; global variables belong to installation settings. Full macros
include get, set, add, increment, decrement, existence, and delete operations for each scope. Variable values
may be strings or JSON-like data depending on the consuming feature.

The experimental engine provides shorthand: `.name` addresses a local variable and `$name` a global one.
Operators include assignment, increment, decrement, numeric or string addition, subtraction, truthy and
nullish fallback, conditional assignment, equality, inequality, and numeric comparisons. Fallback operands
are evaluated lazily.

Macro expansion can therefore mutate chat or global state. A field containing `{{setvar...}}` is not
passive prose even though it is stored as text. Hoplight keeps macros sealed during conversion and never
evaluates them while importing, inspecting, summarizing, or exporting a piece.

## Common value families

Participant macros include user, character, group members, non-muted members, and other speakers. Card and
persona macros expose description, personality, scenario, persona text, character prompt overrides,
Character's Note, creator notes, version, examples, greetings, and `{{original}}`.

Runtime families expose chat messages and swipe state, current date and time, model and token limits,
generation type, extension availability, and summaries. Randomization includes rerolled choice, stable
per-chat choice, and dice expressions.

Prompt-template macros expose active system and Author's Note values plus Instruct prefixes, suffixes,
separators, stop sequences, and reasoning wrappers. Utility macros add whitespace, trim, reverse strings,
inspect current input, ban Text Completion words, or pull a named World Info outlet.

The authoritative available set is runtime-extensible. SillyTavern recommends `/? macros` and field
autocomplete because extensions may register additional macros and an installation may differ from the
pinned documentation.

## Evaluation and portability hazards

Macro availability depends on processing order. World Info outlets cannot expand inside World Info entries,
early character fields, or Author's Note. Character-to-persona conversion may need to swap `{{char}}` and
`{{user}}`. Regex find patterns can choose no substitution, raw substitution, or escaped substitution.
Scripts add pipe and variable contexts that ordinary prompt fields do not have.

A target platform may share brace syntax while assigning different names, arguments, truthiness, or
evaluation phases. Hoplight must not translate macros through superficial string replacement. Same-format
round trips preserve exact text; cross-format conversion should retain portable literal prose, report
unsupported macro behavior, and avoid executing either source or target syntax.

Legacy markers such as `<USER>`, `<BOT>`, `<CHAR>`, and `<GROUP>` may still resolve in SillyTavern, but
new content should use modern braces. Escaped literals and nested blocks must remain byte-stable where the
source format's round-trip tier requires it.
