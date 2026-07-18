---
id: guide/platforms/lumiverse
title: Lumiverse
audience: user
summary: Bringing Lumiverse character cards, expression archives, personas, and regex scripts into Hoplight and back out.
tags: [platform, lumiverse, import, export, convert]
related: [guide/converting, guide/importing, reference/formats/lumiverse]
---

# Lumiverse

Lumiverse's character cards ride the same file shape SillyTavern cards use, JSON with a `data` block, or a PNG with the card tucked inside the picture, so most of what you already know about a card carries over. Lumiverse adds a few things of its own on top of that: expression images, alternate faces and alternate text, a persona object, and its own regex export file. This page shows you how Hoplight reads all of that, what survives an edit, and what happens if you convert a Lumiverse card to a different app.

@fig journey

## What Hoplight reads

Hoplight reads four things that come out of Lumiverse:

- **Character cards**, as a `.png` or a `.json` file, the same two shapes a SillyTavern card comes in.
- **A Lumiverse archive**, as a `.charx` file: the card plus its expression images, alternate faces, and any regex scripts baked into the export, packed as separate files inside the archive instead of stuffed inline.
- **A persona**, as a `.json` dump of one account persona object: name, title, description, and pronouns.
- **A set of regex scripts**, as a `.json` file Lumiverse exports on its own, separate from any character card.

To bring one in, drag the file onto the Library and drop it anywhere in the room. Hoplight reads the file and shows you a plain-words receipt: what it read, and what it kept. It tells a Lumiverse card apart from a plain SillyTavern card by looking for a handful of Lumiverse-only keys tucked inside the card's data, not by the file's name, so renaming a card does not confuse it. For the full walkthrough, see [the importing guide](../importing.md).

![Importing a card](../../media/shot-import-drop.png)

## What comes across cleanly

Importing loses nothing. Hoplight keeps a complete copy of the original card (and, for an archive, every file inside it), then lifts the parts you actually work with into fields you can see and edit directly:

- Name and description
- Personality and scenario
- First message and any alternate greetings
- Example messages
- System prompt and post-history instructions
- Creator name, creator notes, and tags
- Talkativeness and the linked world name
- An embedded worldbook, with its entries, keywords, and placement
- Portrait art, and any expression images the archive carried
- Alternate versions of the description, personality, scenario, or face, as variants on the piece

An expression image only becomes an editable piece of art when Hoplight can actually find its bytes, already embedded inline, or sitting in the same archive; a reference to a file that isn't there stays as plain text instead, and Hoplight never guesses at it.

The card's picture is kept too, and Hoplight shows it as the piece's portrait. So after an import, everything that was in the card is still there: the fields above are ready to edit, and the rest is held safely in the background.

## What changes when you convert to another app

This is the honest part, and it is simple once you see the rule.

A same-app round-trip keeps everything. Import a Lumiverse card as `.json`, edit it, and export it back to Lumiverse, and every field comes back unchanged, because Hoplight kept the original card and only re-wrote the fields you changed. Import a Lumiverse archive (`.charx`) and a round-trip keeps every image, alternate face, and script too, though Hoplight may re-file them to different paths inside the archive on the way back out. Lumiverse doesn't care where a file sits: it reads the archive's own manifest, so the card still opens fine. A plain `.json` card has no internal layout to shift, so it comes back closer to the original than an archive does.

Converting to a different app is where things drop. Only the shared character crosses over. Lumiverse's private extras, the settings that only mean something inside Lumiverse, are left behind on purpose.

| Content | Back to Lumiverse | To another app |
| --- | --- | --- |
| Core character: name, description, personality, scenario, greetings, example messages, system prompt, notes, tags, talkativeness, linked world | Kept | Comes across, as far as that app can hold it |
| Embedded worldbook | Kept | Comes across if that app has worldbooks |
| Portrait art and resolved expression images | Kept | Comes across if that app can hold CCv3-style images |
| Alternate faces and alternate text (variants) | Kept | Dropped, for now: none of the other apps Hoplight writes to read a piece's variants yet |
| Regex scripts baked into the archive | Kept | Dropped |
| TTS voice reference, image-gen LoRA hint, attached world-book and databank ids, alternate character name | Kept | Dropped |
| Internal ids, saved layout | Kept | Dropped |

