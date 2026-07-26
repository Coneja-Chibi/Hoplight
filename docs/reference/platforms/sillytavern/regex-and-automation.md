---
id: reference/platforms/sillytavern/regex-and-automation
title: SillyTavern regex and automation
audience: dev
summary: Content model and safety boundary for SillyTavern regex scripts, STscript, Quick Replies, World Info automation identifiers, execution scope, persistence, and portability.
tags: [platform, sillytavern, regex, stscript, quick-replies, automation, sealed]
related: [reference/platforms/sillytavern/README, reference/entities/regex, reference/security/script-sandbox]
---

# SillyTavern regex and automation

SillyTavern regex scripts and STscript are authored content with executable effects inside SillyTavern.
Hoplight can inspect, edit, and round-trip their text as data, but import and conversion never authorize
execution.

Primary sources: [Regex](https://docs.sillytavern.app/extensions/regex/) and
[STscript Language Reference](https://docs.sillytavern.app/usage/st-script/).

## Regex script records

A regex script has a display name, find expression, replacement, optional trim strings, enabled state,
source scopes, macro-substitution mode, depth bounds, run-on-edit behavior, and ephemerality settings.
Replacement supports the complete match and capture groups. JavaScript-style flags control global,
case-insensitive, dot-all, multiline, and Unicode behavior.

Global scripts live in installation settings. Scoped scripts live in the active character card. Exported
JSON can move a script between installations, and scripts can move between global and character scope.
Name is operational because slash commands and STscript may target it.

Affects selectors include user input, AI response, slash-command values, World Info content, and reasoning.
An empty selector set prevents normal chat activation but may still allow an explicit script call. Min and
max depth constrain eligible chat messages and do not apply to utility or system prompts in the same way.

## Ephemerality and visible truth

With neither ephemerality option selected, a regex script can rewrite values stored in the chat JSONL. That
mutation is persistent and may be irreversible. Display-only changes alter what the user sees without
changing the outgoing prompt. Prompt-only changes alter what the model receives without changing display.
Selecting both changes display and prompt while leaving stored chat text untouched.

This creates three distinct truths: stored message, rendered message, and model-bound message. An editor
must preserve both ephemerality flags rather than reducing them to one enabled switch. World Info scope
also depends on outgoing-prompt behavior.

Macro substitution in the find expression may be disabled, raw, or regex-escaped. Raw values can change
pattern meaning when names contain metacharacters. Escaped substitution treats the value literally. Testing
must use bounded, terminable execution because user-authored patterns can be computationally expensive.

## STscript and Quick Replies

STscript batches slash commands separated by pipes. Commands execute sequentially and pass values through a
pipe. The language includes named and unnamed arguments, macros, local and global variables, arrays and
objects, conditions, closures, loops, math, generation calls, prompt injections, message access, character
navigation, World Info mutation, text processing, and extension commands.

Quick Replies store scripts behind buttons or hidden procedures. Presets group replies and can be switched
manually or via `/qrset (name)`. From the pinned STscript reference
(`For_Contributors/st-script.md`):

- Autocomplete applies on chat input and the large QR editor; `/:` lists scoped variables and QRs.
- QR properties include label, message/script, tool tip, and editor debugger with `/breakpoint |`.
- Call another preset's procedure as `a.b` (preset.label); literal labels named `a.b` win first.
- Management commands include `/qr-create`, `/qr-delete`, `/qr-update`, `qr-get`, preset create/update,
  and context-menu attach/clear/delete helpers with `set`, `label`, `chain`, and related arguments.
- Scripts may run manually, by label, or auto-execute at app startup, user message, AI message, chat load,
  group reply, or a matching World Info Automation ID.

Extensions can add slash commands, so the available command set is installation-dependent. The official
documentation warns users to inspect scripts before execution. A script can call a model, modify messages
and lore, change variables, navigate UI, or invoke extension behavior. It is not equivalent to a static
macro template.

## Hoplight safety and interoperability

Imported regex, macro, Lua, and STscript payloads remain sealed text. Hoplight does not execute STscript,
resolve Quick Reply procedures, follow Automation IDs, or apply a regex during import or conversion. Regex
testing is available only through Hoplight's isolated, user-invoked test bench and its terminable worker.

Same-format export can restore platform-native script fields from escrow. Cross-format movement is allowed
only when a target adapter has an explicit semantic mapping. A target that merely has "scripts" does not
prove compatible scope, lifecycle, persistence, or command semantics.

Kit should describe executable consequences before proposing an edit. It must not imply that a disabled
list switch, an internal disabled field, an empty Affects set, and ephemerality are interchangeable. Changes
to any execution condition belong in the semantic Gate review even though the payload remains sealed.
