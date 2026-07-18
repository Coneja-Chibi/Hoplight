---
id: reference/entities/regex
title: Regex entity
audience: dev
summary: The canonical find/replace-script entity for a portable regex set: every RegexRule field, its type, the platforms that produce it, and its meaning.
tags: [entity, regex, canonical, fields]
related: [reference/architecture, reference/entities/character, reference/concepts/regex-engine, reference/concepts/regex-editor]
---

# Regex entity

A `CanonicalRegexSet` is `CanonicalEntity<"regex", RegexSetBody>`: the stable canonical wrapper (see
[architecture.md](../architecture.md)) around a `RegexSetBody`, the superset shape that unions what
every real find/replace-script format expresses. `src/entities/regex/schema.ts` is the source of truth
for the types; this page is the source of truth for what each field MEANS and which formats produce it.

A regex **set** is a named, ordered collection of **rules**. One rule maps 1:1 to a SillyTavern script
row, a Risu customscript row, a RoleCall rule, a Lumiverse script, or a Marinara script; one set maps to
an ST standalone file or card bundle, an RC script, a Lumi folder/pack slice, a Risu card/module list,
or a Marinara collection. A set stores under `studio/regex/<id>.json`, the same hub-and-spoke shape as
the lorebook, persona, and pack entities.

A rule is DATA. Applying one is a budgeted `String.replace`, never `eval`; see
[concepts/regex-engine.md](../concepts/regex-engine.md) for the pipeline that runs it and
[concepts/regex-editor.md](../concepts/regex-editor.md) for the Workbench room that authors it.

## How to read the field tables

The field tables on this page are generated from the schema by `scripts/docs-fields.ts` and embedded
verbatim. Do not hand-edit a cell: improve the schema doc comment and regenerate, and the docs follow.

- **Field** is the canonical name. A trailing `?` marks an optional field.
- **Type** is the TypeScript type in the schema.
- **Producers** are the source formats named in the field's schema doc comment. A `-` means the doc
  comment names no specific producer. Many such fields are the universal core every rule carries
  (`id`, `label`, `find`, `flags`, `replace`, `phases`, `enabled`, `sortOrder`); others simply have
  their provenance described in prose rather than tagged inline.
- **Meaning** is what the field is for. A blank Meaning cell is a self-evident primitive named by its
  own field, and marks a field the schema doc comment did not annotate. Non-obvious fields carry their
  meaning from the schema doc comment. Any richer explanation lives in the prose around a table, never
  inside a cell.

## Composition

`RegexSetBody` is small: a name, an optional description, a set-level `enabled` switch, and the ordered
`rules` list. Nearly all of the entity's surface lives inside `RegexRule`, a flat interface whose 21
fields still read as three concerns: identity and content (what the rule is and does), placement (when
and where it runs in the pipeline), and vaud-engine-only controls (behavior no wire format can carry).
`RegexRuleCondition` is a small nested shape used by one field, `condition`.

@fig composition

The sections below walk each shape. Every field table is pasted verbatim from
[docs/generated/fields.regex.md](../../generated/fields.regex.md).

## The set

