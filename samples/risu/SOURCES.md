# Risu sample sources

## cherry.charx (NOT committed - gitignored, 23.7MB) + cherry.card.json (committed fixture)
- The full `.charx` is too large for git (23.7MB, 256-image asset pack), so it is gitignored and pulled on
  demand from the URL below. The de-escrow tests run against `cherry.card.json` - the `card.json` sliced out
  of the archive (`unzip -p cherry.charx card.json > cherry.card.json`, ~125KB) - which carries every
  authored `extensions.risuai` field. Re-download the full `.charx` only if an asset-bytes test needs it.
- URL: https://raw.githubusercontent.com/HyperBlaze456/risu-backend-python/main/char_card_upload/cherry.charx
- Repo: https://github.com/HyperBlaze456/risu-backend-python (path `char_card_upload/cherry.charx`)
- Retrieved: 2026-07-04
- Container: ZIP (`PK\x03\x04`), 23,734,434 bytes. `card.json` (CCv3, spec_version 3.0) + `assets/icon/257.png` + `assets/other/1.png..256.png` (256-image expression pack). No `module.risum` (scripts kept inline in `extensions.risuai`, the "valid CCv3" interop choice).
- NOTE ON DOWNLOADABILITY: RisuRealm's own API (`GET /api/v1/download/charx-v3/:id`) returns 403 ("CharX is not supported for download yet"), so a first-party `.charx` cannot be pulled from realm.risuai.net. Only `json-v2/json-v3/png-v2/png-v3/lorebook-*/preset-*` are downloadable there. This community mirror is the practical source of a real `.charx`.

### Rich escrowed fields this sample actually exercises (all currently dumped to `escrow.risu.raw`)
- `extensions.risuai.customScripts` = **array(8)** declarative regex scripts. Real shape confirmed: `{comment, in, out, type, ableFlag}`. `type` values present: `edittrans` x4, `editoutput` x3, `editdisplay` x1. e.g. `{"comment":"m1","in":"선생님","out":"주인님","type":"edittrans","ableFlag":false}`. AUTHORED behavior.
- `extensions.risuai.triggerscript` = **array(9)** executable state machines. Shape: `{comment, type, conditions[{type,var,value,operator}], effect[{type,var,value,operator}]}`. e.g. output-event trigger that does `setvar dep += 10`. AUTHORED behavior (never executed).
- `extensions.risuai.sdData` = **array(7)** `[label,value]` image-gen prompt rows (`["always","solo, 1girl"]`, `["negative",""]`, ...).
- `extensions.risuai.newGenData` = obj `{prompt,negative,instructions,emotionInstructions}` (present, empty strings here).
- `extensions.risuai.viewScreen` = `"none"`, `largePortrait` = `true`, `lorePlus`/`inlayViewScreen`/`utilityBot`/`lowLevelAccess` = false, `bias` = array(0). Authored display/behavior toggles.
- `data.assets` = **257** entries: 256 `x-risu-asset` (the expression pack, `embeded://assets/other/N.png`) + 1 `icon` (`embeded://assets/icon/257.png`, name `main`). Exercises the `x-risu-asset` -> role "other" degradation.
- `data.character_book` = **31 entries** embedded lorebook (entry keys: keys, content, extensions, enabled, insertion_order, constant, selective, name, comment, case_sensitive, use_regex). NOT extracted by the Risu character codec.
- Dates: `creation_date` = 1716990563878 (MILLISECONDS), `modification_date` = 1717863429 (SECONDS). MIXED units in one real card -> confirms the per-field ms/s normalization must be per-field, not per-card.
- `extensions.depth_prompt` present at ext level (already wired via the shared Tavern mapper).

Empty-but-present in this card (still authored slots elsewhere): `backgroundHTML`, `virtualscript`, `additionalText`, `vits`.

## RPack / module.risum fixtures

No redistributable independent ciphertext+plaintext pair is committed yet. Edited RPack export is
therefore **safe-blocked** in product code (`RPACK_EDITED_EXPORT_VERIFIED = false`). When a licensed
fixture lands under `samples/risu/rpack/`, record source, permission, generation method, and SHA-256
here and flip the gate only after hermetic both-direction tests pass.