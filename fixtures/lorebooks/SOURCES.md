# Lorebook fixture downloads

Downloaded for import/round-trip testing. 1–2 samples per host family.

## Codec status (as of fixture work)

| Path | Standalone codec | Notes |
|------|------------------|--------|
| `st/*.json` (object `entries` map) | `sillytavern-lorebook` | Full RT |
| `chub/*.book.json` (array entries) | ST @ 0.85 / Agnai @ 0.7 | CCv3 character_book; ST re-exports keyed worldbook; Agnai re-exports MemoryBook |
| `agnai/*` (same as Chub books) | Agnai @ 0.7 | Not native MemoryBook on disk; soft-import works |
| `nai/*` | `novelai-lorebook` | Full RT (`.lorebook` / json) |
| `risu/cherry-character-book.json` | Risu @ 0.75 | Extracted card book; re-exports native `{type:risu,data}` envelope |
| `rolecall/*` | `rolecall-lorebook` | Full RT |

Native Agnai MemoryBook (`kind:"memory"`, `keywords`/`entry`) and native Risu envelope still preferred when available.

## SillyTavern (World Info JSON)

| File | Source |
|------|--------|
| `st/Example-Busy-at-Work.json` | Hugging Face: [sphiratrioth666/Lorebooks_as_ACTIVE_scenario…](https://huggingface.co/sphiratrioth666/Lorebooks_as_ACTIVE_scenario_and_character_guidance_tool) |
| `st/Eorzea-FFXIV.json` | [Bronya Rand World & Lore Books](https://bronya-rand.github.io/reimagined-couscous/world-lore-books) → `world-info/Eorzea.json` |

Native ST World Info shape: `{ entries: { "0": { uid, key, content, … } } }`.

## Chub (standalone lorebooks)

Pulled via `https://api.chub.ai/api/lorebooks/{user}/{slug}?full=true`, then `node.definition` (or `embedded_lorebook`) saved as `.book.json`.

| File | Source |
|------|--------|
| `chub/example-lorebook.book.json` | [lorebooks/BartlebyTheScrivener/example-lorebook](https://chub.ai/lorebooks) (API full=true) |
| `chub/adolion.book.json` | [lorebooks/statuotw/the-fantasy-world-of-adolion-1a189c34](https://chub.ai/lorebooks) |

Shape: `{ name, entries, scan_depth, token_budget, recursive_scanning, … }` (character-book / ST-adjacent).

## Agnai (Memory Book)

Agnai imports Chub JSON as memory books; no separate public shelf used.

| File | Source |
|------|--------|
| `agnai/chub-example-as-memory-book.json` | Same as Chub example book |
| `agnai/adolion-memory-book.json` | Same as Chub Adolion book |

## NovelAI

| File | Source |
|------|--------|
| `nai/the_descriptor_v1_2.lorebook` | [TravelingRobot/NAI_lorebooks](https://github.com/TravelingRobot/NAI_lorebooks) |
| `nai/nai-v6-crystal-dragon.lorebook.json` | Copy of `samples/novelai/nai-v6-crystal-dragon.lorebook.json` (see that SOURCES.md) |
| `nai/sigurdcard-embedded-lorebook.png` | Official NAI docs embedded sample: `https://docs.novelai.net/assets/textassets/sigurdcard.png` |

## RisuAI

| File | Source |
|------|--------|
| `risu/cherry-character-book.json` | Extracted `data.character_book` from `samples/risu/cherry.card.json` |

Standalone RisuRealm lorebook downloads need an authenticated / module id; none were available unauthenticated. Card-embedded book is the public fixture.

## RoleCall

| File | Source |
|------|--------|
| `rolecall/aetheria-lorebook.v1.json` | Copy of `samples/rolecall/aetheria-lorebook.v1.json` |

## Re-download cheatsheet

```bash
# ST HF
curl -L -o st/Example-Busy-at-Work.json \
  "https://huggingface.co/sphiratrioth666/Lorebooks_as_ACTIVE_scenario_and_character_guidance_tool/resolve/main/Example%20-%20Busy%20at%20Work.json"

# ST Bronya
curl -L -o st/Eorzea-FFXIV.json \
  "https://bronya-rand.github.io/reimagined-couscous/world-info/Eorzea.json"

# Chub full definition (then extract .definition to .book.json)
curl -L -o chub/example.full.json \
  "https://api.chub.ai/api/lorebooks/BartlebyTheScrivener/example-lorebook?full=true"

# NAI
curl -L -o nai/the_descriptor_v1_2.lorebook \
  "https://raw.githubusercontent.com/TravelingRobot/NAI_lorebooks/main/the_descriptor/the_descriptor_v1_2.lorebook"
curl -L -o nai/sigurdcard-embedded-lorebook.png \
  "https://docs.novelai.net/assets/textassets/sigurdcard.png"
```
