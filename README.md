<div align="center">

<img src="docs/media/vaudeville-v.png" alt="" width="72">

<sub>· A CONEJA-CHIBI PRODUCTION ·</sub>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/hoplight-wordmark-dark.png">
  <img src="docs/media/hoplight-wordmark-light.png" alt="Hoplight" width="460">
</picture>

*Every platform invented its own card format. Hoplight speaks all of them.* 🐰

<p>
  <img alt="Status" src="https://img.shields.io/badge/Status-Active_Development-F20D3F">
  <img alt="License" src="https://img.shields.io/badge/License-AGPL--3.0-0a0a0b">
  <img alt="Runtime" src="https://img.shields.io/badge/Runtime-Bun_1.3+-f9f1e1">
  <img alt="Tests" src="https://img.shields.io/badge/Tests-~1950_passing-2f7d4f">
  <img alt="Local" src="https://img.shields.io/badge/Cloud-none-F20D3F">
</p>

<p>
  <a href="#-faq">FAQ</a> ·
  <a href="docs/FORMAT-SUPPORT.md">Format matrix</a> ·
  <a href="#%EF%B8%8F-the-roadmap">Roadmap</a> ·
  <a href="LICENSING.md">License, in plain words</a>
</p>

</div>

---

### 💡 The Core Thesis

> **Your characters are yours. Not SillyTavern's, not Risu's, not whatever site happens to host them this year. Yours.**

Everything in this repo follows from that sentence. One canonical model in the middle, an honest
adapter per platform, and your whole library as plain JSON on your own disk. No accounts, no
telemetry, no cloud, no exceptions.

---

## 🎪 What the Hell is Hoplight?

You made a character for SillyTavern. Your friend uses RisuAI. Someone on Chub wants it too. So
now you're maintaining three copies of the same character by hand, they've already drifted apart,
and the lorebook you spent a weekend on is welded inside a PNG you can't open anywhere. 💀

That's not a workflow. That's hostage negotiation with file formats.

**Hoplight ends it.** It reads every major card format into one canonical model, gives you real
editors for all of it (characters, lorebooks, personas, presets, regex sets, sprites), and prints
back to whichever platform you're publishing to today.

| Without Hoplight | With Hoplight |
|---|---|
| Five copies of one character, all drifting | One piece, printed to any platform |
| Lorebook welded inside a card | A real editor, and the book stays linked to its character |
| "Did the export keep my greeting?" 🤞 | A report that names exactly what moved and what didn't |
| Your library on someone else's server | A folder of JSON on your own disk |
| Guessing which fields a platform reads | An editor lens that dims what the target won't carry |
| Cards with scripts you just... trust? | Scripts carried as data, never executed |

---

## 🎞️ One Card, Start to Finish

```
You drop Seraphina.png into the studio
 ↓
🔍 Detection figures out what it is (ST card? Risu? Backyard archive? lorebook?)
 ↓
🧾 You get a receipt in actual sentences:
   "Seraphina. A character card, made for SillyTavern.
    We kept her portrait, her greeting, and the lorebook that came embedded."
 ↓
🗄️ The ORIGINAL file is stored inside the saved piece (escrow),
   so nothing you imported can ever be lost by editing it
 ↓
📚 The embedded lorebook becomes its own editable piece, still linked to her
 ↓
✍️ You edit with the lens set to "RisuAI":
   fields Risu won't carry are dimmed, so you know before you export
 ↓
🖨️ You stage her for the Press → her linked book rides along automatically
 ↓
📦 One zip: seraphina.charx, her lorebook, and an honest per-file result line
```

That's the whole loop. Import honestly, edit with your eyes open, export with receipts.

---

## 🖥️ The Rooms

### 📚 The Library *(everything you own, one room)*

<img src="docs/media/shot-library.png" alt="The Library">

Every piece in your studio, split into decks by kind with live counts: characters, lorebooks,
personas, sprite packs, presets, regex sets. Three views (grid, showcase, list), a continuous
art-size dial, cover art pulled from the cards themselves, and multi-select staging to send a
whole batch to an editor at once. Import is drag-and-drop anywhere.

