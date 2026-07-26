---
id: reference/platforms/sillytavern/source-coverage
title: SillyTavern authoring source coverage
audience: dev
summary: Path-level coverage map from the pinned SillyTavern-Docs tree to Hoplight platform references, with individual inclusion verdicts and no wildcard exclusions for authoring material.
tags: [platform, sillytavern, provenance, coverage, maintenance]
related: [reference/platforms/sillytavern/README, reference/platforms/sillytavern/macro-reference]
---

# SillyTavern authoring source coverage

## Pinned source

`SillyTavern/SillyTavern-Docs` commit `70e5e4d3c239253fca4692fe82e3936cb9c4b1b1`, retrieved 2026-07-26.
License AGPL-3.0. Paths are repository-relative.

## Included authoring pages

| Path | Subject | Destination |
| --- | --- | --- |
| `Usage/Characters/index.md` | Card management import/export | [Characters](characters.md) |
| `Usage/Characters/characterdesign.md` | Definitions, greetings, overrides, metadata | [Characters](characters.md) |
| `Usage/Characters/Author's-Note.md` | Author's Note placement/frequency | [Prompts and presets](prompts-and-presets.md) |
| `Usage/Characters/tags.md` | Tags, import, filter, folders | [Characters](characters.md) |
| `Usage/Characters/chatfilemanagement.md` | JSONL/TXT, checkpoints, rename links | [Chats and groups](chats-and-groups.md) |
| `Usage/Characters/groupchats.md` | Reply strategies, join modes, mute/auto | [Chats and groups](chats-and-groups.md) |
| `Usage/personas.md` | Personas | [Personas and Data Bank](personas-and-data-bank.md) |
| `Usage/Characters/data-bank.md` | Data Bank | [Personas and Data Bank](personas-and-data-bank.md) |
| `Usage/worldinfo.md` | World Info | [World Info](world-info.md) |
| `Usage/Prompts/index.md` | Prompt layers | [Prompts and presets](prompts-and-presets.md) |
| `Usage/Prompts/advancedformatting.md` | Advanced Formatting | [Prompts and presets](prompts-and-presets.md) |
| `Usage/Prompts/context-template.md` | Context Template | [Prompts and presets](prompts-and-presets.md) |
| `Usage/Prompts/instructmode.md` | Instruct Mode | [Prompts and presets](prompts-and-presets.md) |
| `Usage/Prompts/prompt-manager.md` | Prompt Manager | [Prompts and presets](prompts-and-presets.md) |
| `Usage/Prompts/CFG.md` | CFG | [Prompts and presets](prompts-and-presets.md) |
| `Usage/Prompts/reasoning.md` | Reasoning | [Prompts and presets](prompts-and-presets.md) |
| `Usage/Prompts/tokenizer.md` | Tokenizer selection, padding | [Prompts and presets](prompts-and-presets.md) |
| `Usage/macros.md` | Macros | [Macros](macros.md), [catalog](macro-reference.md), [operators](macro-operators.md) |
| `extensions/Regex.md` | Regex scripts | [Regex and automation](regex-and-automation.md) |
| `For_Contributors/st-script.md` | STscript and Quick Replies | [Regex and automation](regex-and-automation.md) |
| `extensions/Expression-Images.md` | Expression sprites | [Characters](characters.md) |

## Evaluated exclusions (path-level)

