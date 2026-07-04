# Entity: lorebook

The canonical lorebook (world info) superset. Source of truth for the types:
`src/entities/lorebook/schema.ts`. A `CanonicalLorebook` is `CanonicalEntity<"lorebook", LorebookBody>`.

A lorebook is a set of **entries**, each a chunk of text that gets injected into the prompt when its
**triggers** match the recent conversation. Different apps call this world info, lorebook, character
book, or memory; the mechanics are the same.

The canonical shape is **flat**: it mirrors RoleCall's in-memory entry type (the richest real model),
and each format codec re-nests or re-encodes to its own wire on export. It was verified against real
wire producers (VAUDEVILLE `packages/lorebook` serializer + parser), which is why five RoleCall
in-memory-only fields are **not** canonical fields (see the end of this page).

## LorebookBody

Book-level settings.

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | `string` | The book's name. |
| `description` | `string?` | Free-text description. |
| `lorebookType` | `"world" \| "character" \| "scenario" \| "rules" \| "utility" \| "other"?` | What role the book plays. |
| `genre` / `fandom` | `string?` | Categorization. |
| `tags` | `string[]` | Free-text tags. |
| `globalCaseSensitive` | `boolean` | Default case sensitivity for matching, book-wide. |
| `globalMatchWholeWords` | `boolean` | Default whole-word matching, book-wide. |
| `globalScanDepth` | `number` | How many recent messages to scan for triggers, book-wide. |
| `globalRecursion` | `boolean` | Whether an activated entry's text can itself trigger further entries. |
| `tokenBudget` | `number` | Max tokens the book may inject per turn. |
| `budgetMode` | `"token" \| "entry"` | Whether the budget counts tokens or number of entries. |
| `entryBudget` | `number` | Max entries injected per turn (when `budgetMode` is `entry`). |
| `entries` | `LorebookEntry[]` | The entries (below). |
| `categories` | `LorebookCategory[]?` | Optional grouping of entries into named categories (`{ id, name, sortOrder, enabled? }`). |

## LorebookEntry

One triggerable chunk. Fields are grouped by concern below for readability; in the schema they are flat.

### Identity and content

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | Stable entry id (used to match a canonical entry to its escrow twin on export). |
| `title` | `string` | Display title / comment. |
| `content` | `string` | The text injected when the entry fires. |
| `comment` | `string \| null` | An internal authoring note distinct from the title (RoleCall). ST has none. |
| `enabled` | `boolean` | Whether the entry is active. |
| `constant` | `boolean` | If true, the entry is always injected regardless of triggers ("blue-light" / always-on). |

### Triggers (matching)

An entry fires when its triggers match. `secondaryTriggers` refine that match via `selectiveLogic`.

| Field | Type | Meaning |
| --- | --- | --- |
| `triggerMode` | `"simple" \| "advanced"` | Advanced mode carries per-trigger probability. |
| `triggers` | `Trigger[]` | Primary keywords. Each `Trigger` is `{ keyword, isRegex, flags?, frequency?, probability? }`. |
| `secondaryTriggers` | `Trigger[]` | Secondary keywords combined with the primary set per `selectiveLogic`. |
| `selectiveLogic` | `"and_any" \| "and_all" \| "not_any" \| "not_all"` | How secondary triggers gate activation. |
| `caseSensitive` | `boolean \| null` | Per-entry override of the book default; `null` inherits. |
| `matchWholeWords` | `boolean \| null` | Per-entry override; `null` inherits. |
| `scanDepth` | `number \| null` | Per-entry scan depth override; `null` inherits the book. |

A regex trigger is encoded on the wire as `/pattern/flags`; `isRegex` and `flags` carry that
structurally in canonical.

### Injection (placement)

