# Formats

Every format vaud reads and writes. A **format** is a folder in `src/formats/<name>/`; the loader
discovers it automatically (see [../architecture.md](../architecture.md)). Each format family gets one
reference page here.

## Coverage matrix

| Format | id | Kind(s) | Container | Writes | Detection | Reference |
| --- | --- | --- | --- | --- | --- | --- |
| SillyTavern character | `sillytavern` | character | png / json | `.json` | `0.9` (generic Tavern reader) | [sillytavern.md](sillytavern.md) |
| SillyTavern world info | `sillytavern-lorebook` | lorebook | json | `.json` | `0.9` | [sillytavern.md](sillytavern.md) |
| RoleCall character | `rolecall` | character | png / json | `.json` | `1.0` (CCv3 + `extensions.rolecall`) | [rolecall.md](rolecall.md) |
| RoleCall lorebook | `rolecall-lorebook` | lorebook | json | `.json` | `1.0` (v1 export envelope) | [rolecall.md](rolecall.md) |
| RisuAI | `risu` | character | `.charx` (zip) | `.charx` | `1.0` (zip with `card.json`) | [risu.md](risu.md) |
| RisuAI native lorebook | `risu-lorebook` | lorebook | json | `.json` | `1.0` (`{type:"risu",data}` envelope) | [risu.md](risu.md#native-lorebook-risu-lorebook) |
| Backyard / Faraday | `backyard` | character | json | `.json` | `0.9` / `0.55` | [backyard.md](backyard.md) |
| Agnai | `agnai` | character | json | `.json` | `1.0` | [agnai.md](agnai.md) |
| Vaudeville native | `vaud-json` | character | json | `.json` | `1.0` (own wrapper) | [vaud-json.md](vaud-json.md) |

Detection scores are the confidence each adapter's `detect()` returns for its own format. Higher wins;
`1.0` formats are more specific and outrank the generic `0.9` Tavern reader on the same card. The
threshold to be recognized at all is `0.5`.

## Cross-cutting

| Concept | Reference |
| --- | --- |
| Embedded `character_book` (a card's lorebook), extraction + re-embed | [../concepts/character-book.md](../concepts/character-book.md) |

## Not yet built (planned)

Tracked here so the matrix stays honest about what exists versus what is coming.

| Format | Kind | Status |
| --- | --- | --- |
| Lumiverse lorebook | lorebook | planned (Tier B) |
| Agnai lorebook (memory book) | lorebook | planned (Tier B) |
| NovelAI, Wyvern lorebooks | lorebook | planned (Tier C) |
