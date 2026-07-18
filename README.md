<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/vaude-wordmark-dark.png">
  <img src="docs/media/vaude-wordmark-light.png" alt="Vaudeville Studios" width="380">
</picture>

<h1>Hoplight 🐰</h1>
<h3>Your AI-roleplay characters, out of everyone else's basement.</h3>

<p>
  <img alt="Status" src="https://img.shields.io/badge/status-active_development-e11d48">
  <img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-0a0a0b">
  <img alt="Runtime" src="https://img.shields.io/badge/runtime-Bun_1.3+-f9f1e1">
  <img alt="Tests" src="https://img.shields.io/badge/tests-~1950_passing-2f7d4f">
  <img alt="Local" src="https://img.shields.io/badge/cloud-none._ever.-e11d48">
</p>

<p>
  <a href="#-faq">FAQ</a> ·
  <a href="docs/FORMAT-SUPPORT.md">Format matrix</a> ·
  <a href="docs/ROADMAP.md">Roadmap</a> ·
  <a href="LICENSING.md">License, in plain words</a>
</p>

</div>

---

## 🎪 What is this, actually?

If you make or collect AI-roleplay characters, you know the problem: **every platform invented its
own format, and none of them talk to each other.** Your best character is a SillyTavern PNG. Your
friend uses RisuAI. That lorebook you spent a weekend on is welded inside a card you can't open
anywhere. The platform hosting your library could change its rules, or just vanish, tomorrow.
Your work is scattered across other people's apps, in other people's formats, on other people's
servers.

Hoplight is a **local-first studio** that ends that. It reads every major card format into one
canonical model, gives you real editors for all of it (characters, lorebooks, personas, presets,
regex sets, sprites), and prints back to whichever platform you're publishing to today. Your whole
library becomes a folder of plain JSON on your own disk: yours to keep, version, back up, and grep.

**Who it's for:**

- 🎭 **Botmakers** who publish to more than one platform and are tired of maintaining five copies
  of the same character by hand
- 📦 **Collectors** with hundreds of cards across formats who want one library, one search, one
  place
- ✍️ **Writers** who want a real editor for the craft (lorebook keys, activation rules, token
  budgets, per-platform field honesty) instead of a webform in someone's app
- 🚪 **Anyone leaving a platform** with their library under their arm

## 🖥️ The studio

<table>
  <tr>
    <td width="50%">
      <img src="docs/media/shot-library.png" alt="The Library: deck chips with live counts, card grid with cover art">
      <p align="center"><sub><b>The Library</b> · every piece you own, browsable by kind, art forward</sub></p>
    </td>
    <td width="50%">
      <img src="docs/media/shot-casting.png" alt="The Workbench: guided casting flow beside a live proof card">
      <p align="center"><sub><b>The Workbench</b> · a guided casting interview builds the card while the proof sheet takes shape</sub></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/media/shot-lorebook.png" alt="The lorebook binder: table of contents, per-entry keys, activation rules">
      <p align="center"><sub><b>The binder</b> · lorebooks as a real editor: keys, activation rules, budgets, health checks</sub></p>
    </td>
    <td width="50%">
      <img src="docs/media/shot-press.png" alt="The Press: staged kit with a linked lorebook riding, readiness lines, one target platform">
      <p align="center"><sub><b>The Press</b> · batch export: a character travels as a kit with his linked books, every card states its readiness</sub></p>
    </td>
  </tr>
</table>

<details>
<summary>🎬 First run: the setup wizard</summary>
<br>
<img src="docs/media/shot-setup.png" alt="First-run wizard: theme, first deck, publish targets, accent, with a live stage preview">
<p><sub>Four questions, a stage that lights up as you answer, and everything can change later.</sub></p>
</details>

## ⚙️ What it does that others don't

- **Converts honestly.** One canonical model in the middle, an adapter per platform. What a
  platform can't carry is *reported*, never silently dropped, and your original file rides along
  in escrow, so a same-format round trip loses nothing. The conversion report tells you what
  moved and what stayed home, in sentences.
- **Edits with a lens.** Tell the editor which platform you're writing for and it dims every
  field that platform won't carry. You stop guessing which of your work survives the export.
- **Thinks in kits.** A character owns his linked lorebooks. Import a card and its embedded book
  becomes a real, editable piece; print the character and the book rides along. (A kit is also a
  baby rabbit. This is not a coincidence.)
- **Executes nothing.** Cards can carry scripts. Hoplight treats them as sealed data: inspected,
  reported, carried faithfully, never run. There's a full sandbox design written for the day that
  changes, and until it ships, the law is the law.
- **Stays on your machine.** The studio is a loopback-only local server. No accounts, no
  telemetry, no phone-home, no cloud. Ever.

## ❓ FAQ

**Is my content private?**
Completely. Everything runs on your machine, the studio only listens on localhost, and nothing in
this codebase makes an outbound network call. Your studio folder is plain JSON files you can read
yourself.

