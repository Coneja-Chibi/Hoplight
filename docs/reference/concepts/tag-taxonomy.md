# Concept: the tag taxonomy

Character tags arrive as free strings from every source format (`discovery.tags` is `string[]`); no
format carries a category on the wire. The editor still colors each tag chip by KIND, so a pure
classifier decides which category a tag string belongs to.

Source: `src/core/tag-taxonomy.ts` (pure, tested in the sibling `tag-taxonomy.test.ts`). Presentation
(the per-category color and icon) lives in the UI layer at `src/ui/apps/workbench/Editor.tsx`
(`TAG_CATEGORY_STYLE`), not in core.

## Categories

`categorizeTag(tag: string): TagCategory` folds the tag to a lookup key (drop a leading `#`, lowercase,
collapse `_`, `-`, `/`, and whitespace to single spaces) and reads a seed dictionary. The categories:

| Category | Covers | Editor color |
| --- | --- | --- |
| `identity` | gender, sexuality, species | cyan |
| `trait` | personality, dere, archetype | violet |
| `role` | occupation, dynamic, relationship | rose |
| `genre` | genre | indigo |
| `theme` | trope / theme | pink |
| `setting` | place, era, environment | emerald |
| `pov` | narrative POV | sky |
| `mood` | mood / tone | amber |
| `kink` | kink | red |
| `warning` | trigger / content warning | orange |
| `meta` | authoring provenance, and the fallback for anything unrecognized | slate |

## Deliberately a seed, not the full taxonomy

The dictionary is a curated seed of common tags, mirroring RoleCall's display-category scheme. It is
NOT the full ~1000-tag taxonomy; unrecognized tags resolve to `meta` (neutral slate) and are never
mis-colored. The discovery milestone (Open Tagsheet) widens the dictionary by adding rows to `SEED`,
never by adding code branches - the lookup stays a single normalized `Map`.
