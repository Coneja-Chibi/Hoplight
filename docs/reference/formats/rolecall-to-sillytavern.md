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

`{{regex::VALUE::PATTERN::REPLACEMENT}}` rewrites a value as a prompt renders. SillyTavern has no
such macro.

**Regex scripts are not the counterpart, and this is worth being exact about.** They run over chat
messages and world-info entries, applied across `coreChat` while a prompt is assembled - never over
preset prompt content. There is no surface on which a script could clean a variable being read inside
a prompt block, so no arrangement of scripts reproduces the macro. Emitting one anyway would produce
a rule that runs, matches nothing, and looks correct.

So the move is to stop needing it, and **the converter now performs that repair** for the shape it
can recognise. A list assembled by appending `separator + item` onto an empty variable comes out with
a leading separator, and the usual fix is to strip it afterwards with exactly this macro. Guard each
append on whether the variable already holds something and the separator never appears:

```text
{{addvar::pool::, ITEM}}

  ->  {{if {{getvar::pool}}}}{{addvar::pool::, ITEM}}{{else}}{{setvar::pool::ITEM}}{{/if}}
```

The cleanup macro is then deleted rather than translated, because there is nothing left for it to
clean. That is the whole pattern: the consumer stops needing the fix because the producer stopped
causing it.

Scope travels with the variable. SillyTavern keeps chat-local and global variables in separate
stores, so a global list is repaired with `getglobalvar` and `setglobalvar` throughout. Guarding a
global append with a chat-local read would test a variable that is always empty, and the list would
never join.

**Nothing is compiled.** Whether a pattern strips a separator is decided by normalising it as text,
so an authored regex never executes. The cost is that only straightforward spellings are recognised;
a cleanup that rewrites rather than strips, reads something other than a plain variable, or whose
producer lives in another block comes back under `producerFixes.unfixed` with the reason. A wrong
guess here silently changes what a preset renders, which is worse than leaving the macro alone.

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

So the conversion is not a rewrite. It is a structural edit, and **the converter performs it**: the
block carrying the macro is split, so the text around the splice still surrounds it.

```text
"Recent events:\n{{message_history}}\nRespond in character."

  ->  prompt   "Recent events:"
      marker   chatHistory
      prompt   "Respond in character."
```

Order of operations is the whole trick. The translator REMOVES a macro with no home on the target,
so by the time it has run there is nothing left to promote. Promotion therefore reads the dead
tokens off the original body and restructures before any text is rewritten.

**Promotion happens only when the slot is unambiguous.** A dead macro is matched against the
canonical marker slots by shared word; exactly one match promotes, and zero or several leave the
token alone for a person to place. Moving authored content to the wrong part of the prompt reads as
the preset behaving oddly rather than as a conversion error, and is far harder to trace than a macro
that stayed put. A macro the target can still run is never touched: restructuring a working preset
for no reason is worse than doing nothing.

Every split is reported under `promotions`, because rearranging someone's prompt list is not
something to do quietly.

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

**The hook machine is rendered for you.** A crossing that changes dialect returns `hookRules`: the
hooks as regex rules the target can run, in declaration order, with each trigger carried verbatim
because both engines use the same regex syntax.

The authored value goes across verbatim too, and that detail is load-bearing. RoleCall writes
templates like `value: "$1 = $2 /// "` - literal text woven around two capture groups - and a reset
writes `value: ""` on purpose. Guessing `$1` would silently discard the second group and the joining
text; guessing the whole match would turn a deliberate clear into a write. Capture-group syntax is
identical on both sides, so the template needs no rewriting.

Declaration order is preserved in `sortOrder` because it is load-bearing: a hook that clears state
must run before the hooks that write it, or it erases them. That is not hypothetical - see the
staging cycle in the observations Kit returns.

Two things are still refused rather than approximated. `push` is not rendered, for the reason above:
one hook becomes as many rules as the array has slots, and that count comes from how the preset reads
the array rather than from the hook, so a single plausible rule would run while keeping one value.
Hoplight also still seals `macro_engine_yaml` as escrow and never executes it
([architecture.md](../architecture.md)) - the rules are read as declarations and rendered as text.

Placing the rendered rules into a target is a separate act. Kit hands them over; it does not write
them into someone's regex library on their behalf.

## Evidence

Claims here are backed at different strengths, and the difference matters:

- **Unit-proven.** Separator rewriting, indexed-access lowering, block preservation, nested-argument
  translation, every field of the `structure` report, the observations in `explanation`, the rendered
  `hookRules`, and marker promotion. See `translate.test.ts`, `structure.test.ts`, `explain.test.ts`,
  `hooks-to-regex.test.ts` and `promote-markers.test.ts`.
- **Integration-proven.** A RoleCall preset crossing to SillyTavern through the real adapter
  registry, resolving its dialect from escrow and carrying structural findings, promotions and
  rendered rules into the receipt. See `transfer-e2e.test.ts`.
- **Code-read.** SillyTavern's regex replacement path calling `substituteParams`, its placement
  values, and its marker prompt identifiers, all read from that project's source.

Pattern 1 remains a recommendation for an author rather than implemented behaviour, and says so
where it is described. Patterns 2 and 4 were recommendations when this page was written; producer
repair, marker promotion and hook rendering are now performed, and the sections above were rewritten
when that became true rather than left to imply otherwise. Pattern 3 is reported, not applied: the
receipt tells you which variables have a closed domain, and expanding one is still your edit.

Measured on one 9,286-token RoleCall preset: 86 macros unsupported by SillyTavern before translation,
0 after, across 92 rewrites and 4 removals. The 4 removals are one instance of each pattern above.
