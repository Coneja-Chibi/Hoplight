---
id: reference/platforms/sillytavern/world-info
title: SillyTavern World Info authoring
audience: user
summary: Operational model of SillyTavern lorebooks, including book attachment, keyword and vector activation, entry selection, prompt placement, recursion, groups, outlets, and budgets.
tags: [platform, sillytavern, lorebook, world-info, triggers, prompt]
related: [reference/platforms/sillytavern/README, reference/formats/sillytavern, reference/entities/lorebook]
---

# SillyTavern World Info authoring

World Info is SillyTavern's conditional knowledge and prompt-injection system. A book contains entries,
each with content plus rules that decide when, where, and whether that content enters the prompt. Books
can model setting lore, modular character facts, memories, instructions, or random events.

Primary source: [World Info](https://docs.sillytavern.app/usage/core-concepts/worldinfo/).

## Books, links, and entry identity

World Info may be globally active, linked to a character, linked to a chat, or embedded in a compatible
character card. These scopes determine availability, not the activation of every entry. A character link
by book name and an embedded character book are distinct storage relationships.

An entry has an author-facing title or memo, content sent to the model, an enabled state, and ordering
metadata. The memo is organizational and is not normally part of activation or prompt content. Authors
should keep stable entry identity separate from keywords because keys may change as a world evolves.

Character filters can include or exclude named characters or tags. Generation-trigger filters can limit
activation to Normal, Continue, Impersonate, Swipe, Regenerate, or Quiet requests. Additional matching
sources can scan character description, personality, scenario, persona description, Character's Note, or
creator notes in addition to recent chat text.

## Activation and selection

Constant entries activate without keywords. Keyword entries use primary keys and optional secondary keys.
Selective logic controls whether secondary keys require any, all, none, or not-all matches. Case sensitivity
and whole-word matching can be global defaults with entry-level overrides. Regular-expression keys and
probability add further selection behavior.

Probability is evaluated after an entry otherwise qualifies. A value of 100 always passes, while zero
effectively prevents insertion. Inclusion groups resolve competition among entries sharing a group name.
Weighted selection uses group weight; prioritized inclusion chooses the qualifying entry with the highest
order; group scoring can prefer entries that matched more keys before weight or priority decides.

Vectorized entries replace the keyword qualification step with embedding similarity, but they still obey
probability, groups, character filters, trigger filters, and token budget. A vector marker does not disable
ordinary keyword behavior if keys remain present. Vector retrieval is nondeterministic relative to explicit
keys and depends on using compatible embedding models.

## Placement, order, and prompt budget

Insertion position determines where activated content enters the prompt. Positions include areas before or
after character definitions or examples, Author's Note boundaries, and in-chat depth with a selected
message role. Order participates in sorting and group priority, while depth controls recency for in-chat
placement. These are separate axes and should not be collapsed.

Outlet entries are withheld until a matching `{{outlet::Name}}` macro is expanded in a compatible prompt
field. Entries sharing the case-sensitive outlet name are combined by insertion order. Outlets cannot be
nested, cannot expand inside World Info content, and are unavailable in early-processed character fields or
the Author's Note editor.

The World Info budget caps activated entry tokens as an absolute value or percentage of available context.
Constant and higher-priority entries consume space first. Scan depth controls how many recent messages
contribute keys. Min Activations may scan farther back until enough entries qualify, while Max Depth limits
that extended search. Budget exhaustion prevents additional insertion even when keys match.

## Recursion, timing, and automation

Recursive scanning lets one activated entry's content trigger another. Per-entry controls can prevent an
entry from being recursively activated, stop it from triggering further entries, or delay it until a
specific recursion level. Max Recursion Steps limits scan passes; Min Activations is mutually exclusive with
that setting. Unbounded recursion is still bounded by prompt budget, but authors should avoid accidental
keyword cycles.

Timed effects add chat-local state. Sticky retains an entry for a number of messages, cooldown blocks
reactivation after use, and delay requires enough chat messages before activation. Editing an entry clears
its active timed effect. Branches inherit parent state, while swiping or deleting without advancing the chat
can remove effects.

Automation ID can connect an activated entry to a Quick Reply or STscript procedure. That relationship
causes executable platform behavior and is not ordinary lorebook prose. Hoplight may preserve the identifier
as sealed metadata, but it must not run the linked script.

## Interoperability rules

The portable character-book schema and SillyTavern's standalone World Info file use related but different
wire shapes. SillyTavern-specific settings may live in extension fields. Hoplight maps supported semantics
into canonical lorebook entries and escrows the complete original for same-format restoration.

Cross-format targets may lack recursion controls, inclusion groups, timed effects, vector markers, outlets,
generation triggers, or matching-source flags. Conversion reports must name those losses rather than
flattening them silently. The current supported enum coding and field mapping are documented in
[SillyTavern format](../../formats/sillytavern.md).
