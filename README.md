<div align="center">

<img src="docs/media/hoplight-v.png" alt="" width="72">

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

---

### 💡 The Core Thesis

> **You should be able to create, edit, and interact with all your work in an app linked to no platform, and port it out when you choose. A storage vault, a creator's lab, or both.**

The whole design is three pieces:

- one canonical model in the middle
- an honest adapter per platform
- your whole library as plain JSON on your own disk


---

## Table of contents

1. [What is Hoplight?](#-what-is-hoplight)
2. [Installation & Setup](#-installation--setup)
3. [Why This is Better (The Format Problem)](#-why-this-is-better-the-format-problem)
4. ["But the Platforms Have Editors Already?"](#-but-the-platforms-have-editors-already)
5. [How It Actually Works](#️-how-it-actually-works)
6. [One Card, Start to Finish](#️-one-card-start-to-finish)
7. [The Library](#-the-library)
8. [The Workbench](#-the-workbench)
9. [The Binder](#-the-binder)
10. [The Press](#️-the-press)
11. [The Small Rooms](#-the-small-rooms)
12. [Settings Reference](#️-settings-reference)
13. [Common Issues](#-common-issues)
14. [FAQ](#-faq)
15. [The Roadmap](#️-the-roadmap)
16. [Architecture (For the Curious)](#️-architecture-for-the-curious)
17. [Compatibility](#-compatibility)

---

## 🎪 What is Hoplight?

**Hoplight is a home base for AI-roleplay work.** Characters, lorebooks, personas, presets, regex
sets, and sprites all live in one local studio with real editors, instead of being scattered across
whatever apps happen to read their formats.

It is a building with rooms:

- a **Library** where your work comes in and waits
- a **Workbench** where it gets cast and edited
- a **Binder** for your lorebooks
- a **Press** that ships it out

One studio. Yours.

**Hoplight flips the relationship.** Your studio is the master copy; the platforms become publish targets. When you want to post somewhere, you export to that platform's format, and the piece you keep working on is always your own copy, in your own folder, in plain JSON you can read yourself.

**The result?** One master instead of a copy per app. You keep it in a studio linked to no platform, and send it out to perform wherever you like.

---

## 🚀 Installation & Setup

---

### The fast way: download it 📥

Grab the newest release from the [Releases page](https://github.com/Coneja-Chibi/Hoplight/releases):

| You are on | Take this file | Then |
|---|---|---|
| **Windows** | `Hoplight.exe` | Double-click it. That is the whole install. |
| **macOS** | `hoplight-darwin-arm64` (Apple Silicon) or `hoplight-darwin-x64` (Intel) | It is a terminal tool: `chmod +x` it, run `./hoplight-darwin-arm64 ui`, open the address it prints |
| **Linux** | `hoplight-linux-x64` | Same: `chmod +x` it, run `./hoplight-linux-x64 ui`, open the address it prints |

Three honest notes:

- **Windows will warn you once.** SmartScreen shows "Windows protected your PC" because the exe is
  new and unsigned, not because anything is wrong. Click **More info**, then **Run anyway**. Every
  release ships a `SHA256SUMS` file if you want to verify your download first.
- **If the app starts but no window appears**, your Windows is missing the WebView2 runtime
  (Windows 11 and most Windows 10 machines already have it). Install it from Microsoft's
  [WebView2 page](https://developer.microsoft.com/microsoft-edge/webview2/) and launch again.
- **The `hoplight-*` files are terminal tools.** Double-clicking one flashes a console and closes;
  that is a CLI waiting for a command, not a broken download. The double-click app is `Hoplight.exe`.

Launching `Hoplight.exe` while Hoplight is already running just opens another window onto the same
studio. Your pieces live in `Documents/Hoplight Studio` as plain files either way.

---

### The dev way: run it from source ⌨️

You need **[Bun](https://bun.sh) 1.3+** (the only dependency you install yourself).

```bash
git clone https://github.com/Coneja-Chibi/Hoplight
cd Hoplight
bun install
bun run dev
```

Loopback only. The first run walks you through four questions (theme, first deck, publish targets, accent), and every one of them can change later.

---

### Updating 🔄

Hoplight never updates itself. It checks GitHub only when you press the button in
**Settings > About > Check for updates**, and that page also tells you which kind of install you
have ("installed app" or "running from source"). New releases are cut automatically from every
change, so there is usually something newer waiting.

**If you downloaded the app** (you have a `Hoplight.exe`):

1. Press **Check for updates** in Settings. If something newer is out, press **View release**.
2. Download the new `Hoplight.exe` and replace your old one. That is the whole update.
3. Your library is never touched by this. Every piece lives in `Documents/Hoplight Studio` as
   plain files; the exe is just the app that opens them.
4. If the app still looks old after updating, an invisible old copy is probably still running:
   open **Settings > Quit Hoplight**, then launch the new exe again (a reboot also clears it).

**If you run from source** (you have a `git clone`):

```bash
git pull
bun install
```

Then restart it (`bun run dev`). Done. The update check will say "running from source" and remind
you of exactly these two commands whenever something newer exists.

**If you use the CLI binaries** (`hoplight-windows-x64.exe`, `hoplight-linux-x64`, ...): download
the new one from the release and replace the old file, same as the app.

---

### Two ways to run it 🖥️⌨️

Hoplight is one engine with two faces. Run either, or both at the same time:

| | What it is | How to run it |
|---|---|---|
| 🖥️ **The Studio** | The visual app. It runs on your machine and uses your **browser as its window**; nothing about it is a website, and nothing goes online. | `bun run dev`, then open the address it prints (127.0.0.1) |
| ⌨️ **The CLI** | Terminal commands for converting, inspecting, and batch work. No window at all. | `bun run hoplight <command>` from the repo folder |

They share the same engine and the same studio folder, so a card you convert in the terminal shows
up in the Library, and a card you edit in the Studio converts the same way from the CLI.

---

### Step 3: Bring your work 📦

Drag any card, book, or archive into the Library and read the receipt. Want a dry run before you trust it with your real stuff? The samples are right there:

```bash
bun run hoplight formats                                          # what can we open?
bun run hoplight inspect samples/sillytavern/characters/Seraphina.png        # peek at a card
bun run hoplight convert samples/sillytavern/characters/v3-full.json out.charx --to risu
```

**Optional power moves:**

- Set the **editor lens** to a target platform and watch off-target fields dim, so you know what a card carries *before* you export it
- **Stage a whole batch**: right-click several pieces into the Press, pull one lever, walk away with one zip
- **Open beside**: pin any two pieces into a split; a lorebook can even sit beside itself on two different entries
- Repaint the studio live in the **CSS Workshop**, where every color is a token
- Point the studio at any folder: `bun run hoplight ui 8321 path/to/studio`
- Work the **shelf ops** each deck carries: merge or split lorebooks, attach a book to a character, duplicate or combine regex sets, right from the Library

---

### The CLI

The studio is one shell over the engine; the terminal is the other. Same engine, argv-shaped:

| Command | Purpose |
| --- | --- |
| `hoplight convert <in> <out> [--to id]` | Convert between formats |
| `hoplight inspect <file>` | Plain-words summary of any file |
| `hoplight validate <file>` | Detect + parse; exit 0 if openable |
| `hoplight label <file>` | Guess format and likely origin |
| `hoplight formats` | List every adapter |
| `hoplight ui [port] [studioDir]` | The visual studio (loopback only) |

`--json` on inspect/validate/formats/convert for machine output. The current CLI covers the essentials; the full CLI/TUI is a work in progress.

---

## 🧠 Why This is Better (The Format Problem)

Every platform invented its own format, and they differ in kind, not just
in spelling:

- **SillyTavern** wraps the same card three different ways: raw JSON, a PNG with the card buried
  in a text chunk, and charx, a zip that carries assets alongside it
- **RisuAI** reads CCv3 but layers its own modules and container format on top
- **RoleCall** and **Agnai** run their own native card schemas, with fields the CCv3 spec has no
  slot for
- **Lumiverse, Marinara, and Chub** stay CCv3-compatible by packing their platform features into
  the card's extensions field, each in its own shape
- **NovelAI** isn't comparable at all: its lorebook format shares no ancestry with card formats

"Compatible" is doing a lot of work in that list. A card that opens on two platforms still doesn't
mean the same thing on both.

That would be fine if you only ever used one. **Nobody uses only one.** So you keep a copy on each platform, and the copies drift the instant you touch one of them. The lorebook you spent a weekend on ends up welded inside a PNG only one app can open.

**Hoplight solves the format problem differently.** One canonical piece sits in the middle, and an honest adapter maps it to and from each platform. Nothing lives in a dialect; everything lives in the middle and gets translated at the door.

| Elsewhere | In Hoplight |
|---|---|
| One copy of the character per platform | One piece, exported to any platform |
| Embedded lorebook, editable nowhere | A real editor, and the book stays linked to its character 📖 |
| Exports silently drop what doesn't fit | A report that names exactly what moved and what didn't 🧾 |
| Your library on someone else's server | A folder of JSON on your own disk 🗄️ |
| Guessing which fields a platform reads | An editor lens that dims what the target won't carry 🔍 |
| Embedded scripts run on trust | Scripts carried as data, never executed 🔒 |

> **Your work is no longer tied to any single format.** The parsed source snapshot and unmapped fields are escrowed inside every saved piece, and same-format exports obey the semantic Round-Trip Law. Formats whose specs declare a byte-level tier prove that stronger guarantee with fixtures. The platforms read their dialects. You keep the source of truth.

---

## 🆚 "But the Platforms Have Editors Already?"

**They do. And they are built for chatting, not authoring.** A platform's editor exists to get a
card into that platform and running, not to be the place you actually make your work.

Three reasons a standalone studio wins:

---

### 1. 🏠 **Platform editors edit one platform's view**

SillyTavern's editor shows you SillyTavern's fields. Risu's editor shows you Risu's. Neither one can tell you what the *other* platform will do to your card, because that isn't their job. So every cross-post is a guess.

**Hoplight's lens shows you every platform's view of the same piece, before you export.**

- Pick who you are writing for from the tabs across the editor, and every field that platform will not carry is dimmed or hidden, your choice.
- The lens runs on per-platform coverage declarations, the same ground truth the Press uses when it tells you a card is ready. The editor itself knows zero platforms; it just reads the claims.
- You write once, and you *see* how every platform will read it before a single one does. 🔍

---

### 2. 🔗 **Your pieces stay linked**

On the platforms, a character and its lorebook are one welded file you cannot edit apart, or two unrelated files that have never heard of each other. Change the book and you are hand-syncing it into every character that used it.

**Hoplight keeps them as separate, editable pieces that know about each other.**

- Edit the book once, and every export of the character carries the current version.
- Stage that character for the Press and its linked lorebooks ride along as a bundle, even books you never staged, and a book already riding a bundle is never printed twice.
- The character travels with its luggage. 🎁

---

### 3. 🗃️ **Your library outlives any platform**

A platform editor stores your work in that platform's folder, in that platform's format. That's the right call for the platform, and it also means your library's fate is tied to one app's.

**Hoplight stores plain JSON in a folder you own.**

- One piece, one file, readable in any text editor, greppable, versionable with git, backed up with rsync, because it is just files.
- The original you imported is escrowed inside every saved piece, so a conversion can never damage what you started with.
- If a platform dies tomorrow, you lose a publish target, not your work. 🗄️

---

## ⚙️ How It Actually Works

**Under all the rooms is one idea, wearing no costume:** a single canonical model in the middle, and
an honest adapter per platform hanging off it.

- Every format you drop in gets read into that one shape.
- Every format you export gets written back out of it.

The studio is the master copy; the platforms are doors.

```
SillyTavern ──┐                ┌── RisuAI
Backyard ─────┤                ├── RoleCall
Agnai ────────┤   canonical    ├── Chub
Pygmalion ────┤     model      ├── Lumiverse
NovelAI ──────┤                ├── Marinara
CCv3 ─────────┘                └── ...your studio, as JSON
```

---

### 🎡 **Hub and Spoke** *(N adapters, not N²)*

**Every platform speaks to the canonical model in the middle, never directly to each other.** That
is the whole trick. Here is the math:

| Wiring | What you owe |
|---|---|
| Ten platforms wired straight into each other | Roughly a hundred conversions to build and keep honest (N²) |
| All routed through one canonical shape | Ten adapters, one per platform (N) |

Adding a platform is dropping a folder into `src/formats/`, and the CLI, the editor, the export
dialog, and the Press all gain the format with zero central registration.

You do not have to take a new adapter's word for it, either: the round-trip suite chews on real
fixture files and tells you whether your adapter is honest.

---

### 🗄️ **Escrow** *(the original rides along)*

**When you import a file, Hoplight does not throw the original away and keep only the parts it
understood.** The original file rides inside the saved piece.

- A same-format round trip, SillyTavern in and SillyTavern out, comes back semantically faithful, including escrowed fields the canonical model never names.
- Anything a platform carries that has no home in the canonical shape rides in escrow instead of getting dropped, and prints back out untouched.
- CI enforces this on every commit: a deliberately broken round trip fails the build.

> **Nothing you import can be lost by editing it.** The file you dropped in is still in there, whole, no matter how much you rewrite around it.

---

### 🔒 **Sealed Scripts** *(carried as data, never performed)*

**Cards in the wild carry code:** Lua trigger scripts, macro payloads, regex rewrite rules. Hoplight
treats every one of them as data, not as a program.

- It inspects them, reports what it found in plain words, and preserves them faithfully through export.
- It runs none of them.

The only place a carried script is ever executed is the sealed room: a hardened, card-local analysis
stage with a hard kill switch, never as trusted code touching your files.

---

## 🎞️ One Card, Start to Finish

One import, front door to final zip, nothing hidden. Watch a single card walk the whole studio and come out the other side intact.

```
You drop Seraphina.png onto the Library floor
 ↓
🔍 Detection sniffs the bytes and names it: an ST character card
   (it would just as readily call a Risu charx, a Backyard archive, or a bare lorebook)
 ↓
🧾 You get a receipt in actual sentences, not a schema dump:
   "Seraphina. A character card, made for SillyTavern.
    We kept her portrait, her greeting, and the lorebook that came embedded."
 ↓
🗄️ The ORIGINAL file is escrowed inside the saved piece,
   so nothing you imported can ever be lost by editing it
 ↓
📚 The embedded lorebook steps out as its own editable piece,
   still linked to Seraphina, so every future export of her carries the current version
 ↓
✍️ You open her on the Workbench with the lens set to "RisuAI":
   every field Risu will not carry is dimmed, so you know before you export, not after
 ↓
🖨️ You stage her for the Press, and her linked book rides along automatically as her bundle
 ↓
📦 One zip drops: seraphina.charx, her lorebook, and an honest per-file result line
```

**And nothing got mangled to get here:**

- The same-format round trip stayed semantically faithful at the format's declared fidelity tier.
- The embedded book became a real piece instead of staying welded inside a PNG only one app can open.
- Any script the card carried rode through as sealed data.

That is the whole loop.

> **Honest in, honest out, and your original still whole at every step.**

---

## 📚 The Library

<details>
<summary><i>Decks, the four views, the art dial, import receipts, staging, shelf ops</i></summary>

<img src="docs/media/shot-library.png" alt="The Library">

**Everything you own, one room.** The Library:
- where pieces enter the studio,
- and where you find them again when you need them.

Whatever you dropped in last weekend is here, sorted, counted, and one click from opening.

---

### 🃏 **Decks** *(one shelf per content type)*

The Library splits your studio into decks, one per kind of thing you make: **Characters, Lorebooks, Personas, Sprite packs, Presets, Regex sets**.

- Each deck chip carries a live count pulled straight off your disk, so "Lorebooks 5" means five books right now, this second, including the ones that arrived embedded inside character cards and stepped out on their own.
- Click a chip and that deck opens; the view repaints around it.

---

### 👁️ **The Four Views** *(pick how you browse)*

One deck, four ways to look at it. Every view reads the same pieces off the same shelf and only changes how they face the house.

| View | How it works | Best for |
|---|---|---|
| 🖼️ **Grid** *(default)* | Art-forward cards in a fluid grid that reflows live with the art dial | Browsing with your eyes |
| 🎬 **Show** | One piece at a time under a spotlight: hero art, the card's own tagline and description, prev/next and a thumb rail | Deciding whether a card is any good |
| 📄 **List** | Dense rows, no art ceremony | Big libraries, fast scanning |
| 📚 **Shelf** | Spine-first browsing | Shelf people |

**Drop-in, and it remembers you.**
- The view toolbar builds itself from drop-in view modules, so adding a fifth way to browse is adding a folder, not touching the Library.
- Your view choice and your art size persist per user, so the room opens the way you left it.

---

### 🎚️ **The Art Dial** *(continuous, not steps)*

**Not an S/M/L toggle. A real slider.**
- Drag it and the whole grid repaints live, cards growing from 4rem thumbnails to 36rem near-posters and every size in between; let go and the size is saved.
- The covers are the cards' own: the PNG art a card shipped with, or the portrait stored inside the piece.

---

### 📥 **Import** *(receipts in sentences)*

Drag a file anywhere onto the Library floor, or use the Import button. Either way you get a receipt in plain words the moment it lands:

```
Seraphina
A character card, made for SillyTavern.
We kept her portrait and her greeting.
A lorebook came embedded; it is now its own piece, linked to her.
```

**Every line is load-bearing and only appears when it is true.**
- If a card carries scripts, the receipt says so, and notes they are kept as sealed data.
- If the file cannot be read at all, you get a warm plain-words no, not a stack trace and not a silent shrug.

*No schema dumps, no "success (0 warnings)". Just a straight answer about what walked in the door.* 🧾

---

### 🎯 **Multi-Select Staging** *(send batches, not singles)*

**Tap pieces and they toggle into a staging set that survives switching decks,** so you can grab a character here, two lorebooks there, and a persona from a third deck without ever losing the pile.

- A bar keeps the live count, and one Send commits the whole batch to the Workbench at once.
- The follow prompt fires once for the batch, not once per piece, and anything already open just picks up a quiet "on the workbench" note instead of a second copy.

---

### 🖱️ **The Right-Click System** *(one menu, everywhere)*

**Every piece in the studio answers a right-click with the same menu grammar,** so the gesture you learn in the Library works in every room of the building. The core verbs:

| Action | What it does |
|---|---|
| 🛠️ **Send to the Workbench** | Opens the piece in its editor |
| 🪟 **Open beside** | Pins it into a split next to the active piece |
| 🖨️ **Stage for the Press** | Adds it to the batch-export queue |

Apps register their own providers into the very same menu, so it grows richer as the studio grows, instead of fragmenting into a different right-click per room.

*Learn the menu once. Every piece in the building answers to it.* 🖱️

---

### 🧰 **Shelf Operations** *(each deck has its own verbs)*

**Beyond the shared menu, each deck brings operations that only make sense for its own kind of thing.** A book can be merged; a regex set can be toggled; a character walks in with its whole entourage.

| Deck | Operations |
|---|---|
| 📖 **Lorebooks** | Merge books, split a book, attach to a character |
| 🧪 **Regex sets** | Duplicate, enable/disable, combine sets |
| 🎭 **Characters** | Travel with their linked lorebooks; bundles are first-class |
| 👤 **Personas** | The structured persona editor, same chassis as characters |

</details>

---

## 🎬 The Workbench

<details>
<summary><i>The casting interview, the lens, native bags, media, tabs and splits, the regex bench</i></summary>

<img src="docs/media/shot-casting.png" alt="The Workbench">

**The casting office.** This is where characters get cast, and where every other piece in your studio, book, persona, regex set, gets edited. One room, real editors, and nobody from a platform leaning over your shoulder telling you which fields you're allowed to fill in.

---

### 🎤 **The Casting Interview** *(a card grows out of a conversation, not a form)*

**Most editors open with a wall.** Forty empty fields, a blinking cursor, and the quiet suggestion that you should already know what belongs in "Post-History Instructions." The Workbench opens with a question instead.

**How it works:** the Casting Interview walks the card out of you one question at a time.
- "What do we call them?" Answer it, get the next one.
- Skip the ones you don't care about, circle back later, the interview doesn't mind.
- A running count tells you where you are in the run, and beside the questions the **proof sheet** assembles the card live: the portrait, the name, every field you've answered, and an honest token estimate that ticks up as you type.

```
CASTING · 1 of 49
"What do we call them?"
The name people see first. You can change it anytime.

YOUR CHARACTER · taking shape
~909 tokens · 7 of 49 answered
```

No forty-field form staring you down.

> **The card takes shape while you talk, and the count never lies about how much of it actually exists yet.**

---

### 🔍 **The Lens** *(write for one platform, see exactly what it carries)*

**The problem every botmaker knows:** you write a card in one app's editor, export it to another, and half of it quietly evaporates because the target's wire never carried those fields. You find out *after* you've published. The Lens kills that.

**The tabs across the top of the editor are platforms.** Click one and you're now writing *for* that platform. Every field it won't carry gets dimmed or hidden, your call:

| Off-target mode | Behavior |
|---|---|
| 🌫️ **Dim** | Fields the target won't carry go gray, but stay editable |
| 🙈 **Hide** | They're gone until you switch back to the full card |

<details>
<summary><b>And the tabs themselves</b></summary>

| Tab | What it edits |
|---|---|
| 🐰 **Hoplight** | The full canonical card, everything at once |
| 📡 **SillyTavern / RoleCall / RisuAI / Lumiverse / Backyard / Agnai / Marinara / Chub** | That platform's view of the card, plus its native field bags |
| 📦 **Default** | Portable CCv3 for the thin hosts |

</details>

**The clever part:** the editor itself knows nothing about any platform. Not one. The Lens runs entirely on per-platform **coverage declarations**, the same ground truth the Press reads when it tells you what a card will carry. The editor just reads the claims.

> *"You see what the target platform will do to your card before you export, not after someone files a bug."* 🎯

---

### 🧭 **The Readiness Strip** *(what's done, at a glance)*

**A thin strip rides along with the card the whole time you're working, keeping score:**

```
Portrait · Name · Core Prompts · Greeting · Tags · Lens Check          2/6
```

**It's a checklist, not a nag.** Nothing blinks red, nothing blocks you. It just answers the one question you can't answer for yourself once you've been staring at a card for an hour: what would a total stranger opening this card find missing?

---

### 🎒 **Native Field Bags** *(rich platforms get real controls, not a JSON dump)*

**Some platforms carry fields nobody else has.** Risu, Chub, Lumiverse, Agnai, Marinara, they all bolt their own extras onto the card. Most tools that even bother to keep those fields dump them into a raw JSON blob labeled "extensions" and wish you luck.

Hoplight gives every one of them a **real editor**: actual controls, grouped the way that platform groups them, sitting right in that platform's tab.

> **What Hoplight genuinely can't map into its canonical model, it doesn't guess and doesn't drop; it rides in the card's native bag and prints back out untouched.**

*Your Risu fields are Risu controls. Not a text area full of curly braces.*

---

### 🖼️ **Media** *(portraits, sprites, expressions)*

**Portrait management with cropping.** Sprite packs are first-class pieces you open like folders instead of ZIPs you pray about. And every art surface is honest about what the piece is actually carrying:
- what's **embedded** in the file,
- what's merely **referenced**,
- and what will **actually export** when you print it.

No "wait, where did the portrait go" surprises at the Press.

---

### 🪟 **Tabs, Splits, and Follow** *(open pieces belong to the whole theater, not one room)*

**Every piece you open lives in the shell's tab strip, not buried inside one room.**
- Wander over to the Library, duck into the Press, come back, your tabs are exactly where you left them.
- Unsaved work wears a **dirty dot** on its tab, so you always know what's still owed a save.

**Anything can sit beside anything.** Pin a second piece into a split and edit two things at once:
- a character next to its lorebook,
- two different characters,
- or the same lorebook open beside itself on two different entries.

When the stage gets too narrow for two readable panes, the split stacks vertically instead of squeezing.

> **Open pieces belong to the whole theater, not one room, and anything can sit beside anything.**

And when another room sends a piece over to be edited, the Workbench asks once how pushy it should be:

| Follow mode | Behavior |
|---|---|
| ❓ **Ask** *(default)* | "1 item was sent to the Workbench. Follow?" |
| 🏃 **Always** | Jump to the Workbench every time |
| 🤫 **Never** | Pieces open quietly in the background |

---

### 🧪 **The Regex Bench** *(patterns with a test stage)*

**Regex is where good intentions go to silently break.** So regex sets get their own editor, with a stage to rehearse on before anything goes live.
- Each rule gets its own page.
- A **natural-language rule builder** lets you describe what you want instead of hand-crafting the incantation.
- And the **bench** is the whole point: paste in real text and watch, rule by rule, exactly what matches and what it rewrites, before you trust any of it in a chat.
- Bring sets in from platform script formats, combine them, and test the combination on the same stage.

> *"A regex you haven't watched run on real text is a bug you haven't met yet."* 🧪

</details>

---

## 📖 The Binder

<details>
<summary><i>The table of contents, keys, activation rules, budgets, health, write-for</i></summary>

<img src="docs/media/shot-lorebook.png" alt="The binder">

**Lorebooks, edited like something a person actually made.** A book stops being a wall of JSON the second it opens:
- one entry owns the screen, the rest wait in a list,
- and every setting that used to be a cryptic checkbox gets written out in plain words.

---

### 📑 **The Table of Contents** *(the whole book at a glance)*

**Down the left side, the whole book laid out as a running order.**
- Search across every entry.
- Drag rows to reorder them.
- Pin the entries that should *always* fire into a dedicated **Always On** section, no keys, no conditions, they inject every single time.

**Every row tells you its state without a click:** enabled or off, which trigger mode it's running, where it lands. And the header keeps the honest tally the whole time:

```
2 entries · ~20 / 2048 tok
```

---

### 🔑 **Keys and Trigger Modes** *(when does an entry fire?)*

**Every entry answers one question: when should you show up?** The Binder gives you four ways to answer it.

| Control | What it does |
|---|---|
| 🎯 **Simple mode** | Primary keywords; the entry fires the moment one appears |
| 🧩 **Advanced mode** | Primary plus secondary key groups, with AND/OR logic between them |
| 🧠 **By meaning** | The entry fires on *similarity* instead of exact words; your keys are kept either way |
| 🔤 **Matching** | Whole-words and case-sensitivity as tri-states that inherit from the book's defaults |

**By meaning** is the one worth pausing on: the entry can trigger when the scene is *about* its subject even if nobody typed the magic keyword. And it isn't a trade, your keys stay right where they are, so you can run words and meaning together.

---

### ⏱️ **When and Where** *(activation, in one readable line)*

**An entry can carry a dozen activation rules:** chance, sticky, cooldown, delay, recursion locks, group membership. On most platforms that's a settings maze you navigate one checkbox at a time. The Binder reads the whole mess back to you as one plain sentence:

```
80% CHANCE · STICKS FOR 3 MESSAGES · COOLDOWN 2 MESSAGES · WAITS 1 MESSAGE FIRST
· CANNOT BE WOKEN BY RECURSION · GROUP "PLACES"
```

**That line is generated straight from the rules themselves,** so it can't drift out of sync with what the entry actually does. Change a rule, the sentence rewrites.

<details>
<summary><b>The full control set</b></summary>

| Rule | Meaning |
|---|---|
| 🎲 **Chance** | Probability the entry injects when it's triggered |
| 📌 **Sticky** | Stays active for N messages once it fires |
| 🧊 **Cooldown** | Won't re-fire for N messages afterward |
| ⏳ **Delay** | Waits N messages into the chat before it's even eligible |
| 📍 **Position + depth + role** | Where in the prompt it lands, and as whom |
| 🔄 **Recursion controls** | Whether other entries' text can wake it, and whether it can wake others |
| ⚖️ **Groups + weights** | Mutually-exclusive entry groups with weighted selection |

</details>

> *"Every activation rule the entry carries, written as one sentence you can read out loud. No settings maze."*

---

### 💰 **Budgets** *(tokens, honestly estimated)*

**A lorebook that overruns its token budget has to start evicting entries, and if you can't see the math, you can't guess which ones.** The Binder shows you the math up front:
- a book-level budget,
- a per-entry estimate on everything,
- and every number wearing a `~` because it's an **estimate and says so** (`~12 tokens`), never a fake-precise count dressed up as gospel.

> **When the budget runs out, priority decides who gets evicted and order decides where the survivors land. You set both, and nothing is left to a chance you didn't choose.**

---

### 🩺 **Health** *(dead entries get called out)*

**A subtle failure:** an entry with no keys, no Always-On flag, and no By-Meaning mode **can never fire.** It's dead. It will sit in your book forever doing precisely nothing, and most tools will let you ship a hundred of them without a word.

> **The Binder calls it out the moment you create the condition, right there while you're editing, and if you get it all the way to export, the Press says it again in red before it prints a book full of entries that will never do a thing.**

*A lorebook full of entries that can't fire is just a very organized text file. Hoplight tells you.* 🩺

---

### 🔭 **Write-For** *(the Lens, for books)*

**The same Lens that keeps your characters honest works on books too.** Pick the host platform and the Binder shows you what that platform's wire *actually* carries:
- which of those activation rules survive on SillyTavern,
- which quietly collapse on a simpler host,
- what NovelAI's lorebook can and can't even express.

It's the **same coverage ground truth** the character Lens and the Press readiness lines run on. One set of claims about every platform, read everywhere.

> **Write-For is a lens, not a fork: the book stays one book, you're only ever changing what you look at it through.**

</details>

---

## 🖨️ The Press

<details>
<summary><i>Staging, bundles, readiness, filenames and flavor, the run</i></summary>

<img src="docs/media/shot-press.png" alt="The Press">

**This is the print shop.** You don't browse your studio in here. You:
- **stage** what's ready,
- pick one platform,
- name the files,
- and pull the lever.

What comes out is a single zip, with an honest result line on every row that went into it.

> *"Every export dialog you've ever used dropped fields and never told you. The Press hands you the receipt instead."* 🖨️🐰

---

### 🎭 **The Staging Grammar** *(the queue is the room)*

**How it works:** you never browse the library from inside the Press. You stage pieces for it from anywhere.
- Right-click any piece and choose "Stage for the Press", or walk the Press's own left rail of unstaged pieces and click a stamp.
- The queue is shell state, not something trapped in this one room, so it survives you wandering off to the Library and back.

The status bar keeps the running count:

```
staged for the Press · 2 in the queue
```

---

### 🎁 **Bundles** *(a character travels with its luggage)*

**A staged character isn't just a character. It's a bundle.** Every lorebook linked to him climbs into the trunk automatically, even books you never staged yourself.

| Bundle behavior | What happens |
|---|---|
| 🧳 **Riders** | Linked books appear under their character, marked "rides with" |
| 🪂 **Drop from this run** | Excludes a rider from one run without unlinking anything |
| 🔁 **Ride again** | Puts it back |
| 🚫 **No doubling** | A staged book already riding a bundle isn't printed twice |

---

### ✅ **Readiness** *(the bad news comes before the run, not after)*

**Every staged card shows, up front, exactly what the target platform will actually carry,** read straight off the same coverage claims that drive the editor lens. Nothing waits until after the zip is already written to surprise you:

```
Seraphina    9 of 23 filled - empty: nickname, personality, scenario, +11 more
             · open in the editor
```

Lorebooks get the fire check: a book whose entries can never fire says so in red, with a jump straight into the binder to go fix it.

*A red line in the Press beats a broken card in someone else's app.* 🚩

---

### 🖋️ **Filenames and Flavor** *(you name the files)*

**Every row gets an editable filename before the run.** Text-based formats will print under their normal extension or dress down to `.txt` / `.md` if that's what you want to hand out; binary formats don't pretend they can be text.

---

### 🧾 **The Run** *(honest, row by row)*

**Pull the lever and every row reports for itself:**

| Row result | What it means |
|---|---|
| ✅ **Printed** | In the zip, with what it carries listed |
| ⏭️ **Skipped** | Declared before the run even starts ("this platform has no persona format") |
| ❌ **Failed** | The actual error, on the row that failed |

Platforms that read CCv3 with their own extension bags (Marinara, Chub) print characters as a CCv3 card, their native file, and the row says so. Everything that printed lands in one zip, named for the platform.

> **The Press never fails silently, and it never lies by omission.** Every row is printed, skipped, or failed, and it tells you which one and why. 📮

</details>

---

## 🎨 The Small Rooms

<details>
<summary><i>The CSS Workshop and Settings</i></summary>

**Not every room needs a marquee.** Two small ones keep the studio yours.

---

### 🖌️ **The CSS Workshop** *(restyle the studio itself)*

**Every color in the app is a token, not a hardcoded hex buried somewhere in a component.**
- The Workshop edits those tokens live, against the real components they paint, so you're watching the change land on an actual button and an actual card, not on a swatch floating in a vacuum.
- And the same CI guard that blocks hardcoded colors from ever getting into the codebase is exactly what keeps the theme you build portable.

*Repaint the entire studio without touching a line of source.* 🎨

---

### ⚙️ **Settings** *(drop-in, like everything else)*

**Sections aren't one monolith; they're drop-in folders, the same doctrine as everything else in the studio:**

| Section | What it holds |
|---|---|
| 🎨 **Appearance** | Theme, house accent |
| 🏠 **Studio** | Home app, first deck, publish targets from the live format registry |
| 🚪 **Workbench** | Follow behavior |

**Every control is call-and-response against the running studio.** Change the theme or the accent and the whole app repaints instantly, no reload.

</details>

---

## ⚙️ Settings Reference

Set once in the first-run walk-through, changed forever after in Settings. Nothing in here is a
one-way door.

| Setting | Default | What it does |
|---|---|---|
| 🎨 **Theme** | Dark | Light or dark workspace; flip it any time |
| 🌹 **Accent** | Rose | One accent color for the whole studio, from the house palette or a custom pick |
| 🏠 **Home app** | The Workbench | Which room the studio raises the curtain on |
| 🃏 **First deck** | Characters | Which deck the Library leads with |
| 📡 **Publish targets** | Not set | The platforms you actually publish to, pulled from the live format registry |
| 🚪 **Follow behavior** | Ask | What happens when a piece is sent to the Workbench: ask, always follow, or never |

**Settings sections are drop-in folders,** and each app keeps its own per-user preferences on top of these, all namespaced by app id:

- the Library remembers its view and art size
- the Workbench remembers its view and dock state

---

## 🔧 Common Issues

_**Most trouble in here is a file question, and the studio answers file questions in plain words.
Reach for `bun run hoplight inspect` before you reach for a forum.**_ 🩺

---

<details>
<summary><b>"It won't open my file!" 😤</b></summary>


- Run `bun run hoplight inspect <file>`. It names what the file is, or tells you plainly that it can't
  be read. No stack trace, a sentence.
- `bun run hoplight validate <file>` exits 0 if the file is openable at all. Drop it in a script.
- If it's a real format we don't read yet, open an issue with a sample file.

---


</details>
<details>
<summary><b>"My export is missing fields!" 🧐</b></summary>


- Check the lens first. Set the editor to the target platform and read what's dimmed; dimmed
  fields are the ones that platform simply cannot carry.
- The per-field truth for every platform lives in [docs/FORMAT-SUPPORT.md](docs/FORMAT-SUPPORT.md).
- Nothing is dropped in silence. The export report lists exactly what stayed home.

---


</details>
<details>
<summary><b>"Where is my studio folder?" 📁</b></summary>


- Default: `Documents/Hoplight Studio`, one JSON file per piece.
- Point the studio at any folder you like: `bun run hoplight ui 8321 path/to/studio`.

---


</details>
<details>
<summary><b>"The port is taken!" 🔌</b></summary>


- `bun run hoplight ui <port>` takes any port you hand it; either way the studio binds loopback only.

</details>

---

## ❓ FAQ

<details>
<summary>**What's been done to keep this thing safe?** 🛡️</summary>

- **Loopback bind + per-launch session token.** The server binds 127.0.0.1 only. Every mutating
  request requires a token minted at launch and injected into the served page; GETs are read-only.
- **Fetch-metadata checks.** Cross-site requests are refused on Origin and Sec-Fetch-Site, so a
  malicious page in your browser can't ride your session into the local API.
- **CSP with per-response script hashes.** The shell serves a Content-Security-Policy whose
  script hashes are computed per response; no external hosts, no unhashed inline script.
- **Path containment.** Entity ids are validated against a safe-id policy and resolved strictly
  inside the studio root; traversal attempts throw before any filesystem call. Covered by tests.
- **Atomic writes.** Exclusive-create for new pieces, atomic replace for saves; a crash can't
  leave a half-written file.
- **Fail-closed parsing.** Request bodies are size-capped, JSON is parsed fail-closed, and saves
  are schema-validated; anything the store couldn't re-read is rejected at the door.
- **Bounded decompression.** Zip and PNG reading is size-capped; archive bombs die at the cap.
- **No automatic execution of card payloads.** Lua, macros, and regex scripts embedded in cards get
  static analysis and honest reporting on import; only an explicit test-bench action can run them.
- **The test benches are caged.** The opt-in Risu bench runs card triggers in real PUC-Lua 5.4
  inside a WebAssembly VM (wasmoon). Regex previews run in a terminable worker with a hard wall-clock
  deadline. Both run on a **separate sandbox origin** whose server allowlists exactly three files
  (`worker.js`, `regex-worker.js`, `glue.wasm`), 404s every `/api/*` path, carries no session token, and pins its
  own CSP (`base-uri 'none'`, `frame-ancestors 'none'`). Escaping the VM lands you in a room
  with no doors. Even `calc::` expressions go through a hand-written numeric parser, not eval.
- **Zero outbound calls.** There is no network client code targeting anything but 127.0.0.1 in
  the codebase; grep it.
- **Tested.** ~2,000 tests including path-containment, server-security, and round-trip
  suites run on every commit.
- Unsigned indie binaries make Windows SmartScreen and macOS Gatekeeper warn on first run. That's
  a missing paid certificate, not behavior; verify the SHA-256 checksums shipped with releases.

**Found a hole?** Report it privately first: **chibiconeja@gmail.com** (also in
[SECURITY.md](SECURITY.md)). You'll get a reply, a fix, and credit if you want it.


</details>
<details>
<summary>**Is my content private?** 🔒</summary>

Yes:

- Loopback-only local server
- Zero outbound calls in the codebase
- No accounts
- Your studio folder is JSON you can read yourself


</details>
<details>
<summary>**Can a conversion damage my cards?** 🛡️</summary>

No:

- The original is escrowed inside the saved piece
- Same-format round trips are lossless
- Cross-format conversions report what mapped and what didn't


</details>
<details>
<summary>**Do I need an API key?** 🔑</summary>

No. Nothing here calls an AI. Planned AI features will be BYOK and opt-in, and their deterministic
parts will work keyless.


</details>
<details>
<summary>**Will it run scripts embedded in cards?** 🚫</summary>

No. Carried as data, exported faithfully, never executed.


</details>
<details>
<summary>**Which platforms?** 📡</summary>


- SillyTavern (V2/V3 JSON, PNG, charx)
- RisuAI
- RoleCall
- Backyard (.byaf + legacy)
- Agnai
- Pygmalion
- Lumiverse
- Marinara
- Chub
- NovelAI lorebooks
- Portable CCv3 for everything else

Per-field detail: [docs/FORMAT-SUPPORT.md](docs/FORMAT-SUPPORT.md).


</details>
<details>
<summary>**A platform I use isn't supported. Can it be?** 🎟️</summary>

Formats are drop-in adapter folders, so:

- Open an issue with sample files, or add the folder yourself
- The round-trip suite will tell you whether your adapter is honest


</details>
<details>
<summary>**Why AGPL?** ⚖️</summary>

So nobody closes this up and sells it back to the community it came from.
[LICENSING.md](LICENSING.md) has the plain-terms version.


</details>
<details>
<summary>**What does the name mean?** 🐰</summary>

Hop + limelight. The V is the maker's mark, the tapered H is the app's.

</details>

<details>
<summary>**How much of this code did an AI write?** 🤖</summary>

Roughly 60/30. The 60 is AI writing code. The 30 is me: drafting, planning, project management,
design, and testing. Everything merges through the same gates regardless of who typed it: ~2,000
tests, the round-trip law, and the CI guards. Bugs get fixed the same way too.

</details>

<details>
<summary>**I use AI, but I want to contribute! Can I?** 🤝</summary>

Yes, of course! Just say which model you used when you put in your PR: different models have
different failure types and vulnerabilities I look out for when inspecting their code.

</details>

---

## 🗺️ The Roadmap

Full version with exit criteria: [docs/ROADMAP.md](docs/ROADMAP.md).

> **A milestone is done when it runs live in a real install, not when its tickets close.**

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

**Near-term:**

- the Press ledger
- the mascot landing in tours and empty states
- reference pages for the newest four adapters
- the capability sandbox design

---

## 🏗️ Architecture (For the Curious)

**Bun + TypeScript, strict.** Pure engine core, side effects at the edges; the CLI and studio are thin
shells over one engine.

The filesystem is the schema: apps, format adapters, settings sections,
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
press/        : batch export - the staged queue, bundles (character + linked books),
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
~2,000 tests        : engine, codecs, round-trip law, store, server, UI cores
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

*Drop a folder in, restart, the studio grew a room. That's the whole trick, everywhere you look.* 🧹

---

## 🤝 Compatibility

- **🥕 BunnyMo**: BunnyMo lorebooks are SillyTavern lorebooks. They import, edit, and re-export
  like any other book.
- **📡 Every platform listed above**: Hoplight reads and writes their formats; it replaces none of
  them. They're where your work performs.
- **📁 Your files**: the studio folder is plain JSON. Scripts, git, rsync, and grep all work on it,
  because it's just files.

---

<div align="center">

*Your favorite rabbit's favorite ~~rabb~~ perfectly normal woman.* 🐰💋✨

</div>
