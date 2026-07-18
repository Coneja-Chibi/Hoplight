---
id: guide/regex
title: Edit a regex set
audience: user
summary: Write find-and-replace rules into a set, choose where and in what order each one runs, and check what a rule actually does before you save it.
tags: [regex, rules, find-replace, order, workbench]
related: [guide/editing, guide/library, reference/concepts/regex-editor, guide/converting]
---

# Edit a regex set

A regex set is a list of find-and-replace rules that run on your chat text wherever you point them, one after another, top to bottom. This page covers writing a rule three different ways, choosing where and in what order it runs, and checking what it actually does before you save it.

## The short version

1. **Open or start a set.** In the Library, click the Regex sets chip, then switch to the Sets view for a rule count and a one-line read of each set. Open an existing set, or click + New set · or drop a file to start blank on the Workbench.
2. **Add a rule.** Click + New rule in the Rules list. Pick a starter recipe (37 of them, each with a real Before/After) or Start blank; either way it opens ready to edit.
3. **Write the find and the replace.** Pick a mode: Guided, Plain words, or Pattern. Fill in Find and Replace with; leave Replace with empty to remove the match outright.
4. **Pick where it runs.** Under Where it runs, turn on the pipeline stages this rule should act on: user input, model output, display, and so on.
5. **Try it, then save.** Quick try, beside the rule, runs it alone on a sample line. Open the full test bench to watch the whole set run as a chain. Then Save (or Ctrl/Cmd+S).

![Regex editor](../../media/shot-regex.png)

## Three ways to write a rule

Every rule is one find pattern, one replacement, and a list of phases. The three modes are just different views onto those same fields, so switching between them never loses your work.

**Guided** never shows you the pattern. It asks three questions, one at a time: what should it catch, what should it become, where should it run. You type a few real examples and it builds the pattern from those, then shows one honest thing your own examples miss, with the line "It only knows words you showed it." If you want the actual pattern, the escape link at the bottom (I know patterns, take me to Pattern mode) hands you off.

**Plain words** has two sub-modes. Match these words takes a comma list plus a tune grid: But never these, Optional endings, Only when followed by, Never when followed by, and toggles for Whole words only and Match case exactly. It shows the pattern it built in plain English, with real hit and near-miss chips underneath. Match by example takes 2-5 example phrases and detects the shared structure on its own.

**Pattern** is the raw Find box and flags box, with a live "In words:" reading underneath, so you can see what a handwritten pattern says even when you didn't build it here. When a pattern uses forms the reader can't describe, it says so instead of guessing.

Replace with sits in its own card below Find: leave it empty and the rule removes the match. Where it runs is a row of phase pills; the pills you see depend on the platform picked in Write for, at the top of the editor, and a phase already set under a different platform still shows, but dashed, so it reads as foreign rather than silently vanishing.

Fine print, folded under the main cards, holds the rest: a depth window (only messages deeper or shallower than a number), Run again when a message is edited, Macros in the find, Only for these characters, Replace only the first match, Draw over the text instead of changing it, and Only run after another rule. That last one is really about order, so it's covered below.

## Order, and how to check it

@fig chain

Rules run top to bottom, in the order they're listed in the Rules list, and each one works on the text as the rule before it left it, not the original. A rule near the bottom always sees every earlier rule's edits already applied.

That has a real failure mode: two rules can compete for the same text, and the earlier one wins outright. Say one rule strips `*asterisked actions*` and a later rule turns `*word*` into an italic tag; if the strip rule runs first, the later rule finds nothing left to catch, not because either rule is written wrong, but because of where it sits in the list.

You don't have to spot that by eye. Open the full check, from the Health card beside any rule, and it runs the real chain against execution-verified examples for every rule; a rule that provably never fires because an earlier one already got there comes back flagged, in its own words: it never fires on its own examples, the earlier rule runs first and changes the text. Exact duplicates get a one-click Fix: switch it off. A shadowed rule doesn't, on purpose: reordering is a judgment call the check leaves to you.

Fine print's Only run after another rule sequences two rules without moving either one: pick a rule already in the set and whether it fired or did not fire, and this rule only runs on that outcome.

The Rules list itself has no drag-to-reorder yet. New rules and imported rules always land at the bottom; Duplicate places its copy directly after the one you started from, which is the nearest thing to inserting at a point. If a rule genuinely needs to run earlier, delete it and add it again where you want it.

Quick try, beside every rule, forces that one rule on and runs it alone against a sample line, highlighting the match and showing the result. Open the full test bench (same card) to run the whole set together instead: one step per rule, in order, each one applied with a word diff and colored capture chips, or skipped with the plain reason why, ending in What comes out, the text after every rule has had its turn.

> Screenshot needed: the test bench's Try text tab, showing the numbered rule steps and the final "What comes out" line.

The test bench's Import preview tab is worth knowing even if you're not building a set from scratch: drop a rival regex file in and it checks each of that file's rules against your own sample before anything is imported. It reads SillyTavern-dialect regex files today; the other dialects aren't wired to file detection yet. The bench also carries a working Escape a literal tool, paste plain text and get back a pattern that matches it exactly, ready to copy. The same-named button next to Find, in Pattern mode, is a placeholder for now.

## Tips

- Start from a recipe. + New rule opens 37 starter recipes grouped Cleanup, Guardrails, Formatting, Style, Compatibility, and Roleplay; every Before/After shown is computed by the same engine that runs your set, not written by hand.
- An empty Replace with removes the match. That's the field's plain meaning.
- Two rules can shadow each other without either being wrong on its own. Let the full check find it instead of chasing it by eye.
- Only run after another rule sequences two rules without moving either one; reach for it before you reach for a workaround.
- The Rules list has no drag-to-reorder yet. Add rules in the order you want them to run, and use Duplicate, which inserts right after the original, when you need to place one at a specific point.
