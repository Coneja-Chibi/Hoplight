# The Hoplight Harness: our own agentic terminal face

**Status:** plan · **Visual north star:** wireframes/vs-harness-face.html · **Shell #:** the fourth
(desktop exe, dev server, pocket PWA, harness) · **Not:** a fork of grok-build/Codex/Claude Code.

## The bet, stated plainly

An agentic terminal harness is four parts: a render layer, an agent loop, a **tool surface**, and a
provider adapter. Everyone who builds one of these spends almost all their time on the tool surface
and its safety, because a coding agent needs edit-file, run-shell, apply-patch, sandboxing, all
fail-closed. **We already own ours, finished and tested:** the engine seams (inspect, convert, list,
save-bundle, export, detect) with plain-words receipts and the sealed-script safety model baked in.
So building our own harness is not "reimplement grok-build." It is: wrap seams we own as tools,
drive them with a loop, paint them in our chrome. That is a bounded build, not a moonshot.

## What we OWN vs what is NET-NEW

| Part | State | Notes |
| --- | --- | --- |
| Tool surface | **OWNED** | `createHandler` seams + `saveBundle` + `convert` + detection. Each becomes one tool: name, JSON-schema args, handler that calls the engine. Receipts already speak human. |
| Safety / enforcement | **OWNED** | Sealed scripts stay data; fail-closed adapters; path containment; the engine is the enforcer, the model only proposes. |
| Design / chrome | **OWNED** | vs-harness-face.html: window frame, session strip, scrollback, tool rows, receipt cards, the gold write gate, input bar. ~7 components. |
| Render layer | net-new | **OpenTUI** (decided). React model, precompiled Zig render core over Bun FFI (Zig, not Rust; we write only TS, never build the native layer). Chosen because stock Ink's naive renderer is what strobed Claude Code for a year; Anthropic fixed it by hand-forking Ink, the community fixed it by rewriting in Rust/Ratatui with a TS bridge (breaks one-engine). OpenTUI ships that better renderer natively under React. See vs-ink-opentui.html. |
| Agent loop | net-new, small | user msg -> model(tools) -> stream text+tool calls -> run tool -> feed result -> repeat until done. Anthropic SDK tool-runner / Agent SDK does the plumbing; licensed, supported. A few hundred lines. |
| Provider adapter | net-new, small | BYO key across providers + local (ollama). THE first real decision (below). |
| Permission gate | net-new, tiny | writes pass the gate; reads narrate freely. One component + one await. |

The honest read: three net-new pieces, two of them small, over infrastructure we already trust.

## The provider seam (the one decision that gates everything)

The README promises local-only, no phoning home. A harness needs a model, so:
- **BYO key, loud opt-in.** Egress happens only when you send, same honesty as the update button.
  A first-run line states it; a `/model` command sets it; nothing runs unprompted.
- **Multi-provider from day one** via a thin adapter: Anthropic, OpenAI, xAI (grok), and a
  **local** option (ollama / llama.cpp) for purists who want zero egress ever.
- **No key? The harness degrades to the classic CLI verbs, honestly.** It never pretends.
- Transcripts live in the studio folder as plain files, like every other piece.

RECOMMENDED: build the adapter provider-agnostic (a `chat(messages, tools) -> stream` interface),
ship with Anthropic + a local option first, add others as thin files (folders-as-schema, same as
format adapters). Decide the default provider when the skeleton can actually call one.

## Phases (each gates on green tests + a live terminal run)

- **H1. Walking skeleton (no model).** Ink app renders the full chrome from vs-harness-face, driven
  by LIVE engine data: real deck counts, real `list`, the input bar accepts the classic verbs
  (`convert`, `inspect`, `import`) and prints real receipts. Proves the chrome + engine wiring with
  zero AI. This is the first slice and it is genuinely small.
