# ADR-006: AI - BYOK + local, and an agent built for weak models

**Status:** accepted

## Decision

1. **BYOK first.** Providers at launch: Anthropic, OpenRouter, OpenAI, Gemini, plus
   any OpenAI-compatible endpoint (which covers Ollama/LM Studio/koboldcpp for local).
   No Vaudeville-operated inference, no account, no proxy server. Keys in the local
   vault (OS keychain, else encrypted file).
2. **AI is optional.** The Converter, inspection, validation, deterministic Doctor
   checks, and all project management work with zero keys. The first key ask happens
   at the first AI moment, never at install.
3. **The agent must survive weak models.** Design constraints inherited from
   RoleCall's Orison program (proven in production there):
   - Tiny always-on tool surface + deferred tool schemas revealed on demand.
   - Resource verbs (`ls/read/write/search` over `vaud://` URIs) instead of dozens
     of noun-tools.
   - Prompted-XML tool-calling fallback for models without native tool use; one tool
     per iteration in that mode.
   - Spill store: big tool results go to disk handles, never into context.
   - Explicit samplers on every request; max_tokens leaves room for tool args.
   - Staged edits with validate-before-commit; the agent never writes user files
     directly.
4. **Model roles are user-mappable.** Interview, treatment rewrites, test-stage
   inference, and bulk audits can each point at a different configured model
   (e.g. cheap local for audits, frontier for rewrites). Sane single-model default.
5. **Eval harness at M2, before feature work on the agent.** Golden tasks +
   replayable transcripts + a model matrix; agent changes must move
   success-rate/tokens-per-task numbers.

## Why

- Local-first + BYOK is the only stance consistent with the privacy pitch and with
  an audience that already owns keys and local rigs.
- The weak-model constraints aren't charity: they make frontier-model behavior
  cheaper and more reliable too (Orison's measured lesson).
