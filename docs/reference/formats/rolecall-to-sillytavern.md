---
id: reference/formats/rolecall-to-sillytavern
title: RoleCall to SillyTavern presets
audience: dev
summary: What converts mechanically when a RoleCall preset becomes a SillyTavern preset, what Kit reports about the parts that do not, and the four patterns for finishing those by hand.
tags: [format, rolecall, sillytavern, preset, macro, conversion, state]
related: [reference/formats/rolecall, reference/formats/sillytavern, reference/platforms/sillytavern/macro-operators, reference/platforms/sillytavern/macro-reference, reference/entities/preset]
---

# RoleCall to SillyTavern presets

A RoleCall preset can carry a second program alongside its prompts: a hook machine that writes
variables as text passes through, and prompt bodies full of conditionals that read them back. Most of
it crosses to SillyTavern mechanically. A small remainder needs a decision that no table can make,
and this page is about telling the two apart.

This page is specific to one crossing on purpose. The conversion machinery is not: macros resolve
through a canonical operation hub, so no engine pair is written down anywhere
([architecture.md](../architecture.md), rule 1). What follows is not a pair table. It is the set of
judgment calls that remain after the hub has done everything derivable, written down so the next
person does not rediscover them.

## What converts without a decision

These are handled in code. They need no review and appear in the transfer receipt only as
`rewrite` entries.

**Separator and spelling differences.** Each catalog declares the shape of its own forms, so
`{{roll::2d6}}` becomes `{{roll:2d6}}` and `{{datetimeformat::HH:mm}}` becomes
`{{datetimeformat HH:mm}}` without either engine knowing about the other.

**Indexed access.** SillyTavern has no arrays, but an array of fixed slots is a set of variables
whose names carry the index, so the access lowers rather than dies:

```text
{{getvarkey::propp_plan::3}}                    ->  {{getvar::propp_plan_3}}
{{getvarkey::propp_plan::{{getvar::propp_index}}}}  ->  {{getvar::propp_plan_{{getvar::propp_index}}}}
```

The computed form works because a nested macro resolves before its consumer, so the composed name is
what gets looked up. SillyTavern documents exactly this shape itself, as `{{getvar::{{char}}_mood}}`
([macro-operators.md](../platforms/sillytavern/macro-operators.md)).

**Conditionals.** SillyTavern's current macro engine has `{{if}}`, `{{else}}`, `{{/if}}`, `!`
inversion and comparison operators, so RoleCall blocks are preserved rather than flattened. The
target's own catalog decides this through the canonical `flow.conditional` operation; an engine
without conditionals still gets its blocks flattened to their body, with the dropped condition kept
as a `{{// ...}}` comment.

Macros nested inside a preserved block, or passed as arguments to a portable macro, are translated
too. Both were defects at one point, and both are now covered by tests.

## What Kit reports

The engine computes facts. It does not decide what to do about them. A preset transfer or export
receipt carries a `structure` section:

| Field | What it answers |
| --- | --- |
| `arrays` | Which variables are addressed by index, which literal indices appear, and how many accesses use a computed index |
| `domains` | Variables whose every written value was a short literal, with the value set |
| `wideVariables` | Variables that are literal but too long or too many to expand inline, named rather than dropped in silence |
| `pushHooks` | Hooks that append to a list, with the trigger regex verbatim |
| `choices` | Each `{{choice::x}}` resolved against the choice group it names, with that group's declared options and default |
| `markerCandidates` | Dead macros whose name resembles a canonical marker slot |
| `stateLayer` | `read`, `absent`, or `unknown` |

`stateLayer` deserves attention. A RoleCall hook machine lives only in escrow, never in the canonical
body. A piece whose escrow was dropped reports `unknown`, not zero hooks, because zero read as "there
are none" is precisely the mistake this distinction exists to prevent.

## Pattern 1: a choice group becomes a seeded variable

`{{choice::x}}` asks RoleCall for the option a user picked at load time. SillyTavern has no such
concept, so the macro is removed on the way out and the receipt records it.

The choice group itself survives conversion as canonical data, so the receipt can hand you its
options. Replace the read with an ordinary variable, and seed that variable once at the top of the
preset:

```text
Seed block, placed first:      {{setvar::lang::English}}
Every former {{choice::lang}}: {{getvar::lang}}
```

The seed is the group's declared default when it has one. A person switching options edits one line
instead of hunting every reference, which is the closest thing to the original behaviour that a
preset without a picker can offer.

## Pattern 2: fix the producer, not the consumer

`{{regex::...}}` post-processes a value inline. SillyTavern has no such macro, and there is no
expression that replaces it in place.

