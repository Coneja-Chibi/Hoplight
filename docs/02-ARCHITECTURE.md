# Architecture

## Product repo layout (the future `vaudeville-studios` code repo)

```
vaudeville-studios/
  packages/
    core/          Canonical model: zod schemas for character, lorebook, preset,
                   persona, regex-script, world/compendium. Escrow envelope. IDs,
                   token counting interfaces. ZERO deps on other packages.
    formats/       Codecs. One module per external format, all implementing the
                   Codec interface (detect / parse / serialize / capabilities).
                   Includes the PNG tEXt chunk reader/writer.
    lore/          Lorebook engine: trigger matching, recursion, budgets, activation
                   trace. Extracted from VAUDEVILLE packages/lorebook.
    presets/       Preset parse/serialize + Lumiverse converter. Extracted from
                   VAUDEVILLE packages/presets-core.
    macros/        Macro tokenizer/parser (parseNodesV2 lineage) + evaluator subset.
    regexkit/      Regex builder-core + regex-utils (NL trigger builder, describe,
                   diagnose). Extracted from VAUDEVILLE.
    assembly/      Prompt assembly for the Test Stage: preset + card + persona +
                   lorebook + history -> messages payload, with a full trace object.
    ai/            Provider adapters (Anthropic, OpenRouter, OpenAI, Gemini, Ollama,
                   OpenAI-compatible), streaming, native/prompted tool-calling with
                   weak-model fallback, key vault (OS keychain + encrypted file).
    agent/         The agent loop: turn driver, tool registry with deferred schemas,
                   spill store for oversized results, context compaction, staged-edit
                   envelope (draft -> validate -> approve -> commit), persona loader.
    doctor/        Audit passes (deterministic + AI-backed), health scoring, slop
                   banks, treatment planner.
    interview/     Table Read engine: question planner, modes/depth, chip generation,
                   living-document event stream. UI-agnostic.
  apps/
    cli/           `vaud`. Commands + the agent REPL. Compiled via bun build --compile.
    studio/        The app face (M6). Tauri shell rendering a local UI over the same
                   engine. Layout TBD.
  fixtures/        The corpus: real cards/lorebooks/presets in every format, with
                   expected parse results. The Round-Trip Law lives here.
  docs/            This planning suite, moved in.
```

Dependency rule: `core <- formats <- everything`. `ai` and `agent` never import UI.
Apps import packages, never each other. No package imports from `apps/`.

## The canonical model + escrow (ADR-005, spec: specs/formats/canonical-model.md)

Internal model is a superset of every supported format. Every codec parse produces
`{ data: CanonicalX, escrow: EscrowEnvelope }` where escrow holds source format,
version, and any fields with no canonical home, keyed by origin. Serializing back to
the origin format merges escrow back in. This is the mechanism behind the Round-Trip
Law. Codecs declare `capabilities` (which canonical fields they can express) so
`vaud convert` can print an honest "2 fields escrowed" report.

## The agent (lessons imported from RoleCall's Orison work)

- **Tiny always-on tool surface.** A handful of meta-tools; everything else deferred,
  schemas revealed on demand (accuracy collapses past ~50 loaded tools).
- **Resource model over noun-tools.** `ls/read/write/search` over a `vaud://` URI
  space (production files, fixtures, settings) instead of fifty bespoke read_* tools.
  Weak models can drive four verbs.
- **Spill store.** Tool results above ~1k tokens go to disk with a handle + peek;
  the agent navigates with grep/read over handles. Context stays small.
- **Staged edits only.** The agent never mutates a user file directly: it stages a
  diff envelope, validation runs, the user approves (auto-approve configurable),
  then commit. Every commit is a version in the production's history.
- **Model capability profiles.** Native tool-calling when available, prompted XML
  fallback otherwise; explicit samplers; one tool call per turn on weak models.
- **Eval harness early (M2).** Golden tasks replayed against a model matrix; every
  agent change must move tokens-per-task or success-rate, not vibes.

## Productions (project workspaces)

A production is a folder: human-readable JSON/MD files, a `vaud.json` manifest, and a
`.vaud/history/` of content-addressed snapshots (no git dependency; git-friendly).
Library mode (a managed default production) covers loose-file users; `vaud` commands
accept bare file paths too.

## Faces

- **CLI:** plain commands (scriptable, JSON output flags) + `vaud` bare = agent REPL.
- **Studio (M6):** Tauri + local UI over the same engine via a thin IPC layer.
  Every studio action maps to an engine call that the CLI can also express; the studio
  is forbidden from having private engine capabilities.

## Security & privacy invariants

- No network calls except: model providers the user configured, and the updater
  hitting GitHub Releases (checksum-verified). Both auditable in source.
- Keys: OS keychain where available, else AES-encrypted file with local secret.
- No telemetry of any kind. Crash reports are local files the user can choose to share.
