<div align="center">

<img src="docs/media/vaudeville-v.png" alt="" width="72">

<sub>· A CONEJA-CHIBI PRODUCTION ·</sub>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/hoplight-wordmark-dark.png">
  <img src="docs/media/hoplight-wordmark-light.png" alt="Hoplight" width="460">
</picture>

*Every platform invented its own card format. Hoplight speaks all of them.* 🐰

*From the maker of [BunnyMo](https://github.com/Coneja-Chibi/BunnyMo), [TunnelVision](https://github.com/Coneja-Chibi/TunnelVision), and [VectHare](https://github.com/Coneja-Chibi/VectHare).* 🐇

<p>
  <img alt="Status" src="https://img.shields.io/badge/Status-Active_Development-F20D3F">
  <img alt="License" src="https://img.shields.io/badge/License-AGPL--3.0-0a0a0b">
  <img alt="Runtime" src="https://img.shields.io/badge/Runtime-Bun_1.3+-f9f1e1">
</p>

</div>

---

### 💡 The Core Thesis

> **You should be able to create, edit, and interact with all your work in an app linked to no platform, and port it out when you choose. A storage vault, a creator's lab, or both.**

Everything in this repo follows from that sentence. One canonical model in the middle, an honest
adapter per platform, and your whole library as plain JSON on your own disk. No accounts, no
telemetry, no cloud.

---

## 🎪 What is Hoplight?

A home base for AI-roleplay work. Characters, lorebooks, personas, presets, regex sets, and
sprites all live in one local studio with real editors, instead of being scattered across whatever
apps happen to read their formats. When you want to publish somewhere, you export to that
platform's format; the piece you keep working on is always your own copy.

Right now that's hard to do. Every platform has its own card format, cards drift apart when you
maintain a copy per platform, and an embedded lorebook can only be edited inside the app that made
it.

**Hoplight flips the relationship.** Your studio is the master copy; the platforms become publish
targets.

> *"The platforms stop being where your work lives. They become where your work performs."* 🎭🐰

| Elsewhere | In Hoplight |
|---|---|
| One copy of the character per platform | One piece, exported to any platform |
| Embedded lorebook, editable nowhere | A real editor, and the book stays linked to its character |
| Exports silently drop what doesn't fit | A report that names exactly what moved and what didn't |
| Your library on someone else's server | A folder of JSON on your own disk |
| Guessing which fields a platform reads | An editor lens that dims what the target won't carry |
| Embedded scripts run on trust | Scripts carried as data, never executed |

---

## 🆚 "But the Platforms Have Editors Already?"

They do. And they're built for chatting, not authoring. Three reasons a standalone studio wins:

### 1. 🏠 **Platform editors edit one platform's view**

SillyTavern's editor shows you SillyTavern's fields. Risu's shows Risu's. Neither can tell you
what the OTHER platform will do to your card, so every cross-post is a guess. Hoplight's lens
shows you every platform's view of the same piece, before you export.

### 2. 🔗 **Your pieces stay linked**

On the platforms, a character and its lorebook are one welded file, or two unrelated ones.
Hoplight keeps them as separate, editable pieces that know about each other: edit the book once,
and every export of the character carries the current version.

### 3. 🗃️ **Your library outlives any platform**

A platform editor stores your work in that platform's folder, in that platform's format, on that
platform's terms. Hoplight stores plain JSON in a folder you own. If a platform dies tomorrow,
you lose a publish target, not your work.

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

# 📚 The Library

<img src="docs/media/shot-library.png" alt="The Library">

Everything you own, one room. The Library is where pieces enter the studio and where you find them
again.

### 🃏 **Decks** *(one shelf per content type)*

The Library splits your studio into decks: **Characters, Lorebooks, Personas, Sprite packs,
Presets, Regex sets**. Each deck chip carries a live count, so "Lorebooks 5" means five books,
right now, including the ones that arrived embedded inside character cards. Click a chip, that
deck takes the floor.

### 👁️ **The Four Views** *(pick how you browse)*

| View | How it works | Best for |
|---|---|---|
| **Grid** *(default)* | Art-forward cards in a fluid grid that reflows with the art dial | Browsing with your eyes |
| **Show** | One piece at a time: hero art, the card's own tagline and description, prev/next and a thumb rail | Deciding if a card is any good |
| **List** | Dense rows, no art ceremony | Big libraries, fast scanning |
| **Shelf** | Spine-first browsing | Shelf people |

The view toolbar builds itself from drop-in view modules; adding a fifth view is adding a folder.
Your view choice and art size persist per user.

### 🎚️ **The Art Dial** *(continuous, not steps)*

A slider, not a S/M/L toggle. Drag it and the whole grid repaints live from 4rem to 36rem cards;
release and it's saved. Covers come from the cards themselves: the PNG art a card was shipped
with, or the portrait stored in the piece.

### 📥 **Import** *(receipts in sentences)*

Drag a file anywhere in the Library, or use the Import button. Every import produces a receipt in
plain words:

```
Seraphina
A character card, made for SillyTavern.
We kept her portrait and her greeting.
A lorebook came embedded; it is now its own piece, linked to her.
```

Lines only appear when they're true. If a card carries scripts, the receipt says so (they're kept
as sealed data). If the file can't be read at all, you get a warm plain-words no, not a stack
trace.