"Another app" here means a genuinely different app such as SillyTavern, Agnai, Backyard, RoleCall, or Risu. The drop is deliberate: Hoplight never blind-copies one app's private settings or scripts into another app's file. Your alternate faces and extra text stay with the piece as variants, but they only round-trip back to Lumiverse today, since none of the other apps Hoplight writes to read a piece's variants yet. Regex scripts baked into the archive stay put too, which is where they actually run anyway. And where the other app simply has fewer slots than Lumiverse, whatever it cannot hold is dropped on its side, not yours.

## Editing on the Workbench

Send a piece from the Library to the Workbench and it opens as a tab. There you can edit the name, description, personality, scenario, first message, and example messages, the same as any card.

The portrait card carries a variant strip: a Base tile plus one tile for each alternate version the card has. This is where Lumiverse's alternate fields and alternate faces land. Click a tile to edit that variant's own text or art, or add a new one with the `+`. If the card carries expression images, the portrait card's "Manage Sprites" button opens the pack editor for them.

Everything else Lumiverse wrote sits alongside the core fields, tagged Lumiverse: an alternate character name, an attached image-gen LoRA hint, a TTS voice reference, attached world-book and databank ids (read-only, a full lore editor is later work), and a catch-all for anything else. When you save, Hoplight writes the whole card back, so the parts you did not touch stay exactly as they were.

![The Workbench](../../media/shot-workbench.png)

## Exporting back out

When a piece is ready to leave, stage it for the Press: right-click it and choose "Stage for the Press," or drop it in from the Press's own rail. The Press works only the pieces you staged, and each run exports to one target format that you pick.

Exporting back to Lumiverse keeps whichever container the card came in: a plain `.json` card comes back as `.json`, an archive comes back as `.charx` with your edited images, faces, and scripts packed back in. You can ask for the other container directly instead. If you imported an archive and ask for `.json`, and that would leave files stranded outside the card with nowhere to live, Hoplight refuses the export rather than silently drop them; ask for `.charx` instead. That check is cautious, so it can still trip even after you've removed every field that pointed at those files. You can also ask for a plain `.txt` or `.md` copy when the output is JSON; a `.charx` archive doesn't offer that, since it isn't text. Choosing a different app as the target applies the drop story above.

![The Press](../../media/shot-press.png)

## Common questions

- **Will my card come back exactly as it was?** Yes, if you export it back to Lumiverse unedited. A plain `.json` round-trip returns every field unchanged. An archive round-trip keeps every image and script with the same bytes, though the paths inside the archive can be regenerated rather than preserved verbatim, which Lumiverse doesn't mind.
- **I imported an archive. Do I get an archive back?** Yes, by default, `.charx` with everything packed back in. Ask for `.json` if you want the flat card instead, and Hoplight will refuse rather than drop files that only exist inside the archive.
- **Does my character's picture and expression images come with it?** Hoplight keeps the card art and shows it as the piece's portrait, and any expression images it could resolve to real bytes come across as editable art too.
- **My alternate faces and extra text were inside the card. Are they still there?** Yes. Hoplight folds Lumiverse's alternate fields and alternate faces into variants on the piece, shown as tiles on the portrait card, and folds them back into the same shape on export to Lumiverse.
- **What about my regex scripts?** Scripts baked into an archive stay with the Lumiverse card and are not copied into another app's file. A standalone Lumiverse regex export file is its own piece: import and export it on its own, the same way as a character card.
- **I have a Lumiverse persona, not a character card. Does that work too?** Yes. Drag the persona's `.json` dump onto the Library like anything else. Hoplight reads the name, title, description, and the pronoun set, and keeps everything else on the twin, so exporting back to Lumiverse returns the object untouched apart from what you edited.
