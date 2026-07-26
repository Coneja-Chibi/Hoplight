---
id: reference/platforms/sillytavern/README
title: SillyTavern authoring reference
audience: user
summary: Curated map of SillyTavern content authoring concepts that Kit can use when creating, explaining, importing, editing, and exporting compatible pieces.
tags: [platform, sillytavern, authoring, interoperability, kit]
related: [guide/platforms/sillytavern, reference/formats/sillytavern, reference/kit/tools]
---

# SillyTavern authoring reference

This collection gives Kit an authoring-focused model of SillyTavern. It covers the content people make
and move between applications, the prompt behavior that gives those files meaning, and the boundaries
Hoplight must preserve during conversion. It intentionally omits installation, hosting, model-provider
setup, and routine chat controls.

## Collection map

- [Characters](characters.md) covers card fields, greetings, advanced definitions, metadata, tags,
  expression sprites, and the distinction between permanent and conditional prompt content.
- [Chats and groups](chats-and-groups.md) covers re-importable chat JSONL vs lossy TXT, checkpoints, and
  stored group reply strategies, join modes, mute/force/auto, and scenario overrides.
- [World Info](world-info.md) covers lorebooks, activation, insertion, recursion, grouping, timed
  effects, outlets, and vector matching.
- [Personas and Data Bank](personas-and-data-bank.md) covers user identities, prompt placement,
  connections, backups, attachment scopes, and retrieval-augmented documents.
- [Prompts and presets](prompts-and-presets.md) covers the final request, Text Completion templates,
  Chat Completion Prompt Manager entries, Author's Note, CFG, reasoning blocks, tokenizer selection and
  padding, and portable preset boundaries.
- [Macros](macros.md) explains evaluation and portability, [Documented macro catalog](macro-reference.md)
  names every macro in the pinned official manual, and [Macro operators](macro-operators.md) specifies
  arguments, nesting, blocks, conditions, flags, variables, operators, and legacy forms.
- [Regex and automation](regex-and-automation.md) covers regex script records, scope and ephemerality,
  STscript, and Quick Reply presets, triggers, and management commands.
- [Source coverage](source-coverage.md) maps every evaluated upstream authoring page to its local
  reference or exclusion and defines what complete means.

Use the narrow page that owns the question, then read the whole page around a search hit. SillyTavern
features often interact through prompt order, scope, or evaluation timing, so a single matching sentence
can be misleading without its surrounding constraints.

## Authority and provenance

This is an independently organized Hoplight reference derived from SillyTavern's official documentation.
It is not a verbatim mirror and does not replace the upstream manual. The source snapshot was
`SillyTavern/SillyTavern-Docs` commit `70e5e4d3c239253fca4692fe82e3936cb9c4b1b1`, retrieved on
2026-07-26 (same pin as 2026-07-25). Every page links its principal upstream sources.

The upstream documentation repository is licensed under AGPL-3.0. Hoplight is also AGPL-3.0-or-later.
The upstream copyright and contributor credits remain available in the
[official documentation repository](https://github.com/SillyTavern/SillyTavern-Docs), including its
[license](https://github.com/SillyTavern/SillyTavern-Docs/blob/main/LICENSE) and
[credits](https://github.com/SillyTavern/SillyTavern-Docs/blob/main/LicenseCredits.md).

## How Kit should apply it

Kit should distinguish three kinds of claims:

1. Upstream behavior describes what SillyTavern does with a field or artifact.
2. Hoplight format behavior describes what the current adapter can preserve or emit.
3. Authoring advice explains how fields interact, but does not prove that every target format can carry
   them.

For an interoperability decision, read this collection together with
[SillyTavern format](../../formats/sillytavern.md). If the two differ, the format page governs current
Hoplight implementation and this collection governs upstream meaning. Kit must never invent adapter
support from an upstream feature description.

## Refresh policy

SillyTavern evolves quickly. A future refresh should compare the pinned upstream revision, update only
the affected Hoplight pages, regenerate their semantic sidecars, and obtain a new review. New upstream
features should join this collection only when they change a content type, authoring workflow, prompt
contract, or interoperability decision.

Routine UI rearrangements, installation changes, provider lists, and transient defaults are outside the
collection. When exact current UI labels matter, follow the linked official page.
