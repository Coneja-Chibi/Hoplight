---
id: README
title: Documentation
audience: dev
summary: Where every doc lives, docs/guide teaches someone using Hoplight, docs/reference documents vaud for someone building on it, and the decision records and founding planning docs sit alongside both.
tags: [docs, index, guide, reference, map]
related: [guide/getting-started, reference/README, reference/architecture, ROADMAP]
---

# Documentation

This is the documentation for Hoplight, the Vaudeville Studios desktop app for AI-roleplay content:
characters, lorebooks, personas, presets, and regex sets. Its engine and CLI are called vaud, and its
UI is a Bun and React app. The docs split by audience: `docs/guide` teaches someone using the app, one
task per page; `docs/reference` documents the engine and the UI for someone building on it. Decision
records and the founding planning docs sit alongside both.

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
| [reference/ui.md](reference/ui.md) | The visual app: `vaud ui`, the local server, the React shell. |
| [reference/components.md](reference/components.md) | The UI component catalog, auto-generated from source. |
| [reference/platform-native-fields.md](reference/platform-native-fields.md) | Verified native-field research behind each platform's native field bag. |

Chub has a guide page but no dedicated reference page yet; its format is documented in the coverage
matrix and its source folder, same as any adapter without a reference page of its own.

## Decisions and planning

`docs/decisions/` holds nine ADRs, ADR-001 through ADR-009, the consequential choices and why they went
the way they did; read them in order, later ones supersede earlier ones where their heading says so.
`01-VISION.md`, `02-ARCHITECTURE.md`, and `03-CONVENTIONS.md` are the founding planning docs: who
Hoplight is for, the originally planned repo layout, and the binding code and process conventions.
`02-ARCHITECTURE.md`'s own heading calls its layout "the future `vaudeville-studios` code repo"; the
as-built architecture is [reference/architecture.md](reference/architecture.md). `ROADMAP.md` carries the
current milestones and exit criteria. `FORMAT-SUPPORT.md` is the per-field format matrix, generated from
the live adapter registry (`bun run matrix`).

`docs/generated/`, `docs/figures/`, and `docs/media/` hold the field tables, diagram data, and
screenshots the pages above embed. They are not pages to browse on their own.
