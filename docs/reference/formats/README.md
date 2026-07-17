# Formats

Every format vaud reads and writes. A **format** is a folder in `src/formats/<name>/`; the loader
discovers it automatically (see [../architecture.md](../architecture.md)). Each format family gets one
reference page here.

## Coverage matrix

The exhaustive adapter list lives in [FORMAT-SUPPORT.md](../../FORMAT-SUPPORT.md): it is generated
from the live registry (`bun run matrix`) and CI fails if it drifts (`matrix:check`). A hand copy
here rotted once (it was missing three shipped adapters); it does not get a second chance.

## Reference pages

| Family | Page | Covers |
| --- | --- | --- |
| SillyTavern | [sillytavern.md](sillytavern.md) | character card (v2/v3, png/json), world info, personas |
| RoleCall | [rolecall.md](rolecall.md) | character, lorebook, regex, persona |
| RisuAI | [risu.md](risu.md) | `.charx`, native lorebook, `.risum` modules, regex |
| Backyard / Faraday | [backyard.md](backyard.md) | legacy json and the `.byaf` archive |
| Agnai | [agnai.md](agnai.md) | character, memory book |
| NovelAI | [novelai.md](novelai.md) | `.lorebook` |
| Vaudeville native | [vaud-json.md](vaud-json.md) | the canonical wrapper |

Adapters without a dedicated page yet (pygmalion, lumiverse, marinara, chub) are documented by their
source folders under `src/formats/` and appear in the generated matrix.

Detection scores are the confidence each adapter's `detect()` returns for its own format. Higher
wins; more-specific formats outrank the generic Tavern reader on the same card. The threshold to be
recognized at all is `0.5`.

## Cross-cutting

| Concept | Reference |
| --- | --- |
| Embedded `character_book` (a card's lorebook), extraction + re-embed | [../concepts/character-book.md](../concepts/character-book.md) |

## Not yet built (planned)

Tracked here so the matrix stays honest about what exists versus what is coming.

| Format | Kind | Status |
| --- | --- | --- |
| Wyvern lorebook | lorebook | **no standalone wire format** (see below) |

Wyvern needs **no dedicated lorebook codec**: it has no verifiable standalone lorebook file. Wyvern's
character export is a **CCv2 PNG**, which vaud already reads as a character; its Lexicon is
character-attached, so it either rides that card's `extensions.wyvern` as escrow (already carried by the
CCv2 reader) or lives only in-app (like Janitor), with no serialized file to convert. No public real
Wyvern export exists to confirm which, and building a codec from wiki-inferred fields with zero real bytes
would violate the wire-gate doctrine (a codec earns existence only when a real wire format serializes it).
Revisit **only if** a real standalone Wyvern export lands: the two open questions are whether the Lexicon
serializes standalone and whether it lives in CCv2 `extensions`. This is a closed verdict, not scheduled
work.

Lumiverse World Books need **no dedicated codec: they are already covered** by `risu-lorebook` and the
CCv3/ST worldbook codecs. Lumiverse is a local app, so lorebooks only move in and out of it as files, and
the file forms are Risu/CCv3, not anything Lumiverse-native:

- **Import** (`parseDirectLorebook`, verified in the LumiRealm source) accepts exactly two shapes:
  Risu-native `{type:"risu", data:[...]}` and CCv3/TavernAI `{entries:{...}}`. vaud's `risu-lorebook`
  emits the former (matching their parser's `obj.type === "risu" && Array.isArray(obj.data)` gate exactly)
  and `sillytavern-lorebook` emits the latter.
- **Export** goes back out the same way: a Lumiverse module file carries a Risu-shaped `loreBook[]`
  (`core/schemas/module.ts`), and `lumiEntryToRisuLore` converts native rows back to the Risu shape on
  fetch. There is no lorebook export handler that emits a Lumiverse-native file.
- Their rich native structure, `LumiWorldBookEntry` (~40 fields, incl. Lumiverse-only `vectorized`,
  `vector_index_status`, `automation_id`, `group_override`), is a **database row**, not a portable file.
  It is populated from Risu/CCv3 on import (`mapLoreBookEntry`, stashing Risu extras under
  `extensions.risu_*`) and never serialized standalone. The only file that carries it is the `.lvbak`
  full-account backup, a separate multi-entity concern, not a lorebook codec.

So Lumiverse lorebook interop round-trips through existing codecs today. A native `LumiWorldBookEntry` file
codec would be dead surface (no wire serializes it). Revisit only if a real `.lvbak` account backup lands
as its own bundle-restore effort.
