---
id: reference/platforms/marinara/source-coverage
title: Marinara authoring source coverage
audience: dev
summary: Path-level include/exclude inventory including all conversation/* authoring pages and creative artifacts.
tags: [platform, marinara, provenance, coverage]
related: [reference/platforms/marinara/README]
---

# Marinara authoring source coverage

Pin: `Pasta-Devs/Marinara-Engine` `b7545a63e7e264a1cd9eeea1a5490d50c08ddb29`, retrieved 2026-07-26, AGPL-3.0.

## Included

| Path | Destination |
| --- | --- |
| `characters/creating-and-editing-characters.md` | characters.md |
| `characters/personas.md` | characters.md |
| `characters/choosing-your-persona.md` | characters.md |
| `characters/import-export.md` | characters.md |
| `characters/colors-and-stats.md` | sprites-and-galleries.md |
| `characters/sprites.md` | sprites-and-galleries.md |
| `characters/galleries.md` | sprites-and-galleries.md |
| `conversation/profiles.md` | characters.md + conversation-mode.md |
| `conversation/getting-started.md` | conversation-mode.md |
| `conversation/schedules.md` | conversation-mode.md |
| `conversation/emoji-stickers-gifs.md` | conversation-mode.md |
| `conversation/calls.md` | conversation-mode.md |
| `conversation/selfies.md` | conversation-mode.md |
| `conversation/table-games.md` | conversation-mode.md |
| `appearance/card-css-theming.md` | visual-and-css.md |
| `media/style-profiles.md` | visual-and-css.md |
| `media/scene-backgrounds.md` | visual-and-css.md |
| `media/animated-expressions.md` | visual-and-css.md |
| `roleplay/backgrounds.md` | visual-and-css.md |
| `lorebooks/entries.md` | lorebooks.md |
| `lorebooks/import-export.md` | lorebooks.md |
| `lorebooks/linking-to-characters.md` | lorebooks.md |
| `lorebooks/overview.md` | lorebooks.md |
| `lorebooks/semantic-search.md` | lorebooks.md |
| `lorebooks/token-budgets.md` | lorebooks.md |
| `prompts/chat-settings-presets.md` | prompts-and-macros.md |
| `prompts/conditional-prompts.md` | prompts-and-macros.md |
| `prompts/generation-parameters.md` | prompts-and-macros.md |
| `prompts/macros.md` | prompts-and-macros.md + macro-reference.md |
| `prompts/presets.md` | prompts-and-macros.md |
| `prompts/preset-variables.md` | prompts-and-macros.md |
| `prompts/prompt-overrides.md` | prompts-and-macros.md |
| `agents/agents-overview.md` | agents-and-tools.md |
| `agents/approvals-and-agent-suite.md` | agents-and-tools.md |
| `agents/built-in-agents.md` | agents-and-tools.md |
| `agents/custom-agents.md` | agents-and-tools.md |
| `agents/hierarchical-maps.md` | maps-and-game-content.md |
| `agents/knowledge-sources.md` | agents-and-tools.md |
| `agents/memory.md` | agents-and-tools.md |
| `extending/custom-tools.md` | agents-and-tools.md |
| `extending/regex-scripts.md` | agents-and-tools.md |
| `home/professor-mari.md` | agents-and-tools.md |
| `chats/export-import.md` | chats-and-interchange.md |
| `chats/group-chats.md` | chats-and-interchange.md |
| `chats/connected-chats.md` | chats-and-interchange.md |
| `chats/chat-settings.md` | chats-and-interchange.md |
| `game/game-assets.md` | maps-and-game-content.md |
| `game/sessions-and-saves.md` | maps-and-game-content.md |
| `game/hud-widgets.md` | maps-and-game-content.md |
| `game/party-and-npcs.md` | maps-and-game-content.md |
| `game/storyboard.md` | maps-and-game-content.md |
| `roleplay/scenes.md` | maps-and-game-content.md |
| `roleplay/hud-and-trackers.md` | maps-and-game-content.md |
| `roleplay/narrative-director.md` | maps-and-game-content.md |
| `data/where-data-is-stored.md` | data-and-interop.md |
| `data/backup-and-restore.md` | data-and-interop.md |
| `data/importing-from-sillytavern.md` | data-and-interop.md |

## Excluded (path-level)

| Path | Reason |
| --- | --- |
| `INSTALLATION.md` | Installation overview |
| `installation/android-termux.md` | Installation |
| `installation/containers.md` | Installation |
| `installation/ios-pwa.md` | Installation |
| `installation/macos-linux.md` | Installation |
| `installation/windows.md` | Installation |
| `UPGRADING.md` | Update workflow |
| `REMOTE_ACCESS.md` | Hosting and remote access |
| `CONFIGURATION.md` | Operator configuration |
| `TROUBLESHOOTING.md` | General troubleshooting |
| `FAQ.md` | General support |
| `connections/connecting-to-a-provider.md` | Provider connection setup |
| `connections/local-model.md` | Provider connection setup |
| `connections/local-self-hosted.md` | Provider connection setup |
| `connections/organizing-connections.md` | Provider connection management |
| `connections/providers-reference.md` | Provider reference |
| `connections/subscription-clis.md` | Provider connection setup |
| `settings/settings-overview.md` | Application settings shell |
| `development/architecture-map.md` | Contributor architecture |
| `development/code-cleanup-audit.md` | Contributor audit |
| `development/file-storage.md` | Implementation internals |
| `development/frontend.md` | Contributor frontend architecture |
| `development/hierarchical-locations-prd-v3.md` | Internal product requirements superseded by user guide |
| `development/ios-pwa-safe-area.md` | Contributor UI notes |
| `development/noodle-internals.md` | Implementation internals |
| `development/optional-agent-packages.md` | Contributor packaging internals |
| `noodle/overview.md` | Timeline/chat UX outside selected portable artifacts |
| `noodle/settings.md` | Timeline/chat UX outside selected portable artifacts |
| `integrations/discord-mirror.md` | Runtime integration |
| `integrations/haptic-feedback.md` | Runtime integration |
| `integrations/home-assistant.md` | Runtime integration |
| `integrations/message-translation.md` | Runtime integration |
| `data/clearing-data.md` | Destructive maintenance workflow |
| `characters/bot-browser.md` | Remote catalog browsing |
| `characters/library-organization.md` | Library navigation and folders without new artifact fields |
| `appearance/appearance-settings.md` | Application appearance shell |
| `appearance/chat-backgrounds.md` | Application chrome background |
| `appearance/custom-css-themes.md` | Whole-application theming rather than card CSS |
| `appearance/fonts.md` | Application appearance |
| `chats/branches.md` | Branch navigation beyond imported-branch semantics already captured |
| `chats/guided-and-impersonate.md` | Runtime generation UX |
| `chats/managing-chats.md` | Chat-list navigation |
| `chats/messages.md` | Routine chat editing UX |
| `chats/peek-prompt.md` | Prompt inspection UI; macro boundary captured on prompt pages |
| `chats/sending-and-streaming.md` | Routine chat runtime |
| `chats/slash-commands.md` | Live command inventory |
| `game/combat.md` | Runtime game play rather than selected authoring schema |
| `game/dice-and-skill-checks.md` | Runtime game play |
| `game/getting-started.md` | Game onboarding |
| `game/map-time-weather.md` | Runtime game-state controls outside selected artifact coverage |
| `home/achievements.md` | Application gamification |
| `home/tutorial.md` | Onboarding |
| `home/welcome.md` | Onboarding |
| `media/comfyui.md` | Image-provider setup |
| `media/illustrator-agent.md` | Runtime image-generation integration |
| `media/image-providers.md` | Image-provider setup |
| `media/music.md` | Runtime audio integration |
| `media/scene-video.md` | Runtime video-generation integration |
| `media/tts-setup.md` | TTS provider setup |
| `roleplay/combat-encounters.md` | Runtime roleplay combat |
| `roleplay/getting-started.md` | Roleplay onboarding |

All 118 Markdown files in the pin are classified individually: 57 included authoring sources and 61
evaluated exclusions. Every `conversation/` file is included.