`RegexSetBody` is the top-level shape: the set's own name and description, its on/off switch, and the
rule list.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `name` | `string` | - |  |
| `description?` | `string` | - |  |
| `enabled?` | `boolean` | - | Set-level on/off (the Library shelf's enable switch; the lorebook `enabled?` precedent). Absent = on; always read as `enabled !== false`. An off set skips export the way an off lorebook does. Additive and optional so the risu character codec and the in-flight set editor stay compatible. |
| `rules` | `RegexRule[]` | - |  |

## The rule

`find` and `flags` are stored **separately** (the Risu/RC/Lumi encoding); the SillyTavern codec
folds/unfolds its single `/pattern/flags` wire string on import and export. `flags` is stored
verbatim, including Risu extension tokens observed live (`"gu<cbs>"`), never stripped except at
compile time inside the engine.

Reading down the table below: `id` through `trimStrings` is identity and content, `phases` through
`characterIds` is placement, `firstMatchOnly` through `overlay` are the three vaud-engine-only
controls, `enabled` and `sortOrder` are the rule's own membership state, and `extras` is the escrow
bag (see [What rides escrow, not a field](#what-rides-escrow-not-a-field) below).

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `id` | `string` | - | stable rule id, preserved across round-trips |
| `label` | `string` | - |  |
| `note?` | `string` | Lumiverse | internal creator note; distinct from label (Lumiverse `description`) |
| `find` | `string` | - | bare pattern, NO delimiters |
| `flags` | `string` | - | verbatim flags string; default "g"; may carry non-JS extension tokens |
| `useFlags?` | `boolean` | Risu | Risu `ableFlag`: whether the custom flags string applies |
| `replace` | `string` | - | verbatim; may carry $1/{{match}}/CBS/HTML - render only through SealedHtmlPreview |
| `trimStrings?` | `string[]` | RC, ST | ST/RC/Lumi: fragments stripped from the match before replace |
| `phases` | `RegexPhase[]` | - |  |
| `targets?` | `RegexTargetChannel[]` | Lumiverse | Lumiverse's placement x target matrix; absent = platform default |
| `substituteFind?` | `RegexSubstitution` | - | find-side macro substitution mode; absent = "none" |
| `minDepth?` | `number \| null` | RC, ST, Marinara | ST/RC/Lumi/Marinara depth window (message depth, 0 = most recent - exact counting per platform is an R1 residual, see REGEX-FORMATS.md) |
| `maxDepth?` | `number \| null` | - |  |
| `runOnEdit?` | `boolean` | RC, ST | ST/RC/Lumi: re-apply this rule when a message is edited |
| `characterIds?` | `string[]` | Marinara | Marinara `targetCharacterIds`: limit to specific recipient characters; empty/absent = all |
| `firstMatchOnly?` | `boolean` | - | Vaud-engine-only (R2X, no wire home anywhere - travel lint marks these three under every platform lens; export keeps the data canonical-side and emits nothing): replace only the FIRST match even under a global flag. |
| `condition?` | `RegexRuleCondition` | - | Vaud-engine-only: run only when another rule in this set did (or did not) apply this pass. |
| `overlay?` | `boolean` | ST | Vaud-engine-only: display-channel rule that returns match spans + replacement as an OVERLAY instead of mutating text (ST names this "Overlay strategy" and implements it nowhere). |
| `enabled` | `boolean` | - |  |
| `sortOrder` | `number` | - |  |
| `extras?` | `Record<string, unknown>` | ST | Per-platform leftovers with no first-class home (Lumi telemetry/scope/script_id, ST id/uuid, ...). Sealed, round-trips untouched - the lossless-escrow doctrine. |

### Rule chaining

`condition` is the only field that reaches for a nested shape. It chains a rule's own firing on
whether an EARLIER rule in the same set did, or did not, apply on the same pass: one pass, `sortOrder`
order, never a forward reference. A `ruleId` naming a rule that has not run yet, or does not exist,
skips the carrying rule with an honest trace reason instead of guessing.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `ruleId` | `string` | - |  |
| `matched` | `boolean` | - |  |

## The character-card twin

`CharacterRegexScript` (same file, `src/entities/regex/schema.ts`) is the narrow, card-embedded Risu
`customScripts` shape: singular `phase` instead of `phases`, and no `id` / `enabled` / `sortOrder`,
because the card wire has none of those. `entities/character/schema.ts` re-exports this type as its
own `RegexScript` so there is one definition, not two independently maintained shapes. It is
deliberately NOT `RegexRule` itself: a full alias would change `CharacterBehavior.regexScripts`'s wire
contract and break the Risu codec's round-trip. It stays the small card-embedded twin until a real
migration replaces `customScripts` with references to standalone regex entities. See
[entities/character.md](character.md), section CharacterBehavior.

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `label?` | `string` | - |  |
| `find` | `string` | - |  |
| `replace` | `string` | - |  |
| `phase` | `string` | - | pipeline phase, open union: "edittrans" \| "editoutput" \| "editdisplay" \| ... |
| `flags?` | `string` | Risu | custom regex flags (Risu `flag`) |
| `useFlags?` | `boolean` | Risu | whether the custom flags apply (Risu `ableFlag`) |

## What rides escrow, not a field

Anything a single source format keeps but no canonical field expresses stays in `escrow[formatId].raw`
and survives a same-format round-trip byte-for-byte, the same doctrine every entity follows (see
[architecture.md](../architecture.md)). For the SillyTavern codec this is
`original["sillytavern-regex"]`, the raw script rows kept for exact re-projection on export.

A second, finer-grained mechanism sits at the rule level. `extras` is itself a canonical field on
`RegexRule`, not the entity envelope: it seals per-platform leftovers with no first-class slot
(Lumiverse telemetry, scope, `script_id`; SillyTavern `id`, `uuid`; any wire key the schema does not
model) and re-merges them onto the wire untouched on export. It rides in the schema, at row grain,
rather than in one whole-file `original` snapshot, because different rules in the same set can carry
different unrecognized keys, and an edited or reordered rule still needs its own leftovers to
re-emit correctly, not just an unedited file replayed verbatim.

Does NOT ride escrow, because it is modeled: `firstMatchOnly`, `condition`, and `overlay` have no wire
home on ANY platform (travel-lint marks all three under every platform lens), but they are first-classed
canonical fields, not escrow. They are vaud-engine-only controls the Workbench editor can set and
`applyRules` (`core/regex/apply.ts`) actually executes; export simply emits nothing for them on a
format that cannot carry them.

## See also

- [architecture.md](../architecture.md): the canonical model, escrow, hub-and-spoke, the adapter contract.
- [entities/character.md](character.md): the `CharacterBehavior.regexScripts` field, and the `RegexScript` card twin this page defines.
- [concepts/regex-engine.md](../concepts/regex-engine.md): how a rule set actually runs (`applyRules`, the AST layer, travel-lint).
- [concepts/regex-editor.md](../concepts/regex-editor.md): the Workbench authoring surface, its three modes, and the test bench.
- [formats/README.md](../formats/README.md): the coverage matrix of every format and the fields it produces.
