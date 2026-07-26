<div align="center">

<img src="docs/media/hoplight-v.png" alt="" width="72">

<sub>· A CONEJA-CHIBI PRODUCTION ·</sub>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/hoplight-wordmark-dark.png">
  <img src="docs/media/hoplight-wordmark-light.png" alt="Hoplight" width="460">
</picture>

*A local studio for portable AI-roleplay content.*

*From the maker of [BunnyMo](https://github.com/Coneja-Chibi/BunnyMo),
[TunnelVision](https://github.com/Coneja-Chibi/TunnelVision), and
[VectHare](https://github.com/Coneja-Chibi/VectHare).*

<p>
  <img alt="Status" src="https://img.shields.io/badge/Status-Active_Development-F20D3F">
  <img alt="License" src="https://img.shields.io/badge/License-AGPL--3.0-0a0a0b">
  <img alt="Runtime" src="https://img.shields.io/badge/Runtime-Bun_1.3+-f9f1e1">
</p>

</div>

---

## 💡 The core thesis

> **Create, edit, and keep your work in a studio linked to no platform. Publish it into a
> platform's format only when you choose.**

Hoplight has three structural foundations:

- one canonical model in the middle
- one honest adapter per platform
- one local library of plain JSON files

## Table of contents

1. [What is Hoplight?](#-what-is-hoplight)
2. [Install](#-install)
3. [The format problem](#-the-format-problem)
4. [How it works](#%EF%B8%8F-how-it-works)
5. [One card, start to finish](#%EF%B8%8F-one-card-start-to-finish)
6. [The Studio](#-the-studio)
7. [The CLI](#-the-cli)
8. [Supported formats](#-supported-formats)
9. [Safety and privacy](#-safety-and-privacy)
10. [Project status](#%EF%B8%8F-project-status)
11. [Architecture](#%EF%B8%8F-architecture)
12. [Contributing](#-contributing)

## 🎪 What is Hoplight?

Hoplight is a local studio for AI-roleplay work. Characters, lorebooks, personas, presets, regex
sets, and sprite packs live together instead of being scattered across the apps that consume them.
Its primary surfaces are:

- **Library** for importing and organizing content
- **Workbench** for authoring and editing pieces
- **Binder** for editing lorebooks
- **Press** for exporting to platform formats

The Studio copy is authoritative. Platforms are export targets.

When you import something, Hoplight maps it into a canonical piece and keeps the original source
and unmapped platform fields in escrow. When you export, an adapter writes the target format and
reports what was exported, what was retained locally, and what the target cannot represent.

<img src="docs/media/shot-library.png" alt="The Hoplight Library">

## 🚀 Install

Download the latest build from [Releases](https://github.com/Coneja-Chibi/Hoplight/releases).

| Platform | Download | Run |
| --- | --- | --- |
| **Windows** | `Hoplight.exe` | Double-click it |
| **macOS** | `hoplight-darwin-arm64` or `hoplight-darwin-x64` | `chmod +x`, run it with `ui`, open the printed address |
| **Linux** | `hoplight-linux-x64` | `chmod +x`, run it with `ui`, open the printed address |

Windows may show a SmartScreen warning because the binary is unsigned. Releases include
`SHA256SUMS` if you want to verify the download. If the app starts without opening a window, install
[Microsoft WebView2](https://developer.microsoft.com/microsoft-edge/webview2/).

Your pieces live in `Documents/Hoplight Studio`. Updating or replacing the app does not replace
that folder.

### Run from source

You need [Bun](https://bun.sh) 1.3 or newer.

```bash
git clone https://github.com/Coneja-Chibi/Hoplight
cd Hoplight
bun install
bun run dev
```

The Studio binds to loopback. Open the local address it prints.

### Update

Hoplight does not update itself. Use **Settings > About > Check for updates**, then replace your
downloaded binary with the new release.

For a source checkout:

```bash
git pull
bun install
```

Restart Hoplight afterward. Your Studio library stays where it is.

### Bring in your work

Drop a card, book, preset, or archive into the Library. Hoplight detects the format, imports every
piece it can identify, and gives you a plain-language receipt.

Example commands:

```bash
bun run hoplight formats
bun run hoplight inspect samples/sillytavern/characters/Seraphina.png
bun run hoplight convert samples/sillytavern/characters/v3-full.json out.charx --to risu
```

## 🧠 The format problem

The ecosystem does not have one card format with different file extensions. It has related and
unrelated formats with different capabilities:

- SillyTavern uses raw JSON, embedded PNG data, and charx containers.
- RisuAI builds on CCv3 with its own modules and archive behavior.
- RoleCall and Agnai have native fields with no direct CCv3 slot.
- Lumiverse, Marinara, and Chub use different extension bags.
- Backyard has both legacy JSON and its own archive.
- NovelAI lorebooks are a separate family entirely.

A file opening in two apps does not mean those apps read the same fields. Copies also drift as soon
as you edit them independently.

Hoplight keeps one canonical piece and translates at the boundary:

| Platform-bound workflow | Hoplight |
| --- | --- |
| One copy per app | One master with many publish targets |
| Embedded lorebook welded into a card | Linked, separately editable pieces |
| Export losses discovered afterward | Coverage and readiness shown before export |
| Platform-owned storage | Plain files in a folder you control |
| Imported scripts trusted by default | Sealed data with explicit test benches |

### Why not use each platform's editor?

Platform editors are built to make content work inside that platform. That is their job. They
cannot reliably show another platform's view of the same piece.

Hoplight's editor lens can:

- dim or hide fields the selected target does not carry
- show native platform fields without turning the editor into a JSON dump
- use the same coverage declarations as export readiness
- keep linked characters, lorebooks, and media synchronized at publish time

If a platform disappears, you lose a publish target, not your source library.

## ⚙️ How it works

Every format maps to and from one canonical model. Adapters never convert directly into one another.

```text
SillyTavern ──┐                 ┌── RisuAI
Backyard ─────┤                 ├── RoleCall
Agnai ────────┤    canonical    ├── Chub
Pygmalion ────┤      model      ├── Lumiverse
NovelAI ──────┤                 ├── Marinara
CCv3 ─────────┘                 └── your Studio JSON
```

### Hub and spoke

Direct format-to-format conversion grows toward N². A canonical hub needs one adapter per format.
Adding a platform is a folder under `src/formats/`; the registry, CLI, Studio, and Press discover it.

Real fixtures and round-trip tests verify the adapter's claims.

### Escrow

Import does not discard data just because the canonical model lacks a first-class field for it.
Hoplight stores:

- the parsed source snapshot
- unmapped platform fields
- links to extracted pieces such as embedded lorebooks

Same-format exports obey the semantic Round-Trip Law. Formats with an explicit byte-level tier must
prove that stronger guarantee with fixtures. Cross-format exports report uncovered fields instead
of pretending every concept has an equivalent.

### Sealed scripts

Cards can carry Lua, macros, and regex rules. Hoplight treats them as data during import,
conversion, storage, and export.

Execution is user-invoked only inside the isolated Lua or regex test bench. There is no second
execution path hidden in an adapter or import hook.

## 🎞️ One card, start to finish

```text
Drop Seraphina.png into the Library
  ↓
Detection identifies a SillyTavern character card
  ↓
The receipt names the character, portrait, greeting, and embedded lorebook
  ↓
The original source and unmapped fields enter escrow
  ↓
The embedded lorebook becomes a linked, editable piece
  ↓
Open the character on the Workbench with the RisuAI lens
  ↓
Fields Risu cannot carry are visible before export
  ↓
Stage the character and include the linked lorebook
  ↓
The Press writes a charx bundle and an honest result report
```

The Studio copy remains the source of truth throughout.

## 🎭 The Studio

The Studio surfaces share one engine, one Studio folder, and one set of canonical entities.

### 📚 Library

The Library handles import, organization, and batch selection.

- Decks separate characters, lorebooks, personas, packs, presets, and regex sets.
- Grid, showcase, list, and gallery views suit different kinds of work.
- Import receipts explain what arrived and where linked pieces came from.
- Multi-select can stage a batch for the Press.
- Shelf operations expose relevant verbs such as duplicate, merge, split, attach, and combine.
- Right-click menus come from one shared system rather than one-off controls.

The Library reads the disk. Counts and pieces reflect the Studio folder, not a second database.

<details>
<summary><b>Library details</b></summary>

Each deck exposes operations relevant to its content type. Lorebooks can split or merge, regex sets can combine, and
characters can attach or detach linked books. Operations that would destroy or overwrite content
require an explicit choice.

The art dial continuously changes card density instead of forcing a few hardcoded sizes. Open
Beside pins two pieces into a split workspace, including two entries from the same lorebook.

</details>

### 🎬 Workbench

The Workbench contains the editors.

- Canonical fields remain the stable center.
- Platform tabs expose native field bags only where the platform owns them.
- The lens shows target coverage while you write.
- Readiness summarizes missing, incompatible, or platform-specific content.
- Media tools manage portraits, sprites, expression maps, and referenced assets.
- Tabs and splits belong to the Studio shell, so open work survives room changes.

The editor does not silently rewrite escrow or flatten unknown platform data.

<details>
<summary><b>Character and media details</b></summary>

Character editing covers identity, voice, scenario, greetings, examples, creator metadata, linked
knowledge, platform-native extensions, and media. Portrait and sprite ownership remain explicit so
an export can say which assets fit the target container.

The guided interview can grow a card from answers without making the form disappear. Every result
still lands in normal editable fields.

</details>

<details>
<summary><b>Regex bench</b></summary>

Regex rules are stored data. The bench can test a selected rule against sample text in a terminable
worker with a hard deadline. Importing a regex set never runs it.

</details>

### 📖 Binder

The Binder is the lorebook editor.

- A table of contents keeps the whole book visible.
- Entries expose primary and secondary triggers, logic, probability, timing, and placement.
- Budget estimates show which entries fit and why another was evicted.
- Health checks find dead triggers, impossible conditions, duplicate keys, and other repairable
  problems.
- Write-For lenses show which controls a target format owns.
- The activation simulator explains why an entry fired, slept, or lost the budget.

Linked lorebooks remain independent pieces. Editing a book updates the version available to linked
characters at export time.

### 🖨️ Press

The Press turns staged pieces into target files.

- Stage single pieces or a mixed batch.
- Linked lorebooks can be included with their character as a bundle.
- Readiness runs before export.
- Filename controls remain visible before files are written.
- Each result row reports success, warnings, and uncovered fields.
- Batch output can become one zip without hiding per-file results.

Formats cannot carry every concept. The Press reports unsupported fields before and after export.

### 🎨 Other surfaces

The **CSS Workshop** edits theme tokens against real Studio components. Settings owns appearance,
Studio location, provider configuration, updates, and other global choices.

Detailed surface documentation lives in [docs/reference/ui.md](docs/reference/ui.md), and shared
controls are cataloged in [docs/reference/components.md](docs/reference/components.md).

## ⌨️ The CLI

The CLI is another shell over the same engine.

| Command | Purpose |
| --- | --- |
| `hoplight inspect <file>` | Describe a file in plain language |
| `hoplight validate <file>` | Detect and parse; exit 0 when openable |
| `hoplight label <file>` | Identify likely format and origin |
| `hoplight convert <in> <out> [--to id]` | Convert through the canonical model |
| `hoplight formats` | List installed adapters |
| `hoplight ui [port] [studioDir]` | Start the visual Studio |

Add `--json` to validate, formats, or convert for machine-readable output. Inspect currently prints
human-readable detail; [the CLI reference](docs/reference/cli.md) records the exact current contract.

Kit, the interactive TUI, is an active-development preview available from a source checkout with
`bun run kit`. It uses progressively disclosed tools, preview-before-apply changes, and the same
Studio backend rather than a parallel agent filesystem. Kit is not included in the current GitHub
release binaries.

## 📡 Supported formats

Hoplight currently covers formats from:

- SillyTavern and portable CCv2/CCv3
- RisuAI
- RoleCall
- Backyard
- Agnai
- Pygmalion
- Lumiverse
- Marinara
- Chub
- NovelAI lorebooks

Support varies by content kind, direction, and field. The generated
[format matrix](docs/FORMAT-SUPPORT.md) is the source of truth.

## 🔒 Safety and privacy

Hoplight is local-first and fail-closed:

- Studio content is plain JSON in a folder you control.
- The local server binds to loopback by default.
- Remote access is an explicit, separately authenticated mode.
- Paths resolve inside the configured Studio root.
- Writes use create-only or atomic replacement behavior.
- Input is schema-validated at the boundary.
- Archives and request bodies have hard size limits.
- Imported scripts remain sealed except in explicit isolated test benches.
- Provider use is opt-in and configured by the user.

Read [SECURITY.md](SECURITY.md) for the threat model, implementation detail, and private reporting
address.

## ❓ FAQ

### Is my content private?

The default Studio is local and has no account. Provider calls happen only when you configure and
use provider-backed features. Remote access must be enabled explicitly.

### Can conversion damage the source?

Hoplight stores the imported source snapshot and unmapped data in escrow. Same-format round trips
must meet the adapter's declared fidelity tier. Cross-format output includes a loss report because
some concepts genuinely have no destination.

### Do I need an API key?

No for importing, editing, inspecting, validating, converting, or deterministic analysis.
Provider-backed Kit and generation features are optional and use your configured provider.

### Will Hoplight run scripts embedded in cards?

Not during import, conversion, storage, or export. Execution exists only in explicit isolated test
benches.

### Can another platform be added?

Yes. Format adapters are drop-in folders. Start from `src/formats/_template/`, include real
fixtures, and prove the round trip.

### Why AGPL?

So the community can keep improvements to the Studio available. See
[LICENSING.md](LICENSING.md) for the plain-language explanation.

### How much of the code was AI-assisted?

Roughly 60/30. The 60 is AI writing code. The 30 is me: drafting, planning, project management,
design, and testing. Everything merges through the same gates regardless of who typed it: the test
suite, the round-trip law, and the CI guards. Bugs get fixed the same way too.

## 🗺️ Project status

Hoplight is in active development.

| Area | Status |
| --- | --- |
| Canonical engine, detection, conversion, escrow | Live |
| Character, lorebook, persona, media, preset, and regex workflows | Live and expanding |
| Local Studio and Press | Live |
| CLI | Core commands live |
| Kit TUI and studio agent | Active development |
| Test Stage, productions, history, and advanced creative tools | Planned or partial |

Milestones are complete only after live verification in a real install. See
[docs/ROADMAP.md](docs/ROADMAP.md) for current exit criteria and sequencing.

## 🏗️ Architecture

Hoplight uses Bun and strict TypeScript. The engine is pure where possible; filesystem, server,
provider, and UI effects stay at the edges. The CLI, Studio, and Kit share the same engine.

```text
src/
  core/        canonical model, detection, coverage, lore/regex/macro engines
  entities/    one canonical schema per content kind
  formats/     one drop-in adapter folder per platform
  studio/      local storage, path containment, atomic writes
  sandbox/     sealed-script analysis and explicit test benches
  ui/          loopback server and React Studio
  kit/         interactive TUI, tools, provider loop, staged changes
  cli.ts       argv-shaped shell over the engine
```

Folders are the schema. Format adapters, apps, settings sections, tours, and other extensible
surfaces register by existing rather than by editing a central list.

Start here:

| Document | Purpose |
| --- | --- |
| [Vision](docs/01-VISION.md) | Product boundaries and audience |
| [Architecture](docs/02-ARCHITECTURE.md) | Canonical model and system shape |
| [Conventions](docs/03-CONVENTIONS.md) | Code and repository doctrine |
| [Reference](docs/reference/README.md) | Current surfaces and formats |
| [Decisions](docs/decisions/ADR-001-runtime.md) | Consequential choices and reasoning |

## 🤝 Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) before changing code.

Every change needs proof. Bug fixes begin with a failing test; UI behavior needs live verification;
format work must preserve escrow and satisfy the round-trip law.

AI-assisted contributions are welcome. Disclose the model used in the pull request.

```bash
bun run verify:ci
```

Hoplight is licensed under AGPL-3.0. See [LICENSING.md](LICENSING.md).

<div align="center">

*Your favorite rabbit's favorite ~~rabb~~ perfectly normal woman.* ✨

</div>
