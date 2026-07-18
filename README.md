<div align="center">

<img src="docs/media/vaudeville-v.png" alt="" width="72">

<sub>· A CONEJA-CHIBI PRODUCTION ·</sub>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/hoplight-wordmark-dark.png">
  <img src="docs/media/hoplight-wordmark-light.png" alt="Hoplight" width="460">
</picture>

<h3>The local-first studio for AI-roleplay content. 🐰</h3>

<p>
  <img alt="Status" src="https://img.shields.io/badge/status-active_development-F20D3F">
  <img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-0a0a0b">
  <img alt="Runtime" src="https://img.shields.io/badge/runtime-Bun_1.3+-f9f1e1">
  <img alt="Tests" src="https://img.shields.io/badge/tests-~1950_passing-2f7d4f">
  <img alt="Local" src="https://img.shields.io/badge/cloud-local_only-F20D3F">
</p>

<p>
  <a href="#-faq">FAQ</a> ·
  <a href="docs/FORMAT-SUPPORT.md">Format matrix</a> ·
  <a href="docs/ROADMAP.md">Roadmap</a> ·
  <a href="LICENSING.md">License, in plain words</a>
</p>

</div>

---

## 🎪 What is this?

Every AI-roleplay platform has its own card format, and they don't talk to each other. A character
made for SillyTavern doesn't open in RisuAI. A lorebook embedded in a card can't be edited outside
the app that made it. If a platform shuts down or changes its rules, the work you keep there goes
with it.

Hoplight fixes this locally. It reads every major card format into one canonical model, gives you
full editors for characters, lorebooks, personas, presets, regex sets, and sprites, and exports
back to whichever platform you need. Your library lives as plain JSON files in a folder on your
own disk, so you can version it, back it up, and search it like anything else you own.

**Who it's for:**

- Botmakers who publish to more than one platform and don't want to maintain separate copies by
  hand
- Collectors with large libraries spread across formats
- Writers who want a real editor for lorebook keys, activation rules, and token budgets
- Anyone leaving a platform who wants to take their library with them

## 🖥️ The studio

<table>
  <tr>
    <td width="50%">
      <img src="docs/media/shot-library.png" alt="The Library: deck chips with live counts, card grid with cover art">
      <p align="center"><sub><b>The Library</b> · every piece you own, browsable by kind</sub></p>
    </td>
    <td width="50%">
      <img src="docs/media/shot-casting.png" alt="The Workbench: guided casting flow beside a live proof card">
      <p align="center"><sub><b>The Workbench</b> · a guided interview builds the card; the proof sheet fills in as you answer</sub></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/media/shot-lorebook.png" alt="The lorebook binder: table of contents, per-entry keys, activation rules">
      <p align="center"><sub><b>The binder</b> · lorebook editing with keys, activation rules, budgets, and health checks</sub></p>
    </td>
    <td width="50%">
      <img src="docs/media/shot-press.png" alt="The Press: staged kit with a linked lorebook riding, readiness lines, one target platform">
      <p align="center"><sub><b>The Press</b> · batch export; a character brings its linked lorebooks, and every card shows its readiness for the target platform</sub></p>
    </td>
  </tr>
</table>

<details>
<summary>First run: the setup wizard</summary>
<br>
<img src="docs/media/shot-setup.png" alt="First-run wizard: theme, first deck, publish targets, accent, with a live stage preview">
<p><sub>Four questions. Everything can change later.</sub></p>
</details>

## ⚙️ What makes it different

- **Honest conversion.** One canonical model in the middle, one adapter per platform. Anything a
  platform can't carry is reported instead of silently dropped, and the original file is kept in
  escrow inside the saved piece, so a same-format round trip is lossless.
- **A per-platform lens.** Tell the editor which platform you're writing for and it dims the
  fields that platform won't carry. You always know which work survives the export.
- **Linked pieces stay linked.** Import a card and its embedded lorebook becomes a separate,
  editable piece that stays attached to the character. Export the character and the book comes
  along.
- **No script execution.** Cards can carry scripts and macros. Hoplight inspects and preserves
  them but never runs them.
- **Fully local.** The studio is a loopback-only local server. No accounts, no telemetry, no
  outbound calls.

## ❓ FAQ

**Is my content private?**
Yes. Everything runs on your machine, the server only listens on localhost, and nothing in the
codebase makes an outbound network call. Your studio folder is readable JSON.

**Can a conversion damage my cards?**
The original file is kept in escrow inside the saved piece, so nothing is destroyed by converting.
Same-format round trips are lossless, and cross-format conversions produce a report of what mapped
and what didn't. A round-trip test suite enforces this in CI.

