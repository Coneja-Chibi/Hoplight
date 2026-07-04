# Specs Index

Every spec follows `templates/SPEC-TEMPLATE.md`. Status: `planned` -> `draft`
(written) -> `reviewed` (survived adversarial review). Hand-written foundations:

- `formats/canonical-model.md` — the canonical superset model (authoritative)
- `formats/escrow-and-roundtrip.md` — the Round-Trip Law (authoritative)

## formats/

| Spec | Covers |
|---|---|
| chara-card-v2.md | chara_card_v2 JSON, embedded character_book |
| chara-card-v3.md | chara_card_v3 JSON, assets, multilingual notes |
| png-embedding.md | PNG tEXt chunk read/write, keyword precedence, misdetection traps |
| charx.md | Risu .charx zip container + extensions |
| backyard.md | Backyard AI (Faraday) character format |
| rolecall-character.md | RC native character (rcpersona, details, palette, sprites) |
| st-worldinfo.md | SillyTavern world info / Agnai lorebooks |
| rolecall-lorebook.md | RC versioned lorebook export (RoleCallExportV1) |
| st-preset.md | ST prompt presets (prompts + prompt_order + samplers) |
| lumiverse-preset.md | Lumiverse block-model presets + macro dialect notes |
| personas.md | Persona formats (ST persona, RC persona/RoleOut legacy) |
| regex-scripts.md | ST regex scripts + RC regex rules |
| content-detection.md | File/type sniffing across all formats |
| bundle-import.md | Mixed ZIP import/export, dependency ordering |

## engine/

| Spec | Covers |
|---|---|
| lorebook-engine.md | Trigger matching, selective logic, recursion, budgets, activation trace |
| macro-engine.md | Tokenizer/parser (parseNodesV2 lineage), evaluation subset, dialect compat |
| token-counting.md | TokenCounter interface, model-aware counting, caching |
| prompt-assembly.md | Card+preset+persona+lore+history -> messages, with full trace |
| productions-and-history.md | Workspace layout, manifest, content-addressed history, restore |
| key-vault.md | Key storage (keychain/encrypted file), provider configs |
| provider-adapters.md | Anthropic/OpenRouter/OpenAI/Gemini/OpenAI-compatible, streaming, tool-calling modes |
| agent-loop.md | Turn driver, deferred tools, vaud:// resources, spill store, staged edits |

## features/

| Spec | Covers |
|---|---|
| cli-converter.md | vaud convert/inspect/validate/import/export + reports |
| cli-ux.md | Global CLI conventions, --json, exit codes, REPL entry |
| updater.md | vaud upgrade: Releases check, checksum+signature verify, atomic swap |
| script-doctor.md | Deterministic passes, health score, treatment flow, batch |
| table-read.md | Interview engine: modes, adaptive depth, chips, living-document events |
| test-stage.md | Test chat, rigging view, A/B screen test |
| personas-system.md | Agent persona format, the house troupe, voice specs |
| archives.md | Log distillation, voice detection, citations, evidence review |
| world-forge.md | World data model, interview spiral, continuity desk |
