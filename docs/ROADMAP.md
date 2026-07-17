# Roadmap

Milestones are strictly ordered; a milestone is DONE when every exit criterion passes
live in a real install, not when its tickets close.

> **Status 2026-07-09:** **M0 Foundation jewel DONE.** **M1 Converter jewel DONE (v0.1).**
> Character-card forge **CLOSED**. **Media jewel largely landed.** **Lorebook studio jewel planned**
> (next content-type bar). Plans: the M0 foundation plan (private planning notes),
> the M1 converter plan (private planning notes), the native-fields plan (private planning notes),
> the media build plan (private planning notes), the lorebook build plan (private planning notes).
>
> **Risu Workshop jewel:** DONE. Studio app usable (M6 ahead of formal packaging).

## Character-card forge (workstream, not a numbered M)

Closed against the quality bar:

| Platform | Status |
| --- | --- |
| SillyTavern / Default CCv3 | Done |
| RoleCall | Done |
| Backyard | Done (lens = .byaf; legacy JSON export-only) |
| Agnai | **Jewel accepted** |
| Pygmalion | Done (adapter/export only; no lens tab) |
| Lumiverse | **Jewel accepted** |
| Marinara | Native schema landed |
| Chub | **Jewel accepted** |
| Risu Workshop | **Jewel done** (approved bar) |
| Character.AI | **Dropped** (no export / locked definition) |
| Crushon | **Skipped** (emit Default CCv3 only; no strip tab) |
| Janitor | Thin defer (prefer ST / Default CCv3; no strip tab) |
| **Default** (lens) | One strip tab for portable CCv3 thin-host interop |
| NovelAI | **Not a character-card jewel** (lorebook/scenario interop later) |

**Exit (met):** open / edit / re-export real cards for every host that exposes a portable shape;
thin hosts use Default CCv3; dropped hosts named honestly.

**Still not this workstream (historical note):** full lore/regex content-type editors were listed
here while the character forge closed. **Media jewel has since landed** (see
the media build plan (private planning notes)). **Lorebook studio authoring is the next content-type
jewel** (codecs already exist; editor + attach are the gap). Plan:
the lorebook build plan (private planning notes). Wireframes:
`vs-lorebook-surfaces.html` (private design files), `vs-lorebook-components.html` (private design files).

---

## Studio content types (after character forge)

| Content type | Codecs / hub | Studio UI | Plan |
| --- | --- | --- | --- |
| Character | Done | Editor jewel closed | shipped |
| Media (face/pack/named) | Done | Jewel largely landed | shipped |
| Lorebook | Done (ST/RC/Agnai/Risu/NAI + character_book) | Full binder editor shipped | shipped |
| Sprite pack entity | Hub pack model | Library pack folder | MEDIA (pack entity landed) |
| Regex / persona / preset | Done | Editors shipped; preset codecs in progress | in progress |

**Lore locked decisions:** one RC-shaped editor; **Write for = single host profile** (no multi-select
lens); knowledgeRefs attach; no per-platform full editors; M5 activation engine is separate.

**Lore jewel bar (summary):** open/edit/save book · new book · attach to character · export re-embeds ·
honesty · no empty native lore boxes. See plan §4.

---

## M0 — Foundation

Repo scaffold (Bun workspace, CI, lint, LICENSE + CLA bot), fixture corpus seeded
(>= 40 real files across formats), `packages/core` canonical schemas, escrow envelope,
PNG chunk codec, Round-Trip Law harness running in CI.