| Path | Reason |
| --- | --- |
| `Usage/Chatting/hotkeys.md` | Keyboard UX only |
| `Usage/Chatting/index.md` | Chat navigation overview |
| `Usage/Chatting/slashcommands.md` | Stub; live slash inventory is extension-dependent |
| `Usage/branches.md` | Branch UX without new artifact schema beyond checkpoints |
| `Usage/API_Connections/Connection-Profiles.md` | Provider connection profiles |
| `Usage/API_Connections/DreamGen.md` | Provider connection setup |
| `Usage/API_Connections/google.md` | Provider connection setup |
| `Usage/API_Connections/horde.md` | Provider connection setup |
| `Usage/API_Connections/index.md` | Provider connection overview |
| `Usage/API_Connections/koboldcpp.md` | Provider connection setup |
| `Usage/API_Connections/mancer.md` | Provider connection setup |
| `Usage/API_Connections/novelai.md` | Provider connection setup |
| `Usage/API_Connections/openai.md` | Provider connection setup |
| `Usage/API_Connections/OpenRouter.md` | Provider connection setup |
| `Usage/API_Connections/self-hosted.md` | Provider connection setup |
| `Usage/API_Connections/tabbyapi.md` | Provider connection setup |
| `Usage/User_Settings/index.md` | Ordinary settings shell |
| `Usage/User_Settings/uicustomization.md` | Theme/UI |
| `Usage/User_Settings/Visual-Novel.md` | Display mode chrome |
| `Usage/Common-Settings.md` | Generic settings |
| `Usage/faq.md` | General support and troubleshooting |
| `Usage/index.md` | Usage navigation overview |
| `Usage/quick-start.md` | Onboarding |
| `Usage/update.md` | Release and update workflow |
| `Usage/welcome-assistants.md` | Onboarding assistants |
| `Installation/Android.md` | Installation |
| `Installation/Docker.md` | Installation |
| `Installation/index.md` | Installation overview |
| `Installation/LinuxMacOS.md` | Installation |
| `Installation/Updating/index.md` | Update workflow |
| `Installation/Updating/migration-guide-1-09.md` | Historical migration |
| `Installation/Updating/node.md` | Update workflow |
| `Installation/Updating/ST-1.12.0-Migration-Guide.md` | Historical migration |
| `Installation/Windows.md` | Installation |
| `Administration/config-yaml.md` | Server administration |
| `Administration/index.md` | Server administration overview |
| `Administration/multi-user.md` | Hosting and accounts |
| `Administration/remote-connections.md` | Hosting and remote access |
| `Administration/reverse-proxying.md` | Hosting |
| `Administration/sso.md` | Hosting and accounts |
| `Administration/tunneling.md` | Hosting and remote access |
| `extensions/index.md` | Extension navigation |
| `extensions/AllTalk.md` | TTS integration without a portable authored artifact |
| `extensions/Blip.md` | Chat-side audio behavior |
| `extensions/captioning.md` | Runtime image captioning |
| `extensions/Chat-vectorization.md` | Chat retrieval extension rather than portable authoring schema |
| `extensions/Dynamic-Audio.md` | Chat-side audio behavior |
| `extensions/EmulatorJS.md` | Chat-side emulator |
| `extensions/Extras/index.md` | Extension service overview |
| `extensions/Extras/Installation.md` | Extension installation |
| `extensions/Extras/Smart-Context.md` | Runtime context extension |
| `extensions/Extras/Talkinghead.md` | Runtime animation extension |
| `extensions/Live2d.md` | Runtime display extension |
| `extensions/MiniMaxTTS.md` | TTS integration |
| `extensions/Objective.md` | Chat-side objective tracking |
| `extensions/RVC.md` | Voice conversion |
| `extensions/Speech-Recognition.md` | Runtime speech input |
| `extensions/Stable-Diffusion.md` | Image generation integration |
| `extensions/Summarize.md` | Runtime summarization |
| `extensions/Translation.md` | Runtime translation |
| `extensions/TTS.md` | TTS integration |
| `extensions/VRM.md` | Runtime avatar display |
| `extensions/WebSearch.md` | Runtime web-search integration |
| `extensions/XTTS.md` | TTS integration |
| `For_Contributors/Function-Calling.md` | Extension development workflow |
| `For_Contributors/i18n.md` | Contributor workflow |
| `For_Contributors/index.md` | Contributor navigation |
| `For_Contributors/Server-Plugins.md` | Extension development workflow |
| `For_Contributors/Writing-Extensions.md` | Extension development workflow |
| `readme.md` | Documentation repository overview |
| `LicenseCredits.md` | Credits linked from README provenance |

All 92 Markdown files in the pin are classified individually: 21 included authoring sources and 71
evaluated exclusions. Macro completeness remains the stronger catalog rule on the macro pages.

## Dynamic boundaries

Live `/? macros`, field autocomplete, extension slash commands, and installed expression classifiers are
installation authorities. Hoplight never executes imported automation to discover capabilities.

## Refresh

Compare next commit to the pin; update destinations; re-run macro coverage tests; independent review after
summary rewrites.
