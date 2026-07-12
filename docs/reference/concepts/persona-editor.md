# Concept: the persona editor

The {{user}} sheet, wearing the CHARACTER editor's chassis on purpose (the kinship ruling,
2026-07-12): the same `.bento` three-column grid, `BentoCard` tiles, and `.lcard`/`.portrait`
face plate from `editor-styles`. Source: `src/ui/apps/workbench/persona/` (persona-editor
chassis + header, persona-cards tiles, injection-card, pure session ops).

Layout: LEFT = the sticky face plate (portrait via import, name, live token count) and the
Knowledge rail (the character editor's `KnowledgeRail`, verbatim: attach/detach/reorder
library books via knowledgeRefs). The header's Write-for pills are the shared `WriteForStrip`
(the regex editor consumes the same component); field inputs wear the house `es.in`/`es.ta`
classes. MIDDLE = Identity (tagline,
pronouns/height/age, and the BRIEF wearing its honesty line: the blurb stays on the shelf,
never sent to the model) plus the section tiles (Appearance / Body / Personality with trait
chips / Quirks / History) and the flat Identity Text for section-less personas. RIGHT = Color
Palette on the SHARED controls (registry-first): `SwatchRow` is the signature slot (the house
per-entity accent, resolved to real hex because signatureColor exports through codecs) and
`PaletteControl` in two-field mode edits the labeled colors (slot + color name + hex - the
compiler needs all before a swatch enters the prompt as a labeled tag), then Prompt
Injection (stops per Write-for lens via `injectionsForProfile` - RC's four, ST's five, hidden
on wires with no injection; a foreign stop shows dashed amber and is kept), the LIVE PREVIEW
(the REAL `core/persona/inject.ts` output - the ported RC compiler - counted by the lore
chars/4 convention; never a mock), and the default-persona star (a studio pref the shelf badge
reads).

THE FAMILY LANDMINE, enforced by compiler test: `brief` never enters the injected output;
`content` never becomes the card blurb.

## Reuse law on this surface

Every element on this page was walked against the component catalog (2026-07-12); verdicts +
fixes in docs/PERSONA-JEWEL-AUDIT.md. Anything new on this surface MUST come from
docs/reference/components.md first.

## The shelf

`src/ui/apps/library/views/persona-shelf.tsx` + `persona-shelf-ops.ts`: portrait/monogram
cards, the brief as the card line (its one honest home), pronouns · section count · lorebook
facts from the meta loader, the gilt Default badge.

## The wires

rcpersona (+ RC's V2-side-channel export), the SillyTavern personas BACKUP (imports the
default persona, seals the ENTIRE backup so the others re-emit byte-true), the Lumiverse
account object (the pronoun triplet as data), and the Marinara persona (theming/stat bars ride
sealed). See the codec headers for detection firewalls; the Agnai persona shape has no real
standalone file wire and is served by the structured-persona component on character cards.