### 🎯 **Multi-Select Staging** *(send batches, not singles)*

Tapping pieces toggles them into a staging set that survives deck switches; a bar shows the live
count and one Send commits the whole batch to the Workbench. The follow prompt fires once for the
batch, not once per piece. Pieces already open just get a quiet "on the workbench" annotation.

### 🖱️ **The Right-Click System** *(one menu, everywhere)*

Every piece answers a right-click with the same menu grammar, extended per kind:

| Action | What it does |
|---|---|
| **Send to the Workbench** | Opens the piece in its editor |
| **Open beside** | Pins it into a split next to the active piece |
| **Stage for the Press** | Adds it to the batch-export queue |

Apps register their own providers into the same system, so the menu grows with the studio instead
of fragmenting per room.

### 🧰 **Shelf Operations** *(each deck has its own verbs)*

| Deck | Operations |
|---|---|
| **Lorebooks** | Merge books, split a book, attach to a character |
| **Regex sets** | Duplicate, enable/disable, combine sets |
| **Characters** | Travel with their linked lorebooks; kits are first-class |
| **Personas** | The structured persona editor, same chassis as characters |

---

# 🎬 The Workbench

<img src="docs/media/shot-casting.png" alt="The Workbench">

The casting office. Where characters get made and everything gets edited.

### 🎤 **The Casting Interview** *(a card grows out of a conversation with yourself)*

Characters are built through a guided interview: one question at a time ("What do we call them?"),
with a progress count, skippable and revisitable. Beside it, the **proof sheet** fills in live:
portrait, name, answered fields, and an honest token estimate.

```
CASTING · 1 of 49
"What do we call them?"
The name people see first. You can change it anytime.

YOUR CHARACTER · taking shape
~909 tokens · 7 of 49 answered
```

No forty-field form staring at you. The card takes shape while you answer, and the count never
lies about how much of it exists yet.

### 🔍 **The Lens** *(write for a platform, see what it carries)*

The tabs across the top of the editor are platforms. Pick who you're writing for, and every field
that platform won't carry is dimmed or hidden, your choice:

| Off-target mode | Behavior |
|---|---|
| **Dim** | Fields the target won't carry are grayed but editable |
| **Hide** | They're gone until you switch back to the full card |

| Tab | What it edits |
|---|---|
| **Hoplight** | The full canonical card, everything at once |
| **SillyTavern / RoleCall / RisuAI / Lumiverse / Backyard / Agnai / Marinara / Chub** | That platform's view of the card, plus its native field bags |
| **Default** | Portable CCv3 for thin hosts |

The lens runs on per-platform **coverage declarations**, the same ground truth the Press uses for
readiness. The editor itself knows zero platforms; it just reads the claims.

### 🧭 **The Readiness Strip** *(what's done, at a glance)*

A persistent strip tracks the card: **Portrait · Name · Core Prompts · Greeting · Tags · Lens
Check**, with a count like `2/6`. It's a checklist, not a nag; it tells you what a stranger
opening this card would find missing.

### 🎒 **Native Field Bags** *(rich platforms get real editors)*

Platforms with their own extra fields (Risu, Chub, Lumiverse, Agnai, Marinara...) get **native
editors** for those fields: real controls, grouped the way that platform groups them, not a raw
JSON blob labeled "extensions." What Hoplight can't map into the canonical model rides in the
card's native bag and prints back out untouched.

### 🖼️ **Media** *(portraits, sprites, expressions)*

Portrait management with cropping, sprite packs as first-class pieces you open like folders, and
art surfaces that show the piece's carried media honestly: what's embedded, what's referenced,
what will actually export.

