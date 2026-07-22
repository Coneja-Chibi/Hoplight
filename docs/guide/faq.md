---
id: guide/faq
title: Frequently asked questions
audience: user
summary: Straight answers on where your files live, what a convert actually keeps or drops, which apps Hoplight reads and writes, and whether converting or editing a card can damage it.
tags: [faq, privacy, convert, formats]
related: [guide/converting, guide/importing, guide/exporting, reference/architecture]
---

# Frequently asked questions

Four questions come up more than any others: where your files go, what actually survives a convert, which apps Hoplight speaks, and whether any of this can damage a card you care about. Short answers first, then the full one behind each.

## The short version

1. **Is my content private?** Yes. Hoplight runs a local server bound to your own machine, your pieces are saved as plain JSON files in a folder on your disk, and there is no account, no cloud, and no telemetry.
2. **What converts?** The plain card, name, description, personality, scenario, greetings, example messages, and a lorebook's entries, keys, and placement. An app's private extras, its own scripts, layout, and ids, only survive a round trip back to that same app.
3. **Which apps are supported?** SillyTavern, RoleCall, RisuAI, Backyard/Faraday, Agnai, NovelAI, Pygmalion, Lumiverse, Marinara, and Chub, though not every app carries every kind of piece.
4. **Can a convert damage my card?** No. A convert only ever writes a new file; your original is kept untouched, and every export shows you exactly what will and will not travel before you commit to it.

## Is my content private?

Yes. `hoplight ui` starts a local server bound to `127.0.0.1`, loopback only, so nothing outside your own machine can reach it. Your pieces are stored as plain JSON, one file per piece, in a studio folder on your disk (`Documents/Hoplight Studio` by default, unless you point it somewhere else). No one at Hoplight can read them.

There is no sign-up and no account anywhere in the app. Every request the interface makes goes to that same local server, not to some service on the internet, and there is no telemetry: nothing about what you open, edit, or convert is collected or sent anywhere.

Importing does not trust a file just because it opened cleanly, either. A card that carries trigger scripts or regex has those scripts saved as text, never run, and a card that asks for deep access has that request refused outright, with the receipt saying so plainly. Uploads parse through the same fail-closed readers as the CLI, with caps against a zip bomb, so a bad or hostile file cannot exploit its way further than "we couldn't read this."

## What converts, and what stays behind?

Every convert goes through one shared model in the middle: your file is read into it, then written back out in the target app's shape. Nothing goes directly from one app's file to another's.

**Back to the app you started in, everything survives.** Hoplight keeps your original file, so a same-app round trip is lossless. Anything the shared model has no slot for, an app's private extensions, layout, or ids, comes straight back from that saved copy.

**Into a different app, only the shared part crosses.** Name, description, personality, scenario, greetings, and example messages travel to any character-capable app. A lorebook's entries, keys, and placement travel to any lorebook-capable one. What does not travel is anything the target has no place for: one app's trigger scripts, regex, virtual script, and backdrop HTML are dropped when the target cannot run them, on purpose, never quietly copied in as inert baggage. Risu (.charx) is the one target that keeps the full rule pack; plainer apps like Agnai or legacy Backyard keep the words, not the machinery.

You do not have to guess which case you are in. The Export button on a character's editor opens the honesty view first: pick a platform and it lists what keeps, what carries with a note, and what drops, line by line, before anything downloads. Staging a batch for the Press shows a readiness line instead, how many of the target's fields are actually filled in.

![What will drop](../media/shot-export-honesty.png)

See [Convert a card](converting.md) for the full walkthrough, including how a staged character's linked lorebooks ride along as a bundle.

## Which apps are supported?

@fig support

Nine apps today, covering four kinds of piece: character, lorebook, persona, and regex set. Not every app made all four kinds real, so the table above is the honest ground truth, not a wishlist.

A few notes worth knowing:

- **Chub** has no wire format of its own. A Chub download is a SillyTavern-shaped Character Card v2/v3 with one extra block, `extensions.chub`, riding inside it, so it shares SillyTavern's row above.
- **NovelAI** has no character-card concept; its "card" is a lorebook, so that is the only kind it reads or writes.
- **Marinara** ships regex scripts and personas only, no character or lorebook file.
- **Hoplight's own native JSON** is the local storage format your whole studio folder is already written in, one file per piece, every kind. It is lossless by construction and it is not in the table above, because it is not something you convert to, it is what a piece already is before you convert it anywhere.

Formats are drop-in folders under the hood, so this list can grow without touching any format already on it.

## Can a convert damage my card?

No. The worst a convert does is leave something out, and it tells you so before you export.

**Your original is never overwritten by a convert or an import.** The Library keeps the file you brought in, whole, alongside the piece. Drop the same file in twice and you get two pieces, not one refreshed on top of the other; a -2 lands on the second one's id. If you want to update a piece you already have, you edit and save it on the Workbench, that is the only path that overwrites, and it does so on purpose.

**Editing does not touch what you did not open.** The character editor saves the whole piece back on Save, so fields you never touched, escrow, behavior, media, round-trip byte-identical. Saving is explicit only: the Save button or Ctrl+S, with a dirty flag and a warning if you try to close a tab with unsaved changes.

**A slightly broken lorebook is healed on import, not thrown out.** A missing name or an oddly shaped entry gets quietly repaired on the way in, and the receipt says exactly what it fixed.

**Cross-app conversion drops fields, it does not corrupt them.** When a target format has no slot for something, that field is left out of the new file; the rest of the card exports fine, and the honesty view names the exact line before you click past it. Nothing is silently mangled or half-written.

Your original file, sitting untouched in the Library, is the actual safety net underneath all of this. If a convert somewhere ever surprised you, the source you started from is still exactly where you left it.

![Importing a card](../media/shot-import-drop.png)

## Tips

- Prefer a same-app round trip when you can. Converting back to the app you started in keeps everything, because your original file is kept.
- Read the honesty view or the readiness line before you export. It tells you the target's exact keep, note, and drop lines, not a guess.
- Your studio folder is plain JSON, one file per piece, readable in any text editor and easy to back up like any other folder.
- If scripts and rules matter, pick a target that keeps them. Risu (.charx) carries the full rule pack; a leaner format keeps the words, not the machinery.
- A lorebook whose entries have no keywords will never fire, on any platform. The Press flags that in red before you export, so fix the keywords first.