- **H2. Tool surface.** Wrap each engine seam as a typed tool (name, arg schema, handler). Unit-test
  every tool's schema + handler against the same fixtures the CLI uses. No loop yet; tools callable
  directly. Reuses everything; mostly declaration.
- **H3. The loop + one provider.** Wire the Anthropic tool-runner: message in, stream out, tool
  calls dispatched to H2, results fed back, repeat to done. The gold write gate wraps every
  mutating tool. First real "talk to the studio" moment.
- **H4. Provider adapter + local model.** Extract the `chat` interface; add the ollama/local path;
  `/model` command; the loud egress opt-in. Now it is BYO-key and purist-friendly.
- **H5. Polish + ship.** `/gates` and `/cli` commands, transcripts to disk, the `hoplight harness`
  subcommand (a Bun CLI framework like Bunli/Boune can own the command wiring + release scaffolding;
  OpenTUI owns the interactive screen), release-train entry.

## Render decisions locked (research, 2026-07)

- **OpenTUI, not Ink.** The flicker that plagued Claude Code (1,000+ upvotes, 4-6k scroll events/sec,
  editors freezing) traces to stock Ink's naive renderer: one JS object per cell per frame,
  string-level row diffs, no double buffering, no cell dirty-tracking. OpenTUI's native core does
  exactly the buffering/dirty-tracking Anthropic had to fork Ink to add. React model kept, one-engine
  kept (pure TS, native layer precompiled).
- **Alt-screen buffer from line one.** The other half of the flicker fix is using the alternate
  screen buffer (like vim) so frame updates are atomic. Do it in H1, never retrofit it.
- **Sweep result:** the TS/Bun field (Ink, @rlabs-inc/tui, nberlette/tui, Melker) has no better fit;
  the reactive-signal ones lose React + maturity, Melker is Deno/HTML-doc-first. Rust options
  (Ratatui) ruled out: they need a cross-language bridge that breaks the one-engine law.

## Convergence + naming

This IS the CLI-class-agent idea from the Orison direction, landed on the Hoplight engine. If a
future Orison shares this loop skeleton, it is built once. Naming is Chi's call and his taste owns
it; the bunny lineage (BunnyMo, TunnelVision, VectHare) suggests something like **Warren** (the
tunnel-network an agent navigates) or **Burrow**, but that is a nudge, not a decision.

## Reference study (clones outside the repo, 2026-07)

Cloned into `Documents/external-refs/` (beside Marinara-Engine, never inside the repo, provenance
stays clean). Studied for ARCHITECTURE, never copied; the clean-room rule that governs format work
governs this too. We do NOT and will not use leaked Claude Code source: permission to look is not a
license to copy, and it would poison the AGPL provenance we protect everywhere else.

- **opencode (sst/opencode, MIT) — the goldmine.** Our exact stack (Bun + TS monorepo) and it runs
  on OpenTUI (which SST built FOR it). It validates this plan point-for-point: provider seam =
  `packages/llm/` with one file per provider + `tool-runtime.ts` (our folders-as-schema); agent loop
  = `packages/core/src/session/` (`execution.ts` + `compaction.ts` for context management); tools =
  `packages/core/src/tool/` one focused file each + a `question.ts` consent tool + its own AGENTS.md.
  NEW IDEA worth taking: a client/server split (agent as server, TUI as client over a protocol) —
  maps onto Hoplight already being a server with a browser client; the harness could be a second
  client on the same brain. An H3 consideration, not H1.
- **codex (openai/codex, Apache-2.0) — Rust, reference only.** Read the consent-per-action model and
  sandboxing, not the code.
- **grok-build (xai-org/grok-build, Apache-2.0) — Rust, reference only.** Read the tool layer and
  MCP/ACP integration, not the code.

## First move if greenlit

H1, tonight-sized: `bun add ink react`, a `src/harness/` folder, the chrome components transcribed
from vs-harness-face, one `list`-backed live view, the classic verbs behind the prompt. No model, no
provider decision needed yet. It will look like the mockup and drive the real engine on the first run.
