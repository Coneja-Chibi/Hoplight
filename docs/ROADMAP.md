# Roadmap

Milestones are strictly ordered; a milestone is DONE when every exit criterion passes
live on Chi's machine, not when its tickets close.

## M0 — Foundation

Repo scaffold (Bun workspace, CI, lint, LICENSE + CLA bot), fixture corpus seeded
(>= 40 real files across formats), `packages/core` canonical schemas, escrow envelope,
PNG chunk codec, Round-Trip Law harness running in CI.

Per docs/07-BASE-VS-SCRATCH.md: the PNG codec is a thin wrapper over
png-chunks-extract/encode + png-chunk-text under our canonical mapping (we own the
mapping, rent the byte plumbing), plus a `bun build --compile` packaging spike proving
those deps compile cleanly. Add a **dependency-lockfile + license-audit** ticket: pin
exact versions/licenses for every adopted package, confirm the Vercel AI SDK license
from its LICENSE file, and add a CI check that fails on any AGPL/Elastic/copyleft
dependency entering the tree. CLI scaffold pins citty + @clack/prompts + zod; Ink is
NOT an M0/M1 dependency.

**Exit:** `bun test` green under Bun and Node; a V2 PNG card parses to canonical and
round-trips byte-losslessly; CI blocks a deliberately-broken round-trip; CI blocks a
deliberately-added AGPL dependency.

## M1 — The Converter (v0.1, first public release)

All codecs (V2/V3 JSON+PNG, charx, Backyard, ST worldbook, RC lorebook, ST preset,
Lumiverse preset, personas, regex scripts), content-type detection,
`vaud convert / inspect / validate / import --bundle / export --all-formats`,
honest conversion reports, single-exe builds + checksums + `vaud upgrade`,
README + format-support matrix (auto-generated).

Per docs/07: token-count paths (`vaud inspect`) depend on a pure-JS tokenizer
(js-tiktoken or gpt-tokenizer, benchmark-and-pick ticket) plus @lenml/tokenizers for
local model families. The format-support matrix cites character-card-spec-v3 (MIT) as
conformance target and names SillyTavern as the compatibility oracle; no code is
vendored from either.

**Exit:** a mixed ZIP of real content from 5 platforms converts in both directions
with zero data loss on same-format round-trips; binaries run on win/mac/linux;
a stranger can go from GitHub page to converted card in under 3 minutes.

## M2 — The Brain

`packages/ai` (providers, streaming, weak-model tool fallback, key vault) built ON the
Vercel AI SDK (not a forked agent base — docs/07), `packages/agent` (loop, resource
tools over `vaud://`, spill store, staged edits, personas) implementing the ADR-006
constraints as our own code, `vaud` bare REPL, agent eval harness with golden tasks.
Ink may be adopted here for the full-screen REPL if readline proves insufficient.

**Exit:** the REPL performs a staged multi-file edit on a production via a frontier
model AND via a local 7-8B model; eval harness reports success-rate and
tokens-per-task for both.

## M3 — The Script Doctor (v0.2)

Deterministic passes (format errors, token waste, contradiction candidates, slop
banks, speaks-for-user, W++ relics), health score, AI treatment planner with
fix-by-fix staged approval, `vaud doctor` + batch mode + markdown ward reports.

**Exit:** doctor a known-bad public card to health >= 85 with every fix approved
individually; deterministic pass runs with no key configured.

## M4 — The Table Read (v0.3)

Interview engine as a UI-agnostic event stream (question -> chips -> answer ->
field-patch events), three tempos (Cold Read / Deep Dive / Rapid Fire), adaptive
depth, settings, persona voices, deliverable bundles (card + starter lorebook +
alt greetings).

**Exit:** Cold Read produces a playable card in under 5 minutes in the terminal;
Deep Dive produces a card that beats a hand-written baseline in a blind vibe-check
by Chi.

## M5 — The Test Stage + Productions (v0.4)

`packages/assembly` (prompt assembly with full trace), test chat in CLI with
lorebook activation readout ("rigging view"), productions (workspace folders,
manifest, content-addressed history, restore), library mode.

**Exit:** edit a card field, replay the same test line, watch the output change;
`vaud history restore` recovers a deleted lorebook entry.

## M6 — The Studio (v0.5)

The desktop app face: Tauri shell over the engine. **Blocked on the visual-direction
re-exploration (VVS style evolution) — by design, nothing before this point cares.**

**Exit:** TBD with the layout/style decision.

## M7 — The Archives + The World Forge (v0.6+)

Distill-from-logs with per-claim citations and evidence review; world forge
(interview-grown worlds, corkboard data model, continuity desk as a standing
Doctor pass over a whole production).

**Exit:** distill a real character from >= 20k words of logs where every field
cites real scenes; continuity desk catches a planted cross-file contradiction.