### 🎬 The Workbench *(the casting office)*

<img src="docs/media/shot-casting.png" alt="The Workbench">

Characters are built through a guided interview: one question at a time, with a proof sheet
filling in beside it so you always see the card taking shape, token estimate included. The
platform tabs across the top are the lens: pick who you're writing for and the editor dims what
that platform won't carry. Rich platforms (Risu, Chub, Lumi, Agnai...) get native field editors
for their platform-specific bags.

### 📖 The Binder *(lorebooks as a real editor)*

<img src="docs/media/shot-lorebook.png" alt="The binder">

Lorebooks stop being a wall of JSON. Table of contents with drag-reorder, per-entry keys with
simple and advanced trigger modes, activation rules in plain words ("80% chance · sticks for 3
messages · cooldown 2"), token budgets with honest estimates, always-on pins, and health checks
that tell you when an entry can never fire.

### 🖨️ The Press *(batch export that tells the truth)*

<img src="docs/media/shot-press.png" alt="The Press">

Stage pieces from the Library, pick one target platform, pull the lever. A character travels as a
**kit**: his linked lorebooks ride along automatically, droppable per run. Every card shows a
readiness line against the target ("9 of 23 filled - empty: nickname, personality, ...") with a
jump straight to the editor. Skips are declared before the run, failures name their error, and
everything that printed lands in one zip.

<details>
<summary>🎬 Bonus room: the first-run wizard</summary>
<br>
<img src="docs/media/shot-setup.png" alt="First-run wizard">
<p><sub>Four questions, a stage that lights up as you answer.</sub></p>
</details>

---

## ⚙️ How It Actually Works

```
SillyTavern ──┐                ┌── RisuAI
Backyard ─────┤                ├── RoleCall
Agnai ────────┤   canonical    ├── Chub
Pygmalion ────┤     model      ├── Lumiverse
NovelAI ──────┤                ├── Marinara
CCv3 ─────────┘                └── ...your studio, as JSON
```

- **Hub and spoke.** N platforms cost N adapters, not N². Adding a platform is dropping a folder
  in; the round-trip suite tells you whether your adapter is honest.
- **Escrow.** The original file rides inside the saved piece. Same-format round trips are
  byte-honest, and CI enforces it on every commit.
- **Sealed scripts.** Cards can carry Lua, macros, regex payloads. Hoplight inspects, reports,
  and preserves them. It runs none of them.

## ❓ FAQ

**Is my content private?**
Yes. Loopback-only local server, zero outbound calls in the codebase, no accounts. Your studio
folder is JSON you can read yourself.

**Can a conversion damage my cards?**
No. The original is escrowed inside the saved piece, same-format round trips are lossless, and
cross-format conversions report what mapped and what didn't.

**Do I need an API key?**
No. Nothing here calls an AI. Planned AI features will be BYOK and opt-in, and their
deterministic parts will work keyless.

**Will it run scripts embedded in cards?**
No. Carried as data, exported faithfully, never executed.

**Which platforms?**
SillyTavern (V2/V3 JSON, PNG, charx), RisuAI, RoleCall, Backyard (.byaf + legacy), Agnai,
Pygmalion, Lumiverse, Marinara, Chub, NovelAI lorebooks, portable CCv3 for everything else.
Per-field detail: [docs/FORMAT-SUPPORT.md](docs/FORMAT-SUPPORT.md).

**A platform I use isn't supported. Can it be?**
Formats are drop-in adapter folders. Open an issue with sample files, or add the folder yourself.
The round-trip suite will tell you whether your adapter is honest.

**CLI or app?**
Both, same engine. The studio is the daily driver; the CLI does convert, inspect, validate, and
label for scripts and batch work, with `--json` output.

**Why AGPL?**
So nobody closes this up and sells it back to the community it came from.
[LICENSING.md](LICENSING.md) has the plain-terms version.

**What does the name mean?**
Hop + limelight. The V is the maker's mark, the tapered H is the app's.

## 🚀 Quick Start

Requires [Bun](https://bun.sh) 1.3+.

```bash
git clone https://github.com/Coneja-Chibi/vaudeville-studios
cd vaudeville-studios
bun install

bun run vaud formats                                          # what can we open?
bun run vaud inspect samples/sillytavern/Seraphina.png        # peek at a card
bun run vaud convert samples/sillytavern/v3-full.json out.charx --to risu
bun run dev                                                   # the studio, local only
```

| Command | Purpose |
| --- | --- |
| `vaud convert <in> <out> [--to id]` | Convert between formats |
| `vaud inspect <file>` | Plain-words summary of any file |
| `vaud validate <file>` | Detect + parse; exit 0 if openable |
| `vaud label <file>` | Guess format and likely origin |
| `vaud formats` | List every adapter |
| `vaud ui [port] [studioDir]` | The visual studio (loopback only) |

## 🗺️ The Roadmap

The real one, with exit criteria per milestone: [docs/ROADMAP.md](docs/ROADMAP.md).

| Milestone | What it is | Status |
| --- | --- | --- |
| M0 · Foundation | Canonical schemas, escrow, PNG codec, round-trip law in CI | ✅ Done |
| M1 · The Converter | CLI convert/inspect/validate, detection, format matrix | ✅ Done |
| Character forge | 9+ platforms, native field editors, the lens | ✅ Closed |
| Content types | Lorebooks, regex, personas, media editors | ✅ Done · presets in build 🔨 |
| M6 · The Studio | The desktop app | 🔨 Runs daily; packaging left |
| M3 · The Script Doctor | Deterministic card audits + health score, no key needed | 🎫 Ticket deck cut |
| M2 · The Brain | Provider layer + agent loop, BYOK, local models | 🕐 Not started |
| M4 · The Table Read | Interview engine that grows a card from a conversation | 🕐 Not started |
| M5 · Productions | Workspaces, content-addressed history, test stage | 🌗 Test bench live; rest open |
| M7 · Archives + World Forge | Distill from chat logs with citations; grown worlds | 🕐 Not started |

Near-term, between milestones: the Press ledger (run history, saved jobs, staleness flags), the
Hoplight mascot landing in tours and empty states, reference pages for the newest four adapters,
and the capability sandbox design for the day scripts earn the right to run.

## 🏗️ Architecture (For the Curious)

Bun + TypeScript, strict. Pure engine core, side effects at the edges; the CLI and studio are thin
shells over one engine. The filesystem is the schema: apps, format adapters, settings sections,
and deck views are all drop-in folders that register by existing.

```
src/
  core/         : canonical model, detection, coverage, lore/regex/macro engines
  entities/     : per-kind schemas (character, lorebook, persona, preset, ...)
  formats/      : one folder per platform - drop one in, the studio gains a format
  studio/       : local-first storage; one entity = one JSON file, atomic writes
  sandbox/      : the sealed-script analysis layer (inspect, never execute)
  ui/
    shell/      : dock, tabs, staging, context menus - the theater itself
    apps/       : drop-in rooms (library, workbench, press, css-workshop, ...)
    components/ : shared controls, extracted exactly once
  cli.ts        : the same engine, argv-shaped
```

CI runs ~1,950 tests plus a color-token guard, a file-size cap, prose gates, and a license audit
that fails the build on restricted dependencies.

| Read order | |
| --- | --- |
| [docs/01-VISION.md](docs/01-VISION.md) | What this is for, and who for |
| [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md) | The canonical model and how adapters hang off it |
| [docs/03-CONVENTIONS.md](docs/03-CONVENTIONS.md) | Code style and the rules the hooks enforce |
| [docs/reference/](docs/reference/README.md) | Per-format, per-entity, per-surface reference |
| [docs/decisions/](docs/decisions/ADR-001-runtime.md) | Why the consequential choices went the way they did |

## 📜 License

[AGPL-3.0-or-later](LICENSE). Plain-terms version: [LICENSING.md](LICENSING.md). Dependencies stay
permissive, enforced by `bun run license:audit`.

---

<div align="center">

*Hoplight: because your characters shouldn't need a passport.* 🐰

*Built with stubbornness, Bun, and roughly 1,950 tests standing between you and data loss.*

</div>