**Code reality:** engine + fixtures + round-trip culture live under `src/` (studio monorepo shape
evolved past pure packages/*). Treat **effectively green** when tsc + bun test + color/line scans pass.

**Exit:** `bun test` green under Bun and Node; a V2 PNG card parses to canonical and
round-trips byte-losslessly; CI blocks a deliberately-broken round-trip; CI blocks a
deliberately-added AGPL dependency.

**Status:** **JEWEL DONE** (2026-07-09). See the M0 foundation plan (private planning notes).

---

## M1 — The Converter (v0.1, first public release)

All codecs (V2/V3 JSON+PNG, charx, Backyard, ST worldbook, RC lorebook, ST preset,
Lumiverse preset, personas, regex scripts), content-type detection,
`vaud convert / inspect / validate / import --bundle / export --all-formats`,
honest conversion reports, single-exe builds + checksums + `vaud upgrade`,
README + format-support matrix (auto-generated).

**Code reality:** strong ST/Risu/BYAF/Agnai/Pygmalion/Lumi paths exist; CLI public release packaging
and full matrix still the formal exit. The Studio convert/export dialog covers most of the M1 intent.

**Exit:** a mixed ZIP of real content from 5 platforms converts in both directions
with zero data loss on same-format round-trips; binaries run on win/mac/linux;
a stranger can go from GitHub page to converted card in under 3 minutes.

**Status:** **JEWEL DONE** (2026-07-09) for convert/inspect/validate/formats + multi-platform smoke +
matrix + CLI compile script. See the M1 converter plan (private planning notes).
GitHub multi-OS Releases + `vaud upgrade` remain packaging polish (not jewel blockers).

---

## M2 — The Brain

`packages/ai` (providers, streaming, weak-model tool fallback, key vault) built ON the
Vercel AI SDK (not a forked agent base — docs/07), `packages/agent` (loop, resource
tools over `vaud://`, spill store, staged edits, personas) implementing the ADR-006
constraints as our own code, `vaud` bare REPL, agent eval harness with golden tasks.

**Exit:** the REPL performs a staged multi-file edit on a production via a frontier
model AND via a local 7-8B model; eval harness reports success-rate and
tokens-per-task for both.

**Status:** **NOT STARTED** (product still BYOK-optional later; convert works offline).

---

## M3 — The Script Doctor (v0.2)

Deterministic passes (format errors, token waste, contradiction candidates, slop
banks, speaks-for-user, W++ relics), health score, AI treatment planner with
fix-by-fix staged approval, `vaud doctor` + batch mode + markdown ward reports.

**Exit:** doctor a known-bad public card to health >= 85 with every fix approved
individually; deterministic pass runs with no key configured.

**Status:** **NOT STARTED** (specs exist under `specs/features/`).

---

## M4 — The Table Read (v0.3)

Interview engine as a UI-agnostic event stream (question -> chips -> answer ->
field-patch events), three tempos (Cold Read / Deep Dive / Rapid Fire), adaptive
depth, settings, persona voices, deliverable bundles (card + starter lorebook +
alt greetings).

**Exit:** Cold Read produces a playable card in under 5 minutes in the terminal;
Deep Dive produces a card that beats a hand-written baseline in a blind vibe-check
by the owner.

**Status:** **NOT STARTED**.

---

## M5 — The Test Stage + Productions (v0.4)

`packages/assembly` (prompt assembly with full trace), test chat in CLI with
lorebook activation readout ("rigging view"), productions (workspace folders,
manifest, content-addressed history, restore), library mode.

**Code reality:** Risu Workshop Test Bench runs sealed triggers/scripts (card-local test stage).
Full production workspaces + assembly package still open.

**Exit:** edit a card field, replay the same test line, watch the output change;
`vaud history restore` recovers a deleted lorebook entry.

**Status:** **PARTIAL** — sealed Test Bench exists for behavior cards; full M5 productions **open**.

---

## M6 — The Studio (v0.5)

The desktop app face: Tauri shell over the engine. **Originally blocked on visual-direction
re-exploration; code has run ahead.**

**Code reality:** local studio shell already runs (`bun run dev`, desktop-dev): Workbench, Library,
Press, Settings, **CSS Workshop**. Character Fields + Risu Workshop + platform native bags.

**Exit (revised):** studio is the daily driver for forge + convert; formal Tauri/packaging polish
and public v0.5 packaging still TBD.

**Status:** **AHEAD OF PLAN** — treat as **in progress / usable**, not formal DONE until packaging exit.

---

## M7 — The Archives + The World Forge (v0.6+)

Distill-from-logs with per-claim citations and evidence review; world forge
(interview-grown worlds, corkboard data model, continuity desk as a standing
Doctor pass over a whole production).

**Exit:** distill a real character from >= 20k words of logs where every field
cites real scenes; continuity desk catches a planted cross-file contradiction.

**Status:** **NOT STARTED**.

---

## What now (recommended order)

M0 + M1 jewels are closed. Character cards closed. Pick next:

1. **Content types** — full Lorebook / Regex editors (unlocks link-outs)
2. **Sprites / media milestone** — Manage Sprites (Lumi + Chub stubs)
3. **NovelAI lorebook** adapter
4. **M3 Script Doctor** — deterministic audits, no key
5. **M2 Brain** — agent loop
6. **Packaging polish** — multi-OS GitHub Releases + `vaud upgrade` (optional M1+)
7. **M6 packaging** — formal studio release when ready

Do **not** reopen C.AI/Crushon native bags.

Ground truth: this file + the master plan (private planning notes) + the native-fields plan (private planning notes) + M0/M1 jewel docs.
