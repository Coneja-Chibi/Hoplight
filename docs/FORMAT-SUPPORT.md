# Format support matrix

Auto-generated from live adapters (`bun run scripts/format-matrix.ts`).
Canonical schema version: **1**.
Generated: 2026-07-12.

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
| `vaud-json` | character | .json | Vaudeville native (.json) |
| `sillytavern` | character | .json | SillyTavern character card (v2/v3, png/json) |
| `rolecall` | character | .json | RoleCall character card (v3, png/json) |
| `risu` | character | .charx | RisuAI .charx (zip: card.json + assets) |
| `pygmalion` | character | .json | Pygmalion character (flat JSON / PNG) |
| `lumiverse` | character | .json, .charx | Lumiverse character (ST + modules) |
| `backyard` | character | .json | Backyard.ai / Faraday character (legacy json) |
| `byaf` | character | .byaf | Backyard archive (.byaf) |
| `agnai` | character | .json | Agnai (Agnaistic) character (.json) |

## Lorebooks (5)

| id | kind | writes | label |
| --- | --- | --- | --- |
| `sillytavern-lorebook` | lorebook | .json | SillyTavern world info (worldbook json) |
| `rolecall-lorebook` | lorebook | .json | RoleCall lorebook (v1 export json) |
| `risu-lorebook` | lorebook | .json | RisuAI lorebook (native export json) |
| `novelai-lorebook` | lorebook | .lorebook | NovelAI lorebook (native export .lorebook / json) |
| `agnai-lorebook` | lorebook | .json | Agnai memory book (json) |

## Personas (1)

| id | kind | writes | label |
| --- | --- | --- | --- |
| `rolecall-persona` | persona | .json | RoleCall persona (rcpersona / RC persona-card export) |

## Regex script sets (5)

| id | kind | writes | label |
| --- | --- | --- | --- |
| `sillytavern-regex` | regex | .json | SillyTavern regex scripts (bare array or card extensions.regex_scripts) |
| `rolecall-regex` | regex | .json | RoleCall regex script (chat-pipeline find/replace set) |
| `risu-regex` | regex | .json | RisuAI regex scripts (.risum module or customscript array) |
| `marinara-regex` | regex | .json | Marinara-Engine regex scripts (API dump array) |
| `lumiverse-regex` | regex | .json | Lumiverse regex scripts (versioned export file) |

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
| `samples/novelai/` | lorebook |