The move is to stop needing it. A value that has to be cleaned before use is a value that was
produced wrong, and the producer is almost always reachable: the hook or the write that built the
string. Clean it there, once, instead of at every read.

Where the transformation genuinely belongs at the boundary, SillyTavern regex scripts can carry it.
They are not macros and do not appear in the macro catalog, so the converter will not reach for them
on your behalf; adding one is a deliberate act.

## Pattern 3: a closed domain expands into a conditional

`{{upper::...}}` has no SillyTavern equivalent. Applied to a variable whose values are unknown, that
is unfixable. Applied to one whose value set is closed, it is a lookup.

This is why the receipt reports `domains`. When a variable's every write is a short literal, its full
value set is known, and the uppercase form can be written where the value is written:

```text
{{setvar::story_mode::driven}}{{setvar::story_mode_upper::DRIVEN}}
```

Then `{{upper::{{getvar::story_mode}}}}` becomes `{{getvar::story_mode_upper}}`. This costs one extra
write per assignment and removes the macro entirely.

**Check the receipt before applying this.** The pattern needs a literal assignment site to attach the
paired write to, so it only works for a variable the receipt actually lists under `domains`. In the
preset measured for this page, `{{upper}}` was applied to a variable that is computed rather than
assigned, and no amount of expansion helps there: the fix is Pattern 2, moving the transformation to
whatever produces the value.

`domains` counts every form that writes, not just `{{setvar}}`. Shorthand assignment, `{{addvar}}`,
`{{incvar}}` and `{{decvar}}` all open a variable's domain, because a value derived from the current
one cannot be enumerated ahead of time. Three variables in the measured preset looked like the closed
set `{0}` until the arithmetic writes driving them were counted; they are running counters, and
expanding one into a constant zero would have been the most damaging thing this report could say.

Check `wideVariables` before concluding a variable has no domain. A variable listed there was written
only with literals but had values too long or too many to expand, which is a different situation from
a variable whose values are computed.

## Pattern 4: a macro becomes a marker prompt

`{{message_history}}` splices the transcript. SillyTavern does this too, but not with a macro: it
uses a marker prompt, a prompt-list entry with the identifier `chatHistory` that the prompt builder
positions during assembly.

So the conversion is not a rewrite. It is a deletion plus a structural edit: remove the macro, then
enable or add a marker block at the position the macro occupied.

**The converter cannot do this.** Translation rewrites text within a block; it does not add, remove,
or reposition blocks. That is a real boundary, not an oversight, and it is why `markerCandidates`
reports a candidate for a person to act on rather than performing the promotion. The same reasoning
covers `dialogueExamples`, `worldInfoBefore`, `worldInfoAfter`, and the other slots in
[preset.md](../entities/preset.md).

## The hook machine

RoleCall's `macro_engine_yaml` is a list of regex-triggered hooks: a trigger, flags, a placement of
`user_input` or `ai_output`, an optional `strip`, and actions that `set`, `unset`, `append` or `push`
a variable.

The pieces line up with SillyTavern regex scripts more closely than they first appear. A regex script
has a find pattern, a replacement, and a placement whose values include user input and AI output.
Crucially, a replacement is macro-substituted after capture groups are filled in, so a replacement
containing `{{setvar::mood::calm}}` really does write state. A hook that sets a variable therefore has
a direct counterpart.

`push` is the one that does not. It appends each match to a list, and SillyTavern has no lists. It
lowers the same way indexed reads do, onto numbered variables, which means a single hook becomes as
many captures as the array has slots. The receipt gives you both numbers: `pushHooks` carries the
trigger verbatim, and `arrays` gives the index range the reads actually use, so the count is measured
rather than guessed.

Nothing in this section is automated. Hoplight seals `macro_engine_yaml` as escrow and never executes
it ([architecture.md](../architecture.md)), and building the corresponding regex scripts is authoring
work that a person signs off on.

## Evidence

Claims here are backed at different strengths, and the difference matters:

- **Unit-proven.** Separator rewriting, indexed-access lowering, block preservation, nested-argument
  translation, and every field of the `structure` report. See `translate.test.ts` and
  `structure.test.ts`.
- **Integration-proven.** A RoleCall preset crossing to SillyTavern through the real adapter
  registry, resolving its dialect from escrow and carrying structural findings into the receipt. See
  `transfer-e2e.test.ts`.
- **Code-read.** SillyTavern's regex replacement path calling `substituteParams`, its placement
  values, and its marker prompt identifiers, all read from that project's source. The four patterns
  themselves are recommendations for an author, not implemented behaviour.

Measured on one 9,286-token RoleCall preset: 86 macros unsupported by SillyTavern before translation,
0 after, across 92 rewrites and 4 removals. The 4 removals are one instance of each pattern above.