**Do I need an API key?**
No. Nothing here calls an AI. Planned AI features (the Script Doctor's treatment planner, the
Table Read) will be bring-your-own-key and opt-in, and their deterministic parts will work without
a key.

**Will it run scripts embedded in cards?**
No. Scripts are carried as data and exported faithfully, but never executed.

**Which platforms?**
SillyTavern (V2/V3 JSON, PNG, charx), RisuAI, RoleCall, Backyard (.byaf and legacy), Agnai,
Pygmalion, Lumiverse, Marinara, Chub, NovelAI lorebooks, and portable CCv3 for everything else.
Per-field detail is in [docs/FORMAT-SUPPORT.md](docs/FORMAT-SUPPORT.md).

**A platform I use isn't supported. Can it be?**
Formats are drop-in adapter folders. Open an issue with sample files, or add the folder yourself;
the round-trip suite will tell you whether it's honest.

**CLI or app?**
Both, over the same engine. The studio is the main experience; the CLI covers convert, inspect,
validate, and label for scripts and batch work, with `--json` output.

**Why AGPL?**
So the code stays free: nobody can close it up and resell it. Plain-terms explanation in
[LICENSING.md](LICENSING.md).

**What does the name mean?**
Hop and limelight. The crossed-searchlight V is the maker's mark; the tapered H is the app's.

## 🚀 Quick start

Requires [Bun](https://bun.sh) 1.3 or newer.

```bash
git clone https://github.com/Coneja-Chibi/vaudeville-studios
cd vaudeville-studios
bun install

# what can we open?
bun run vaud formats

# peek at a card
bun run vaud inspect samples/sillytavern/Seraphina.png

# convert ST JSON to a Risu .charx
bun run vaud convert samples/sillytavern/v3-full.json out.charx --to risu

# the studio, local only
bun run dev
```

| Command | Purpose |
| --- | --- |
| `vaud convert <in> <out> [--to id]` | Convert between formats |
| `vaud inspect <file>` | Plain-words summary of any file |
| `vaud validate <file>` | Detect + parse; exit 0 if openable |
| `vaud label <file>` | Guess format and likely origin |
| `vaud formats` | List every adapter |
| `vaud ui [port] [studioDir]` | The visual studio (loopback only) |

## 🗺️ Where it is, where it goes

Milestones with exit criteria: [docs/ROADMAP.md](docs/ROADMAP.md).

### ✅ Shipped

Canonical schemas, the escrow envelope, the PNG codec, and a round-trip law enforced in CI. The
converter CLI. Character editing closed against nine-plus platforms with native field editors and
the per-platform lens. Portraits and sprite packs. The lorebook binder. Regex and persona editors.
The Risu Workshop with a sealed test bench. The Press.

### 🔨 In the shop

- **The preset editor** · the last content type; design locked, build plan phased
- **The Press ledger** · run history, saved print jobs, re-print, staleness flags
- **Hoplight the mascot** · takes over the tours, empty states, and loading screens
- **Reference pages** for the four newest platform adapters
- **Desktop packaging** · the studio already runs daily; formal releases remain

### 🗺️ Next

- **The Script Doctor** · deterministic card audits (format errors, token waste, contradictions)
  with a health score; no API key required
- **The capability sandbox** · a three-layer design for running card scripts safely; until it
  ships, scripts stay data
- **The Brain** · provider layer and an agent loop over your studio; BYOK, local models included

### 🎭 The long game

- **The Table Read** · an interview engine that grows a card from a conversation
- **Productions** · workspace folders with content-addressed history and replayable test lines
- **The Archives + the World Forge** · distill characters from chat logs with citations;
  interview-grown worlds with a continuity desk
- **The Company** · a reserved seat in the dock

## 🔧 Under the hood

Bun + TypeScript, strict. A pure engine core with side effects at the edges; the CLI and the
studio are thin shells over the same engine. Apps, format adapters, settings sections, and deck
views are drop-in folders. CI runs ~1,950 tests plus a color-token guard, a file-size cap, prose
gates, and a license audit that fails the build on restricted dependencies.

| Read order | |
| --- | --- |
| [docs/01-VISION.md](docs/01-VISION.md) | What this is for, and who for |
| [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md) | The canonical model and how adapters hang off it |
| [docs/03-CONVENTIONS.md](docs/03-CONVENTIONS.md) | Code style and the rules the hooks enforce |
| [docs/reference/](docs/reference/README.md) | Per-format, per-entity, per-surface reference |
| [docs/decisions/](docs/decisions/ADR-001-runtime.md) | Why the consequential choices went the way they did |

## 📜 License

[AGPL-3.0-or-later](LICENSE). Plain-terms version in [LICENSING.md](LICENSING.md). Dependencies
stay permissive, enforced by `bun run license:audit`.
