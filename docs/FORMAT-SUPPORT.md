# Format support matrix

Auto-generated from live adapters (`bun run scripts/format-matrix.ts`).
Canonical schema version: **1**.
Generated: 2026-07-21.

## How to use

```bash
bun run vaud formats
bun run vaud inspect path/to/card.png
bun run vaud convert in.png out.json --to sillytavern
bun run vaud validate path/to/card.json
```

Default portable character shape for thin hosts (C.AI Tools dumps, Crushon import, etc.):
**SillyTavern / CCv3** (`sillytavern` adapter).

## Characters (9)

| id | kind | writes | label |
| --- | --- | --- | --- |
| `agnai` | character | .json | Agnai (Agnaistic) character (.json) |
| `backyard` | character | .json | Backyard.ai / Faraday character (legacy json) |
| `byaf` | character | .byaf | Backyard archive (.byaf) |
| `lumiverse` | character | .json, .charx | Lumiverse character (ST + modules) |
| `pygmalion` | character | .json | Pygmalion character (flat JSON / PNG) |
| `risu` | character | .charx | RisuAI .charx (zip: card.json + assets) |
| `rolecall` | character | .json | RoleCall character card (v3, png/json) |
| `sillytavern` | character | .json | SillyTavern character card (v2/v3, png/json) |
| `vaud-json` | character | .json | Hoplight native (.json) |

## Lorebooks (6)

| id | kind | writes | label |
| --- | --- | --- | --- |
| `agnai-lorebook` | lorebook | .json | Agnai memory book (json) |
| `marinara-lorebook` | lorebook | .json | Marinara-Engine lorebook (native .marinara.json export) |
| `novelai-lorebook` | lorebook | .lorebook | NovelAI lorebook (native export .lorebook / json) |
| `risu-lorebook` | lorebook | .json | RisuAI lorebook (native export json) |
| `rolecall-lorebook` | lorebook | .json | RoleCall lorebook (v1 export json) |
| `sillytavern-lorebook` | lorebook | .json | SillyTavern world info (worldbook json) |

## Personas (4)

| id | kind | writes | label |
| --- | --- | --- | --- |
| `lumiverse-persona` | persona | .json | Lumiverse persona (account object) |
| `marinara-persona` | persona | .json | Marinara persona (theming and stat bars ride sealed) |
| `rolecall-persona` | persona | .json | RoleCall persona (rcpersona / RC persona-card export) |
| `sillytavern-persona` | persona | .json | SillyTavern personas backup (default persona; the rest ride sealed) |

## Presets (4)

| id | kind | writes | label |
| --- | --- | --- | --- |
| `lumiverse-preset` | preset | .json | Lumiverse preset (wrapper import; exports as an ST flat preset) |
| `marinara-preset` | preset | .json | Marinara-Engine prompt preset (marinara_preset export) |
| `rolecall-preset` | preset | .json | RoleCall preset export (ST grammar + macros/choice groups/readme) |
| `sillytavern-preset` | preset | .json | SillyTavern completion preset (flat json) |

## Regex script sets (5)

| id | kind | writes | label |
| --- | --- | --- | --- |
| `lumiverse-regex` | regex | .json | Lumiverse regex scripts (versioned export file) |
| `marinara-regex` | regex | .json | Marinara-Engine regex scripts (API dump array) |
| `risu-regex` | regex | .json | RisuAI regex scripts (.risum module or customscript array) |
| `rolecall-regex` | regex | .json | RoleCall regex script (chat-pipeline find/replace set) |
| `sillytavern-regex` | regex | .json | SillyTavern regex scripts (bare array or card extensions.regex_scripts) |

## Sprite packs (0)

| id | kind | writes | label |
| --- | --- | --- | --- |
| (none yet) | pack | | The studio edits this kind, but no import/export format exists yet. |

## Notes

- Detection is content-sniff, not only extension. Prefer `vaud label` when unsure.
- Same-format round-trips aim for lossless where fixtures prove it (see adapter tests + samples/).
- Cross-format convert keeps what the target can express; use export honesty in the studio UI for drop notes.
- Dropped/skipped host-native bags (Character.AI, Crushon): use Default CCv3 via `sillytavern`.

## Samples

| Folder | Purpose |
| --- | --- |
| `samples/sillytavern/` | CCv2/v3 + Seraphina.png |
| `samples/rolecall/` | RC character + lorebook |
| `samples/risu/` | .charx + card json |
| `samples/agnai/` | native Agnai |
| `samples/backyard/` | .byaf archives |
| `samples/pygmalion/` | classic flat |
| `samples/lumiverse/` | ST + Lumi extensions |
| `samples/chub/` | ST + extensions.chub |
| `samples/marinara/` | native lorebook envelope + prompt preset |
| `samples/novelai/` | lorebook |
