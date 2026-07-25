# Kit, state and plan (as of 2026-07-25)

Where the Kit work stands, everything Chi has locked, everything built + verified, and everything
still on the wants list. Internal (vaud-notes, gitignored). Companion to `KIT-BUILD-PLAN.md`, the
per-aisle docs in `kit-plan/`, `KIT-WIDGETS.md`, `KIT-ROADMAP-APPROVALS.md`, and the locked look in
`wireframes/DECISIONS.md` (#23-27). This doc is the single "where are we" for a fresh session.

Branch: **Backstage** (Kit's home). The non-security Kit UI/session work is committed as
`ec23cf0` (`fix(kit): stabilize terminal interactions and sessions`) after integration with newer
remote fixes. The Full-control/type-to-confirm safety core is committed as `d5c336c`
(`feat(kit): add full-control gate policy`). The SSH/boot-error clarity follow-up is committed as
`5ed35a5` (`fix(ui): guide remote Studio setup`). `bun test src/kit` = 330 pass / 0 fail, the full
project suite = 2241 pass / 1 skip / 0 fail, and `bunx tsc --noEmit` is clean.

---

## 0. The one-paragraph picture

Kit is a terminal agent for the Hoplight studio (OpenTUI / React-in-the-terminal). This session took
it from the old plain chrome to the **locked visual language** in the actual render layer, wired the
built-but-dark chrome, built most of the **safety substrate** for writes (gate, permission modes,
egress ledger, Full-control, and type-to-confirm), and shipped the
**script-view transcript search**. Kit is still **read-only
in practice**: the write *capability* now exists on the bridge, but no write *tools* are advertised
and the confirm-gate UI is not wired, so any write fail-closes. What remains is mostly the
*interactive* surfaces (the confirm gate UI and composer menus) that need Chi at the real terminal
to verify feel, plus a few clean heads-down render surfaces. Session persistence, resume, rewind,
fork, and export are now wired into the running App.

---

## 1. What Chi has ESTABLISHED (locked this session)

### 1a. The visual language (locked via the `vs-kit-complete.html` wireframe + a live session-surface approval)
- **Terminal-honest.** One font size; hierarchy is color + bold + spacing + case. Heavy line-grey
  frames ARE the stamp (a TTY cannot draw an offset/soft shadow, it becomes a grey bar, DECISIONS
  #27). **Gradients are allowed** (Chi: "we have gradients"), used on the stage-wash masthead and the
  searchlight sweep. No rounded corners on primary surfaces.
- **Conversation = shaded bands with REAL tonal contrast.** Your line LIFTS (`theme.lift` + a rose
  spine); replies recess. The shading is the clean neutral ladder (well/floor/panel), NOT color-washed
  fills (Chi rejected "muddy" tinted panels). Meaning comes from the spine + a clean step, not a wash.
- **BUT segmentation was over-done and got dialed back (2026-07-24).** Chi: "related things are taking
  up one whole megablock." So: folded traces (rehearsal/backstage) are now **compact one-liners**
  (`· rehearsed 1s · 82 chars · click or ctrl+o reopens`), per-line dividers are **removed**, and
  spacing is **turn-aware**: a turn's traces + reply sit tight (`scrollback gap=0`), a single blank row
  falls **between** turns (a spacer before each your-line). This is the current, good state.
- **Verb palette (classic menu palette, assigned by meaning).** Cool = safe reads, warm = writes, red
  = destructive, violet = egress. `list #6aa5f0` `read #5bd995` `search #4fd6e0` `triage #2dd4bf`
  `write/shelve #e8b64a` `tag #e6c15c` `edit #ef9f5a` `delete #f16a6a` `fetch/send #b79cf5`. The tool
  row's spine echoes its verb. Lives in `theme.ts` (`verbColor` + `colorForVerb`).
- **Two-axis color.** Spine = a move's RISK (the verb family); the TARGET colors by its SURFACE (a
  deck kind via `kindColor`, or a named piece in its signature accent).
- **Semantic tagging.** Kit tints known studio-piece names in its output in their signature colours
  (in a tool row the target is a literal argument, so it is always earned). Wireframed; not yet built
  in the live render beyond the search card's speaker/entity colours.
- **Legibility law.** No super-dim grey text. `mut`/`line` are borders/rules only; text floors at
  `soft`/`quiet`. (Chi's hard note.)
- **Script-view search (VAUDEVILLE look, Chi loves it).** Each hit reads as a screenplay line: an
  ALL-CAPS speaker cue coloured by voice (`YOU` rose, `KIT` teal, `REHEARSAL` violet, `ERROR` red), the
  dialogue indented beneath, the match **gold-underlined**, the active line's left margin lit in the
  speaker's colour. `2/5` counter, `up/down · enter · esc`. Source of truth for the look:
  `apps/rc/src/components/scene/ChatSearchOverlay.tsx` in the VAUDEVILLE repo (studied 2026-07-24).

### 1b. The write + gate design (three forks approved via `wireframes/vs-kit-gates.html`, "All approved")
- **Fork 1, the gate is per-write with an instant "yes to all"** (a careful user vets each piece; an
  impatient one hits "yes to all" and it becomes the batch behaviour). A hybrid was offered; per-write
  won.
- **Fork 2, three permission modes**, mapped to Chi's words:
  - **Always ask** = `guarded` (every write confirms).
  - **Never ask safe moves** = `autopilot` (writes go; deletes + sends still ask).
  - **Full control** = the new `full` mode (everything auto-allows EXCEPT the danger floor).
  - The **danger floor** (`unknown`/`exec`) confirms in *every* mode, even Full control, a hard
    invariant that cannot be turned off. `locked` stays as the fail-closed/abort state (shown as
    "Read-only"). Labels/hints in `permission-mode.ts` (`MODE_LABEL`/`MODE_HINT`/`GATE_MODES`).
- **Fork 3, destructive moves need type-to-confirm** (you must type "delete 12"; a keypress is not
  enough for something with no undo). Pure core: `tools/safety/confirm-phrase.ts`.

### 1c. Header, LOCKED (Chi approved 2026-07-25)
The large rainbow **"V KIT" ASCII banner** still exists for terminals at least 110 columns wide and
32 rows high. On roomy terminals its artwork and welcome script share one centered stage block, so
ultrawide canvases feel deliberately seated instead of left-heavy. Narrow terminals now use a
purpose-drawn miniature rainbow `V KIT` mark while retaining and wrapping the complete greeting;
only the artwork changes resolution. The
persistent header now restores the animated
**NOW PLAYING** marquee with its twinkling lamps on roomy terminals, while preserving the compact
masthead for small panes. The persistent context/turn/session telemetry row is gone; `/privacy`
retains the provider-send and token details on demand. Deck counts
do not live in persistent chrome; `/decks` (alias `/inventory`) shows them on demand.

---

## 2. What's DONE + verified this session

### Foundation / look
- `theme.ts` — locked palette + `verbColor`/`kindColor`/`colorForVerb`.
- `primitives/band.tsx` — the Band (shaded bg + 1-col left spine; **no** divider now).
- Re-skinned to bands: `you-line` (lift + rose spine), `say-line` (recess), `error-row` (recess + red
  spine). Folded `thought-row` + `backstage-row` are now **compact one-liner** traces (not bands).
- `backstage-box` + `backstage-row` open state — verb-palette **structured rows**; legible headers.
- `scrollback.tsx` — `gap=0`; `app.tsx` drops a spacer before each your-line (turn-aware spacing).
- `playbill.tsx` — animated NOW PLAYING marquee on roomy terminals and compact `Kit.` masthead on
  small panes. Deck inventory moved to `/decks`; provider/token telemetry stays in `/privacy`.
- `terminal-surface.ts` — seats the OpenTUI cell canvas into the host terminal. The App root follows
  the renderer canvas by percentage, while OSC 11 gives fractional-cell and terminal-padding gutters
  the same stage background; Kit restores the terminal default when it exits.
- `composer.tsx` + `status-bar.tsx` — the approved fused prompter rail: one open heavy top rule,
  rose-deep prompt cap, multiline input plate, and a quiet provider/model/ready register under one
  thin seam. The idle plate is one terminal row so the cap is exactly centered, then grows with
  multiline input. Typing `/` opens the registry-driven command palette with keyboard filtering,
  selection, completion, execution, and clickable rows. The old full rectangle and detached bottom
  strip are gone.

### Chrome (Aisle 3, wired)
- **Context meter + token tally** with usage threaded end to end: `chat.ts` (captures
  `result.usage`) → `ModelReply.usage` → `loop-core` yields a `usage` event → `session` forwards →
  `turn-events` stores `TurnView.usage` → `app.tsx` accumulates `sessionUsage` → `Playbill` renders
  the meter (`knownContext(provider.model)` gives max) + tally.
- **Notify** (title/bell/desktop on turn-settle) — `useFocus` + `useNotify` wired into `app.tsx`,
  focus-gated, `NOTIFY_SETTINGS` all-on default.

### Commands / nav
- **Grouped `/help`** — added `KitCommand.group`, tagged model/test/quit/help, `help.ts` renders
  Setup/Session/Moving/Other sections (inline, layered, not reaching into render). Tests in
  `commands/help.test.ts`.
- **On-demand deck inventory** — `/decks` (alias `/inventory`) reports the canonical deck counts
  without spending permanent header space.
- **Transcript search (script view)** — `primitives/nav/search-card.tsx` (reuses the tested
  `searchLines` core, a per-line cursor, speaker cues, gold-underlined match). Wired in `app.tsx`:
  `ctrl+f` opens it over the transcript, `esc`/`enter` close, `up/down` walk hits. **Fixed** the
  original "search does nothing" bug: OpenTUI inputs are **uncontrolled** (read via `onInput`; a
  `value` prop fights the buffer and swallows keystrokes). **Still needs Chi's live eyeball of the
  results with a real query** (char-frame can't show colour). v2 deferred: per-line timestamps
  (RenderLine has no time yet) and jump-to-message-on-enter (needs the scroll-seam plumbing).

### Safety substrate (Aisle 5, the pure/testable half)
- **Gate wired into `session.ts`** — every tool call rides `makeGatedDispatch` (built per turn),
  fail-closed. Reads classify `safe` → allow; anything risky → confirm, and with no confirm seam wired
  yet, blocked. Closes the aisle-5 "safety protects nothing" gap.
- **Permission `full` mode** is implemented in `gate-core.ts` (everything but
  the floor auto-allows) + `permission-mode.ts` (`MODES`, `MODE_LABEL`, `MODE_HINT`, `GATE_MODES`) +
  tests, committed as `d5c336c`.
- **Egress ledger** — `providers/egress-ledger.ts` (`recordEgress`, `formatLedger`, bounded, tolerant)
  + tests. `app.tsx` records a ledger entry per usage event; `/privacy` command
  (`commands/privacy.ts`) reads it via `CommandContext.egressSummary`.
- **Write capability** — `bridge.save`/`bridge.delete` wrap the store's atomic, path-contained
  `StudioStore.save`/`delete`. Capability only; no write *tools* use it yet.
- **Type-to-confirm** — `tools/safety/confirm-phrase.ts` (`requiredPhrase`/`matchesConfirm`) + tests
  is committed as `d5c336c`.

### Transcript (Aisle 2, complete)
- **Code-slab language** — `markdown.ts` captures the fence info string; `markdown-text.tsx` shows a
  dim language label over the sunken code region (terminal-honest, no box; the harness makes a nested
  box measure to 0).
- **Diff playbill**: fenced patches are replay-safe, counted, line-classified, and capped without
  introducing nested message boxes.
- **Piece cards + composer mentions**: a trailing `@` query picks from live studio summaries and
  inserts a stable `@kind:id` marker; replies re-derive compact cards from those stored markers.
- **Long-say folding**: settled replies over the deterministic threshold collapse and reopen by
  click or Ctrl+O; live streams never fold mid-answer.
- **Copy corner**: user, assistant, and error bands expose a hover affordance backed by bounded
  OSC52 requests and honest unsupported/refused feedback.
- **Error curtain + scene seam**: very large errors are grapheme-safe capped and Markdown rules
  use the shared scene mark.

### Sessions and interaction correctness
- Turn ownership is synchronous and exclusive; rapid follow-ups enter a visible bounded FIFO queue
  and drain one at a time as turns settle.
- Escape aborts an active provider turn, and partial streamed text remains visible on stop/error.
- Draft recall, Ctrl+F search, paste-card removal/overflow, and Unicode grapheme boundaries have
  regression coverage.
- `/session`, `/resume`, `/rewind`, and `/export` are production-discovered and wired. Completed
  turns persist atomically and restore visible transcript plus provider history after restart.
- Search, resume, and rewind lists window against terminal height and keep the selected row visible.

### Browser Studio over SSH (committed as `5ed35a5`)
- `hoplight ui` now retains the random sandbox port and prints one copyable SSH command containing
  both the main Studio and sandbox forwards.
- A boot-time `/api/settings` 403 now renders **Copy SSH command**, **Open Studio**, and
  **Open Remote Access setup**. The latter deep-links the forwarded Studio directly to the existing
  button-driven Remote Access tab.
- User troubleshooting and developer remote-access docs explain containers, localhost, the Host gate,
  and the two-port tunnel without weakening the gate.

---

## 3. Aisle status (the 7-aisle marketplace)

- **Aisle 3 · Chrome** — effectively DONE (meter, tally, notify all wired). Left: "model chip" (minor);
  cost-stamp was rejected.
- **Aisle 5 · Tools & safety** — the gate wiring, ledger, `/privacy`, and write capability are
  committed. Full mode and type-to-confirm are also committed. Left: the
  **interactive confirm-gate UI** (per-write + yes-to-all),
  the **`/gates` screen**, the **write tools**, **dry-run**, **undo** — all need the confirm seam
  threaded app→session→gated-dispatch and a live eyeball.
- **Aisle 6 · Commands & nav** — the full-screen `/help` reference, **search**, and
  **snap-to-latest** are built and wired.
  Home/End/Page Up/Page Down share the real scroll seam and new rows accumulate in the clickable
  new-below pill while the reader is scrolled up. The separate command deck is superseded by the
  registry-driven slash popup. A persistent living footer is omitted because Chi removed persistent
  bottom-bar clutter; contextual hints remain inside their owning screens.
- **Aisle 2 · Transcript** — DONE: Markdown/code, diff playbill, piece cards, long-say fold,
  copy corner, bounded errors, and scene seams are wired and tested.
- **Aisle 1 · Composer** — recall / multiline / paste-card / draft-ghost are built. The silent
  mid-turn drop and missing Escape interrupt are fixed. Slash popup and `@` piece mentions are DONE.
  **Queued whispers are DONE**: accepted follow-ups show a compact receipt and drain FIFO, including
  after an interrupted turn; overflow leaves the draft in the composer. The originally approved
  studio-aware draft suggestion is also DONE: the empty placeholder derives a relevant next move
  from live deck counts and piece names without becoming submit-ready text.
- **Aisle 4 · Sessions & memory** — persistence, resume, rewind/fork, and export are wired and
  tested. `compaction notice` remains blocked on the compaction spec; `studio memory` still needs
  Chi's technical design.
- **Aisle 7 · Standalones** — `/privacy`, test-ping, **`/doctor`**, and **stage watchers** are DONE.
  Doctor discovers four read-only checks, runs them concurrently with per-check timeouts, and renders
  one diagnostic playbill. The process-local watcher polls canonical summaries, coalesces outside
  changes into one non-modal `NOTICED` cue, refreshes live studio counts, and tears down with Kit.
  Night shifts depend on unattended locked-gate behavior and remain excluded by Chi's no-security-work
  direction. Troupe mode remains blocked on its dedicated spec. Gated web fetch remains
  security-critical and is not started.

---

## 4. Open decisions / things Chi has SAID he wants
1. **Live eyeball of search results** — confirm the script cues / gold match / active spine read right.
2. **Build the write feature** behind the approved forks — the confirm-gate UI, `/gates` screen,
   dry-run, undo, and the actual write tools. This is what makes writes usable; it's interactive and
   wants Chi at `kit`.
3. **Finish the remaining aisles** (2, 1, 6, 4, 7) per the status above; "get to work on allat."
4. **VAUDEVILLE script-search look** — wanted for search (DONE for the search card; the same
   speaker/voice treatment could extend to the transcript later if Chi wants).
5. Standing wants: every feature ships >=2 siblings; nothing built without a wireframe Chi approves
   (served HTML, transcribed 1:1); hypermodular / functional-core-imperative-shell; fail-closed.

---

## 5. Recommended build order from here

**Heads-down (solo, verifiable by tests + captured frames, keep the firewall green):**
1. **`/doctor`** (Aisle 7) — a pure self-check command.

**Live (pair with Chi at `kit`, feel can't be char-framed):**
2. **Search results eyeball** (quick) → lock or tweak the script view.
3. **Write-gate UI** (Aisle 5 finish): thread the confirm seam, build the per-write gate + yes-to-all,
   the `/gates` mode picker, dry-run, undo, and the write tools. Biggest interactive chunk.
4. **Composer interactive** (Aisle 1): decide whether queued whispers
   are still wanted now that rejected mid-turn input remains visible.
5. **Snap-to-latest** (Aisle 6). Session wiring is complete.

**Blocked (do not start without input):** compaction notice (needs the compaction spec), studio
memory (Chi owns the technical design), troupe mode (its own spec).

---

## 6. What `src/kit/tools/safety` contains

This is actual runtime code and tests, not documentation:

- `access.ts`: the closed trust map from tool names/verbs to read, write, delete, egress, exec, or
  unknown access.
- `risk.ts`: converts access plus arguments into the risk verdict shown to the gate.
- `gate-core.ts`: decides allow, confirm, or deny for the current permission mode.
- `permission-mode.ts`: applies the user's gate choice and holds the user-facing mode labels.
- `gated-dispatch.ts`: wraps real tool execution so a denied or unconfirmed move never runs.
- `confirm-phrase.ts`: builds and checks phrases such as `delete 12`.
- `peek-core.ts` and `stripe-core.ts`: pure presentation models for confirmation previews and risk
  stripes.
- `assert-never.ts`, `index.ts`, and sibling tests: exhaustiveness/export plumbing and proof.

The approved Full-control mode and destructive type-to-confirm core are committed as `d5c336c`.
They were originally excluded from the Kit UI/session commit because Chi said not to do security
work, then validated and committed separately after Chi explicitly brought them back into scope.

---

## 7. Key facts + constraints (so a fresh session doesn't relearn them)

- **Run Kit:** `bun run src/kit/index.tsx` (or the `kit` bin). No hot reload, **relaunch** to see
  changes. A stale window shows old chrome (this caused a "did you delete my header?" scare).
- **Verify:** `bun test src/kit` (330 pass), `bunx tsc --noEmit` (clean). Structure via
  `testRender` + `waitForFrame` char-frames; **colours need a live eyeball** (char-frames are text
  only). `bunfig.toml` confines `bun test` to `src`.
- **Render architecture:** `app.tsx` is the imperative shell (session state + composed primitives);
  `turn-events.ts` is the pure event→view fold; `primitives/*` are the themed widgets. Re-skin
  primitives, don't rewrite the shell.
- **Harness constraint:** a message renders as **one `<text>` node** — a stack of nested boxes inside
  a message measures to height 0 in the scrollback, so code/diff render **inline (flat styling)**, not
  as boxes. Bands work as **direct scrollback children** (that's why the transcript bands + backstage
  box render fine).
- **OpenTUI gotchas:** inputs are **uncontrolled** (read via `onInput`/`ref.plainText`; never pass a
  `value` prop, it fights the buffer). Use `<b>` for bold, `border={["left"]}`/`["bottom"]` for
  per-side borders (single `borderColor`). No offset/soft shadows (grey-bar). Gradients OK.
- **Kit is read-only in practice:** the write capability exists on the bridge, but no write tools are
  advertised and the confirm UI isn't wired, so writes fail-closed at the gate.
- **Trust map is a CLOSED list** (`tools/safety/access.ts`): `list`/`read`/`search` = `read`;
  everything else = `unknown` = dangerous (deny by absence). A new tool is dangerous until classified.
- **Docs to read:** `KIT-BUILD-PLAN.md` (dependency order + shared subsystems), `kit-plan/aisle-1..7.md`
  (per-feature siblings/lifecycles/widgets), `KIT-WIDGETS.md`, `KIT-ROADMAP-APPROVALS.md`, and
  `wireframes/DECISIONS.md` #23-27 (the locked Kit look) + `wireframes/vs-kit-complete.html`,
  `vs-kit-gates.html`, `vs-kit-search.html` (the approved wireframes).