| Field | Type | Meaning |
| --- | --- | --- |
| `position` | `InjectionPosition` | Where the content is inserted. One of `world`, `character`, `before_example`, `after_example`, `depth`, `append`, `append_bottom`, `prepend_top`, `scene`. Formats with fewer slots collapse the richer ones to their nearest (see per-format docs). |
| `depth` | `number` | For `depth` position, how deep from the end. |
| `role` | `"system" \| "user" \| "assistant"` | Which role the injected text speaks as. |

### Ordering and priority

| Field | Type | Meaning |
| --- | --- | --- |
| `sortOrder` | `number` | Placement / insertion order: where the entry lands relative to siblings. The universal ordering axis (ST `order`, Risu `insertorder`, CCv2/v3 `insertion_order`, Agnai `weight`, RC `sortOrder`). |
| `priority` | `number` | Eviction / budget priority: which entries survive when the token budget is exceeded (higher survives). A distinct axis from placement (CCv3 `priority`, Agnai `priority`, RC `priority`); formats with no eviction field (ST, Risu) default it to `100`. |

### Timing

| Field | Type | Meaning |
| --- | --- | --- |
| `sticky` | `number` | Stay active for N turns after firing. |
| `cooldown` | `number` | Cannot re-fire for N turns after firing. |
| `delay` | `number` | Cannot fire until N messages into the chat. |

### Grouping

| Field | Type | Meaning |
| --- | --- | --- |
| `groupName` | `string \| null` | Inclusion group: entries in a group compete so only some fire. |
| `categoryId` | `string \| null` | Links the entry to a `LorebookCategory`. |
| `groupWeight` | `number` | Weight within the group when competing. |
| `probability` | `number` | 0..100 chance the entry fires when matched. |

### Recursion and budget

| Field | Type | Meaning |
| --- | --- | --- |
| `useMemo` | `boolean` | Treat as a memo (client-specific). |
| `excludeRecursion` | `boolean` | This entry's content is not scanned to trigger others. |
| `preventRecursion` | `boolean` | This entry cannot be triggered by other entries' content. |
| `delayUntilRecursion` | `number` | Only eligible on recursion pass N. |
| `ignoreBudget` | `boolean` | Always inject, ignoring the token budget. |

### Scan sources

Which extra text (beyond chat) is scanned for this entry's triggers.

| Field | Type | Meaning |
| --- | --- | --- |
| `scanCharacterDescription` | `boolean` | Scan the character description. |
| `scanCharacterPersonality` | `boolean` | Scan the personality. |
| `scanUserPersona` | `boolean` | Scan the user persona. |
| `scanScenario` | `boolean` | Scan the scenario. |

### Filters and effects

| Field | Type | Meaning |
| --- | --- | --- |
| `characterFilter` | `CharacterFilter \| null` | Restrict the entry to (or exclude it from) named characters/tags. `{ names, tags, isExclude }`. |
| `sideEffects` | `EntrySideEffects \| null` | Variable mutations when the entry fires: a list of `{ type, variable, value?, amount?, scope }` where `type` is `setvar`/`addvar`/`incvar`/`decvar`/`delvar`, plus `onlyOnFirstTrigger` and `clearOnDeactivate`. |
| `metadata` | `Record<string, unknown>?` | Free-form per-entry metadata carried through. |

## Fields that ride escrow, not a canonical slot

These are RoleCall in-memory fields with **no wire producer**: no serializer emits them, and the RoleCall
v1 parser hardcodes them as defaults (its own comment: "RC schema doesn't have this yet"). Per the
superset rule, they are not canonical fields; they survive a same-format round-trip in escrow only.

| Field | Why escrow |
| --- | --- |
| `allowRecursion` | No serializer emits it. |
| `boostIds` | No serializer emits it. |
| `boostAmount` | No serializer emits it. |
| `scanPreset` | No serializer emits it. |
| `probabilityMode` | No serializer emits it. |

SillyTavern's two extra scan sources (`matchCharacterDepthPrompt`, `matchCreatorNotes`) and its entry
`uid` likewise ride escrow: they have no canonical slot but survive an ST round-trip verbatim.