### 🪟 **Tabs, Splits, and Follow** *(open pieces belong to the shell)*

Open pieces live in the shell's tab strip, not inside one room, so they survive switching apps.
Any two pieces can sit side by side in a split; a lorebook can even open beside itself on two
different entries. Unsaved changes wear a dirty dot on the tab.

When another room sends a piece to the Workbench, the follow prompt asks once:

| Follow mode | Behavior |
|---|---|
| **Ask** *(default)* | "1 item was sent to the Workbench. Follow?" |
| **Always** | Jump to the Workbench every time |
| **Never** | Pieces open quietly in the background |

### 🧪 **The Regex Bench** *(patterns with a test stage)*

Regex sets get their own editor: per-rule pages, a natural-language rule builder, and a bench
where you paste real text and watch what each rule matches and rewrites before you trust it.
Sets can be imported from platform script formats and combined.

---

# 📖 The Binder

<img src="docs/media/shot-lorebook.png" alt="The binder">

Lorebooks as a real editor. A book stops being a wall of JSON the moment it opens.

### 📑 **The Table of Contents** *(the book at a glance)*

Search across entries, drag rows to reorder, and an **Always On** section for pinned entries that
inject unconditionally. Each row shows its enabled state, trigger mode, and position at a glance.
The header keeps the honest tally: `2 entries · ~20 / 2048 tok`.

### 🔑 **Keys and Trigger Modes** *(when does an entry fire?)*

| Control | What it does |
|---|---|
| **Simple mode** | Primary keywords; entry fires when one appears |
| **Advanced mode** | Primary + secondary key groups with AND/OR logic between them |
| **By meaning** | The entry fires on similarity instead of exact words; your keys are kept either way |
| **Matching** | Whole-words and case sensitivity as tri-states that inherit from the book's defaults |

### ⏱️ **When and Where** *(activation, in one readable line)*

Every activation rule an entry carries is written as one plain-words line instead of a settings
maze:

```
80% CHANCE · STICKS FOR 3 MESSAGES · COOLDOWN 2 MESSAGES · WAITS 1 MESSAGE FIRST
· CANNOT BE WOKEN BY RECURSION · GROUP "PLACES"
```

Underneath it, the full control set:

| Rule | Meaning |
|---|---|
| **Chance** | Probability the entry injects when triggered |
| **Sticky** | Stays active for N messages once fired |
| **Cooldown** | Won't re-fire for N messages after |
| **Delay** | Waits N messages into the chat before it's eligible |
| **Position + depth + role** | Where in the prompt it lands, and as whom |
| **Recursion controls** | Whether other entries' text can wake it, and whether it can wake others |
| **Groups + weights** | Mutually-exclusive entry groups with weighted selection |

### 💰 **Budgets** *(tokens, honestly estimated)*

Book-level token budget, per-entry estimates, always marked as estimates (`~12 tokens`), never
passed off as exact. Priority decides what gets evicted when the budget runs out; order decides
where survivors land.

### 🩺 **Health** *(dead entries get called out)*

An entry with no keys, no always-on flag, and no by-meaning mode can never fire. The binder says
so while you're editing it, and the Press says it again in red before you print a book full of
entries that will never do anything.

### 🔭 **Write-For** *(the lens, for books)*

Pick the host platform and the binder shows what its wire actually carries: which activation
rules survive on SillyTavern, which collapse on a simpler host, what NovelAI's lorebook can and
can't say. Same coverage ground truth as everywhere else.

---

# 🖨️ The Press

<img src="docs/media/shot-press.png" alt="The Press">

Batch export that tells the truth. Stage pieces, pick a platform, pull the lever.

### 🎭 **The Staging Grammar** *(the queue is the room)*

You don't browse your studio inside the Press. You **stage** pieces for it, from anywhere:
right-click any piece, or click a stamp on the Press's own rail of unstaged pieces. The queue is
shell state, so it survives switching rooms. The status bar keeps the count:
`staged for the Press · 2 in the queue`.

### 🎁 **Kits** *(characters travel with their luggage)*

A staged character is a **kit**: his linked lorebooks ride along automatically, even books you
never staged.

| Kit behavior | What happens |
|---|---|
| **Riders** | Linked books appear under their character, marked "rides with" |
| **Drop from this run** | Excludes a rider from one run without unlinking anything |
| **Ride again** | Puts it back |
| **No doubling** | A staged book already riding a kit isn't printed twice |

