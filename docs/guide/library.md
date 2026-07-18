---
id: guide/library
title: Browse the Library
audience: user
summary: Filter pieces by kind on the Library's deck chips, switch between Grid, Show, List, and the deck-specific views, and stage one piece or many for a single send to the Workbench.
tags: [library, browse, decks, staging, views]
related: [guide/importing, guide/converting, guide/editing, reference/ui]
---

# Browse the Library

The Library is the shelves: every piece in your studio, sorted onto six decks by kind, shown however you want to look at them. This page covers browsing once your pieces are already there, filtering by deck, the views on offer, and staging one piece or a batch over to the Workbench. For how pieces land here in the first place, see Import a file.

## The short version

1. **Pick a deck.** Click a chip: Characters, Lorebooks, Personas, Sprite packs, Presets, or Regex sets. Each chip carries a live count.
2. **Pick a view.** Grid, Show, and List sit in the toolbar next to the chips on every deck; some decks add one more suited to what they hold. The art slider beside them resizes the cards live as you drag, in Grid, List, and Show.
3. **Stage what you want.** Click a piece (in Show, click its Stage for the Workbench button) to add it to the tray, accent ring, corner check. Click it again to drop it. Switch decks and the tray stays full, so a persona and two characters can travel together.
4. **Send it to the Workbench.** The send bar's button reads Send it to the Workbench for one piece, or Send all 3 to the Workbench for a batch. Right-click a single piece instead to send it without staging first, or to stage it for the Press.

![The Library](../../media/shot-library.png)

## The decks and their views

@fig views

Every deck chip shows even when it holds nothing, count 0, so you always see the full shape of your studio, not just whatever happens to have pieces in it right now. The status line at the bottom of the room says how much of that shape you're looking at, "characters · 4 of 12 pieces", the active deck's share of everything in your studio. An empty deck you can start from scratch, Lorebooks, Regex sets, Personas, Presets, offers a New button right on the shelf; Characters and Sprite packs are import-only, no blank start.

Grid, Show, and List behave the same on every deck: Grid is the wall of portrait cards, Show is one piece at a time with its own tagline and description, List is dense rows for a big collection. Shelf also runs everywhere, spine cards with a name-or-key search box, but Lorebooks and Regex sets get their own reason to reach for it: a Lorebook spine carries an on/off switch, Split, Copy, and drag-to-merge onto another book; a Regex set's Sets view adds its rule count, a computed one-line description of what the set does, and a quiet flag for rules it reads as slow. Turning a book or a set off is not cosmetic, an off one is skipped on export.

> Screenshot needed: the Lorebooks deck in Shelf view, one spine card showing its on/off switch, entry count, and the Split and Copy buttons.

## Staging and sending

Tapping a piece anywhere in the Library stages it, it doesn't open it. A staged piece wears an accent ring; a piece already open on the Workbench wears a quiet "on the workbench" tag instead, and tapping that one just repeats the tag back to you rather than toggling anything. The tray survives switching decks, so you can pick a character from one chip and a lorebook from another before you send anything.

The send bar only appears once something is staged. It carries the live count, "3 pieces staged", the Send button described above, and a Clear button that empties the tray without sending. Sending opens every staged piece as its own tab and, depending on your Workbench follow setting (changeable in Settings), may take you there right away.

You don't have to stage anything to move a single piece. Right-click it and choose Send to the Workbench to open it immediately, or Stage for the Press to queue it for export instead, a separate queue from this tray, covered in Convert a card.

## Tips

- A piece already open on the Workbench can't be re-staged. Tapping it just tells you it's already there.
- The staged tray persists across deck switches; it only empties when you send it or click Clear.
- Switch to a deck your current view doesn't support and the toolbar falls back to Grid, not whatever you had picked before.
- The Shelf view's search box narrows what's on screen. It doesn't touch the chip's count or the deck's actual total.
- Personas carry two toolbar buttons that both read Shelf. Go by the icon, not the label: the person icon opens the persona-tailored one, the bookcase icon opens the plain spine search.
- Characters and Sprite packs have no New button on an empty deck. Import is the only way in for those two.