**Can a conversion damage my cards?**
The original file is kept in escrow inside the saved piece, so converting never destroys anything.
Same-format round trips are byte-honest; cross-format conversions produce a plain-words report of
exactly what mapped and what didn't. Around 1,950 tests, including a round-trip law suite, hold
that line in CI.

**Do I need an API key?**
No. Hoplight does its job with zero AI calls. Planned AI features (the Script Doctor's treatment
planner, the Table Read interview) will be strictly bring-your-own-key and opt-in; the
deterministic parts will always work with no key at all.

**Will it run the scripts embedded in cards?**
No. Scripts, macros, and Lua blobs are carried as sealed data and printed back faithfully, but
never executed. That's a safety stance, not a missing feature.

**Which platforms?**
SillyTavern (V2/V3 JSON, PNG, charx), RisuAI, RoleCall, Backyard (.byaf and legacy), Agnai,
Pygmalion, Lumiverse, Marinara, Chub, NovelAI lorebooks, and portable Default CCv3 for everything
else. Per-field honesty for each lives in [docs/FORMAT-SUPPORT.md](docs/FORMAT-SUPPORT.md).

**A platform I use isn't supported. Can it be?**
Formats are drop-in adapter folders; the filesystem is the schema. Open an issue with sample
files, or add the folder yourself; the round-trip suite will tell you when it's honest.

**CLI or app?**
Both, same engine. The studio is the daily driver; the CLI (`vaud`, being renamed) does convert,
inspect, validate, and label for scripts and batch work, with `--json` for machines.

**Why AGPL?**
Because the freedom should travel with the code: nobody gets to take this, close it up, and sell
it back to the community it came from. Plain-words version in [LICENSING.md](LICENSING.md).

**What's with the name?**
Hop × limelight. Hoplight is the stagehand rabbit who lights your way around the studio, and
Vaudeville Studios is the production house she works for. The crossed searchlights in the wordmark
are her doing.

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

Ground truth with exit criteria per milestone: [docs/ROADMAP.md](docs/ROADMAP.md). The deeper
plans (per-jewel build docs, ticket decks through M3) live in the production notes.

### ✅ Shipped

The foundation: canonical schemas, escrow envelope, PNG codec, and the round-trip law enforced in
CI. The converter CLI. The character forge, closed against nine-plus platforms with native field
editors and a per-platform honesty lens. The media pipeline (portraits, sprite packs). The full
lorebook binder. Regex and persona editors. The Risu Workshop with its sealed test bench. The
Press with kit-grouped batch export.

### 🔨 In the shop

- 🃏 **The preset editor** · the last content type; the hybrid editor design is locked and the
  build plan is phased
- 🖨️ **The Press ledger** · run history, saved print jobs, re-print, and "edited since" staleness
  flags
- 🐰 **Hoplight herself** · the stagehand rabbit takes over the tours, empty states, and loading
  beats; mark candidates drawn, one gets picked
- 📚 **Reference pages** for the four newest platform adapters
- 📦 **Desktop packaging** · the studio already runs as the daily driver; formal releases remain

### 🗺️ Next

- 🩺 **The Script Doctor** · deterministic card audits (format errors, token waste,
  contradictions, slop banks) with a health score; runs with no API key; ticket deck already cut
- 🔐 **The capability sandbox** · a three-layer design for someday running card scripts safely;
  until it ships, scripts stay sealed data by law
- 🧠 **The Brain** · provider layer and an agent loop over your studio; bring your own key, local
  models included

### 🎭 The long game

- 🎤 **The Table Read** · an interview engine that grows a card from a conversation, from a
  five-minute Cold Read to a Deep Dive
- 🎬 **Productions** · workspace folders with content-addressed history: edit a field, replay the
  same test line, watch the output change
- 🗃️ **The Archives + the World Forge** · distill characters from real chat logs with per-claim
  citations; interview-grown worlds with a standing continuity desk
- 🏢 **The Company** · the dock already holds its seat

## 🔧 Under the hood

Bun + TypeScript, strict. A pure engine core with side effects pushed to the edges; the CLI and
the studio are two thin shells over the same engine. Apps, format adapters, settings sections, and
deck views are all drop-in folders: the filesystem is the schema. CI runs ~1,950 tests plus a
color-token guard, a file-size cap, prose gates, and a license audit that fails the build if a
restricted dependency sneaks in.

| Read order | |
| --- | --- |
| [docs/01-VISION.md](docs/01-VISION.md) | What this is for, and who for |
| [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md) | The canonical model and how adapters hang off it |
| [docs/03-CONVENTIONS.md](docs/03-CONVENTIONS.md) | Code style and the rules the hooks enforce |
| [docs/reference/](docs/reference/README.md) | Per-format, per-entity, per-surface reference |
| [docs/decisions/](docs/decisions/ADR-001-runtime.md) | Why the consequential choices went the way they did |

## 📜 License

[AGPL-3.0-or-later](LICENSE). Use it, change it, share it; the freedom travels with the code.
Dependencies stay permissive, enforced by `bun run license:audit`.

<div align="center">
<br>
<sub>🎭 a Coneja-Chibi production 🎭</sub>
</div>