### ✅ **Readiness** *(before you print, not after)*

Every staged card shows what the target platform will actually carry, using the same coverage
claims as the editor lens:

```
Seraphina    9 of 23 filled - empty: nickname, personality, scenario, +11 more
             · open in the editor
```

Lorebooks get the fire check: a book whose entries can never fire says so in red, with a jump
straight to the binder.

### 🖋️ **Filenames and Flavor** *(you name the files)*

Every row gets an editable filename before the run. Text-based formats can print as their normal
extension or as `.txt` / `.md`; binary formats don't pretend they can.

### 🧾 **The Run** *(honest, row by row)*

| Row result | What it means |
|---|---|
| **Printed** | In the zip, with what it carries listed |
| **Skipped** | Declared before the run even starts ("this platform has no persona format") |
| **Failed** | The actual error, on the row that failed |

Platforms that read CCv3 with their own extension bags (Marinara, Chub) print characters as a
CCv3 card, their native file, and the row says so. Everything that printed lands in one zip,
named for the platform.

---

# 🎨 The CSS Workshop

Restyle the studio itself. Every color in the app is a token; the workshop edits them live against
real components, and the same CI guard that keeps hardcoded colors out of the codebase keeps your
theme portable.

# ⚙️ Settings

Drop-in sections, like everything else: **Appearance** (theme, house accent), **Studio** (home
app, first deck, publish targets from the live format registry), **Workbench** (follow behavior).
Every control is call-and-response against the running studio; theme and accent repaint
instantly.

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

## ⚙️ Settings Reference

| Setting | Default | What it does |
|---|---|---|
| 🎨 Theme | Dark | Light or dark workspace; flip any time |
| 🌹 Accent | Rose | One accent color for the workspace, from the house palette or a custom pick |
| 🏠 Home app | The Workbench | Which room the studio opens on |
| 🃏 First deck | Characters | Which deck the Library leads with |
| 📡 Publish targets | Not set | The platforms you actually publish to, from the live format registry |
| 🚪 Follow behavior | Ask | What happens when a piece is sent to the Workbench: ask, always follow, never |

Settings sections are drop-in folders; each app can also keep its own per-user preferences
(Library view and art size, Workbench view, dock state) namespaced by app id.

## 🔧 Common Issues

### "It won't open my file!" 😤

- Run `bun run vaud inspect <file>`; it names what the file is, or says plainly that it can't be
  read
- `bun run vaud validate <file>` exits 0 if the file is openable at all; use it in scripts
- If it's a real format we don't read yet, open an issue with a sample file

### "My export is missing fields!" 🧐

- Check the lens first: set the editor to the target platform and look at what's dimmed; dimmed
  fields are the ones that platform cannot carry
- The per-field truth for every platform lives in [docs/FORMAT-SUPPORT.md](docs/FORMAT-SUPPORT.md)
- Nothing is silently dropped: the export report lists what stayed home

### "Where is my studio folder?" 📁

- Default: `Documents/Vaude Studio`, one JSON file per piece
- Run the studio against any folder with `bun run vaud ui 8321 path/to/studio`

### "The port is taken!" 🔌

- `bun run vaud ui <port>` takes any port; the studio binds loopback only either way

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
label for scripts and batch work, with `--json` output. A real terminal face (TUI) is in
progress.

**Why AGPL?**
So nobody closes this up and sells it back to the community it came from.
[LICENSING.md](LICENSING.md) has the plain-terms version.

**What does the name mean?**
Hop + limelight. The V is the maker's mark, the tapered H is the app's.

## 🚀 Installation & Setup

### Prerequisites

