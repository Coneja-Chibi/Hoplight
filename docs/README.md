---
id: README
title: Documentation
audience: dev
summary: Where every Hoplight document lives, from user guides and current references to accepted decisions, future specifications, and generated navigation.
tags: [docs, index, guide, reference, map]
related: [guide/getting-started, reference/README, reference/architecture, ROADMAP]
---

# Documentation

This is the documentation for Hoplight, a local-first tool for AI-roleplay characters, lorebooks,
personas, presets, regex sets, and related assets. `docs/guide` teaches someone using the product, one
task per page. `docs/reference` documents the shipping engine and surfaces for contributors.
`docs/decisions` records accepted architecture choices, while `specs/` describes planned or
load-bearing contracts without implying that every specification already ships.

## Guide

| Page | Covers |
| --- | --- |
| [guide/getting-started.md](guide/getting-started.md) | Install, the first-run wizard, the Dock, bringing in your first file. |
| [guide/importing.md](guide/importing.md) | Bring a file into the Library and read the import receipt. |
| [guide/converting.md](guide/converting.md) | Convert a card from one platform's format to another. |
| [guide/editing.md](guide/editing.md) | Open a piece on the Workbench, edit it, save the draft. |
| [guide/exporting.md](guide/exporting.md) | Send a piece out through the character editor, or a staged batch. |
| [guide/lorebooks.md](guide/lorebooks.md) | Add entries to a lorebook: keywords, triggers, and position. |
| `guide/platforms/*.md` | One page per source platform: Agnai, Backyard, Chub, Lumiverse, Marinara, NovelAI, Pygmalion, RisuAI, RoleCall, SillyTavern. |

## Reference

| Page | Covers |
| --- | --- |
| [reference/README.md](reference/README.md) | The reference tree's own contract, and how to read a field table. |
| [reference/architecture.md](reference/architecture.md) | The engine: canonical model, escrow, the adapter contract, entity kinds, the registry, the CLI. |
| `reference/entities/*.md` | The canonical schema for each entity kind: character, lorebook, pack, persona, preset, regex. |
| [reference/formats/README.md](reference/formats/README.md) | The coverage matrix, and one reference page per format family. |
| `reference/concepts/*.md` | Cross-cutting engine concepts: the embedded character_book, the persona editor, the regex editor, the regex engine, safe rendering, the tag taxonomy. |
| [reference/ui.md](reference/ui.md) | The visual app: `hoplight ui`, the local server, the React shell, and Kit. |
| [reference/components.md](reference/components.md) | The UI component catalog, auto-generated from source. |
| [reference/platform-native-fields.md](reference/platform-native-fields.md) | Verified native-field research behind each platform's native field bag. |

Chub has a guide page but no dedicated reference page yet; its format is documented in the coverage
matrix and its source folder, same as any adapter without a reference page of its own.

## Decisions and planning

`docs/decisions/` holds the accepted ADRs; read them in order, and follow explicit supersession notes.
`01-VISION.md`, `02-ARCHITECTURE.md`, and `03-CONVENTIONS.md` are the required product, architecture,
and implementation spine. The detailed source map is
[reference/architecture.md](reference/architecture.md). `ROADMAP.md` carries milestones and exit
criteria. `FORMAT-SUPPORT.md` is the per-field format matrix generated from the live adapter registry
with `bun run matrix`.

`docs/generated/`, `docs/figures/`, and `docs/media/` hold the field tables, diagram data, and
screenshots the pages above embed. They are not pages to browse on their own.