- **[Bun](https://bun.sh) 1.3+** (the only dependency you install yourself)
- Some cards. You have cards.

### Step 1: Install 📥

```bash
git clone https://github.com/Coneja-Chibi/vaudeville-studios
cd vaudeville-studios
bun install
```

### Step 2: Open the studio 🎬

```bash
bun run dev
```

Loopback only. The first run walks you through four questions (theme, first deck, publish
targets, accent) and everything can change later.

### Step 3: Bring your work 📦

Drag any card, book, or archive into the Library and read the receipt. Try the samples first if
you want a dry run:

```bash
bun run vaud formats                                          # what can we open?
bun run vaud inspect samples/sillytavern/Seraphina.png        # peek at a card
bun run vaud convert samples/sillytavern/v3-full.json out.charx --to risu
```

| Command | Purpose |
| --- | --- |
| `vaud convert <in> <out> [--to id]` | Convert between formats |
| `vaud inspect <file>` | Plain-words summary of any file |
| `vaud validate <file>` | Detect + parse; exit 0 if openable |
| `vaud label <file>` | Guess format and likely origin |
| `vaud formats` | List every adapter |
| `vaud ui [port] [studioDir]` | The visual studio (loopback only) |

The current CLI covers the essentials; the full CLI/TUI is a work in progress.

## 🗺️ The Roadmap

Full version with exit criteria: [docs/ROADMAP.md](docs/ROADMAP.md).

| | What it is | Status |
| --- | --- | --- |
| Engine + converter | Canonical model, escrow, round-trip law in CI, convert/inspect/validate | ✅ Done |
| Character editing | 9+ platforms, native field editors, the lens | ✅ Done |
| Content types | Lorebook, regex, persona, media editors; preset editor in build | ✅ · 🔨 |
| The studio app | Already the daily driver; desktop packaging left | 🔨 |
| CLI / TUI | A real terminal face for the engine, beyond today's basic commands | 🚧 WIP |
| Slop detection | Programmatic slop detector + deterministic card audits with a health score, no API key | 🎫 Planned, tickets cut |
| The agent | An agent loop over your studio: BYOK + local models, staged edits it can never commit alone, eval harness before features (ADR-006) | 🕐 Planned |
| Prompt evolution | GEPA-style reflective optimization of prompts and cards against evals | 🕐 Planned |
| Interview engine | Grows a card from a conversation instead of a form | 🕐 Planned |
| Productions | Workspaces, content-addressed history, test stage | 🌗 Test bench live |
| Log distillation + worlds | Characters distilled from real chat logs with citations; grown worlds | 🕐 Planned |

Near-term: the Press ledger, the mascot landing in tours and empty states, reference pages for the
newest four adapters, the capability sandbox design.

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
  ui/           : the local server + the React studio
  cli.ts        : the same engine, argv-shaped
```

<details>
<summary><b>src/core</b> · the engine</summary>

```
canonical.ts     : the canonical entity envelope every format maps into
                   (schemaVersion, kind, id, body, original escrow)
adapter.ts       : the contract a format adapter implements (read/write/detect)
registry.ts      : the live roster of loaded formats
loader.ts        : loads format folders into the registry
detection.ts     : "what is this file?" - sniffs bytes/shape into a format id
coverage.ts      : per-platform claims of which canonical paths a wire carries;
                   ground truth for the editor lens AND the Press readiness lines
archive.ts       : bounded zip/archive reading (size-capped, no zip bombs)
tag-taxonomy.ts  : the shared tag vocabulary
lore/            : lorebook engine - activation, budgets, eviction, empty-book factory
media/           : portraits, sprite packs, export summaries
persona/ preset/ regex/ : per-type engines shared by editors and codecs
```
</details>

<details>
<summary><b>src/entities</b> · what a piece IS</summary>

```
character/ lorebook/ pack/ persona/ preset/ regex/
```

One folder per content type, holding its canonical schema. Codecs map platform wires into these
shapes and back; editors edit exactly these shapes. Nothing else in the codebase defines what a
character is.
</details>

<details>
<summary><b>src/formats</b> · one folder per platform</summary>

```
sillytavern/  risu/  rolecall/  backyard/  agnai/
pygmalion/    lumiverse/  marinara/  novelai/  vaud-json/
_template/    : copy this to start a new adapter
_shared/      : logic shared by more than one codec, extracted exactly once
_fixtures/    : real files the round-trip suite chews on
```

Each folder default-exports its adapter: detect, read to canonical, write from canonical, plus a
coverage declaration. Drop a folder in and the CLI, the studio, the export dialog, and the Press
all gain the format with zero central registration. `vaud-json` is the studio's own storage format.
</details>

<details>
<summary><b>src/studio</b> · local-first storage</summary>

```
store.ts           : one entity = one JSON file under <studio>/<kind>/<id>.json;
                     keep-both id minting, fail-closed schema validation
atomic-file.ts     : exclusive/atomic-replace writes - no half-written pieces
path-policy.ts     : path containment; ids can never escape the studio folder
bundle.ts          : character + related lorebooks saved as one operation
portrait.ts        : extracts displayable art from carried card files
settings.ts        : the per-studio settings document, parsed fail-closed
signature-color.ts : pulls an accent color from a card's PNG art
```
</details>

<details>
<summary><b>src/sandbox</b> · sealed scripts</summary>

```
lua/       : analysis of Lua blobs cards carry (bounded, never executed as user code)
triggers/  : the Risu Workshop test bench - sealed trigger evaluation on a card-local stage
```

The rule everywhere else is simpler: scripts are data. This folder is where they get inspected.
</details>

<details>
<summary><b>src/ui</b> · the server and the shell</summary>

```
server.ts          : the loopback HTTP server - session token, fail-closed parsing
server-security.ts : origin/fetch-metadata checks, CSP with per-response script hashes
server-engine.ts   : the API's engine calls (inspect, convert, coverage, studio)
server-static.ts   : static serving + dev live-reload watcher
api.ts             : the client's one door to the API
app-contract.ts    : the AppContext handed to every app - IO, workbench, press,
                     menus, prefs; apps never import the engine directly
receipt.ts         : plain-words import receipts, rendered server-side
boot.ts            : client boot - discovers apps, mounts the shell
shell/
  App.tsx          : the frame - canvas, app switching, follow dialogs
  Dock.tsx         : the app dock (manifest-driven, collapsible)
  TabStrip.tsx     : open pieces; the workbench's tabs live in the shell
  store.ts         : shell state - open pieces, press queue, theme, status
  menus.ts         : THE right-click system; apps register providers
  error-boundary.tsx, StatusBar.tsx, FollowDialog.tsx, Menu.tsx
setup/             : the first-run wizard steps (drop-in folder per step)
tours/             : the ? tours, one folder per app
theme/tokens.css   : every color in the app; the guard blocks hardcoded ones
```
</details>

<details>
<summary><b>src/ui/apps</b> · the rooms (drop-in folders)</summary>

```
library/      : browse room - decks by kind, grid/showcase/list views, import,
                multi-select staging, shelf ops per content type
workbench/    : the editors - guided character interview, native platform bags,
                the lorebook binder (lore/), regex bench (regex/), persona and
                preset editors, the platform lens
press/        : batch export - the staged queue, kits (character + linked books),
                readiness lines from coverage, one zip per run
settings/     : drop-in sections (appearance, studio, workbench)
css-workshop/ : live theme editing on real components
company/      : reserved seat (the agent, later)
```

An app is a folder default-exporting a manifest + component. The dock builds itself from
whatever folders exist.
</details>

<details>
<summary><b>src/ui/components</b> · shared controls</summary>

Fifty-plus extracted-once controls, from structural (bento-card, ink-dialog, bottom-sheet,
platform-tabs, lens-rail) to content-specific (sprite-pack, expression-map, native-card,
knowledge-rail, ticket-window) to inputs (paint-picker, swatch-row, toggle-switch, slider,
code-editor). The catalog with usage rules lives in
[docs/reference/components.md](docs/reference/components.md) and a CI check keeps it current.
</details>

<details>
<summary><b>Gates</b> · what CI actually enforces</summary>

```
~1,950 tests        : engine, codecs, round-trip law, store, server, UI cores
color-token guard   : no hardcoded colors outside theme/tokens.css
file-size cap       : 500 lines per file; split, not grandfather
prose gates         : no em dashes, no dead doc links
component catalog   : docs/reference/components.md must match the folders
format matrix       : docs/FORMAT-SUPPORT.md regenerates from the live registry
license audit       : build fails on restricted dependencies
```
</details>

| Read order | |
| --- | --- |
| [docs/01-VISION.md](docs/01-VISION.md) | What this is for, and who for |
| [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md) | The canonical model and how adapters hang off it |
| [docs/03-CONVENTIONS.md](docs/03-CONVENTIONS.md) | Code style and the rules the hooks enforce |
| [docs/reference/](docs/reference/README.md) | Per-format, per-entity, per-surface reference |
| [docs/decisions/](docs/decisions/ADR-001-runtime.md) | Why the consequential choices went the way they did |

## 🤝 Compatibility

- **🥕 BunnyMo**: BunnyMo lorebooks are SillyTavern lorebooks; they import, edit, and re-export
  like any other book.
- **Every platform listed above**: Hoplight reads and writes their formats; it replaces none of
  them. They're where your work performs.
- **Your files**: the studio folder is plain JSON. Scripts, git, rsync, and grep all work on it,
  because it's just files.

---

<div align="center">

*Your favorite rabbit's favorite ~~rabb~~ perfectly normal woman.* 🐰💋✨

</div>
