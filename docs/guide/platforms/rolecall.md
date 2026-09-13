---
id: guide/platforms/rolecall
title: RoleCall
audience: user
summary: Bringing RoleCall character cards and lorebooks into Hoplight and back out.
tags: [platform, rolecall, import, export, convert]
related: [guide/converting, guide/importing, reference/formats/rolecall]
---

# RoleCall

RoleCall is Vaudeville's own roleplay client, and its card carries more than a plain character sheet: a casting card of identity details, a full presentation layer (colors, background, spoilers), and a sprite pack ride alongside the usual fields. This page shows you how to bring RoleCall cards and lorebooks into Hoplight, edit them, and send them back out, whether to RoleCall again or to another app.

@fig journey

## What Hoplight reads

Hoplight reads the two file types RoleCall gives you:

- **Character cards**, as a `.png` (RoleCall tucks the card text inside the image) or as a plain `.json` file. Both hold a Character Card v2 or v3 with an extra block that carries the casting card, the presentation layer, and the sprite pack.
- **Lorebooks**, as a `.json` file (RoleCall's own export format).

To bring one in, drag the file onto the Library and drop it anywhere in the room. Hoplight reads the file and shows you a plain-words receipt: what it read, and what it kept. It tells a RoleCall character card apart from a RoleCall persona card even though the two are shaped almost identically, because it reads inside the file for what marks a card as a character, not the filename or a guess. For the full walkthrough, see [the importing guide](../importing.md).

![Importing a card](../../media/shot-import-drop.png)

## What comes across cleanly

Importing loses nothing. Hoplight keeps a complete copy of the original card, then lifts the parts you actually work with into fields you can see and edit directly:

- Name, tagline, and description
- Casting card details: full name, title, age, and pronouns
- Personality and scenario
- First message and any titled alternate greetings
- Example messages
- System prompt and post-history instructions
- Creator, creator notes, source link, and the public creator's note
- Tags, content rating (all hours, late night, or after dark), genre, and fandom
- Presentation: signature and gradient colors, a named color palette, a curated background, field order, and spoiler settings
- Depth-position prompt injections
- The sprite / expression pack
- An embedded lorebook, if the card carries one, with its entries, keywords, and placement

The card's picture is kept too, and Hoplight shows it as the piece's portrait. So after an import, everything that was in the card is still there: the fields above are ready to edit, and the rest is held safely in the background.

## What changes when you convert to another app

This is the honest part, and it is simple once you see the rule.

A same-app round-trip keeps everything. Import a RoleCall card, edit it, and export it back to RoleCall, and you get everything back, down to the byte, because Hoplight kept the original card and only re-wrote the fields you changed.

Converting to a different app is where things drop. Only the shared character crosses over. RoleCall's private extras, the casting card and the presentation layer built for RoleCall's own casting-card view, are left behind on purpose.

| Content | Back to RoleCall | To another app |
| --- | --- | --- |
| Core character: name, description, personality, scenario, greetings, example messages, system prompt, post-history instructions, notes, tags | Kept | Comes across, as far as that app can hold it |
| Casting card: full name, title, age, pronouns | Kept | Dropped |
| Presentation: signature and gradient colors, palette, background, field order, spoilers | Kept | Dropped |
| Content rating, genre, fandom | Kept | Dropped |
| Depth-position prompt injections | Kept | Comes across if that app supports depth injections |
| Sprite / expression pack | Kept | Comes across if that app has a place for extra art |
| Linked lorebook | Kept | Comes across if that app has lorebooks |
| Internal ids, and anything else RoleCall stores that has no shared home | Kept | Dropped |

"Another app" here means a genuinely different app such as SillyTavern, Agnai, Backyard, Risu, or Pygmalion. The drop is deliberate: Hoplight never blind-copies RoleCall's private casting and presentation layer into another app's file. Where the other app simply has fewer slots than RoleCall, whatever it cannot hold is dropped on its side, not yours.

## Editing on the Workbench

Send a piece from the Library to the Workbench and it opens as a tab. There you can edit the name, description, personality, scenario, first message, and example messages. When you save, Hoplight writes the whole card back, so the parts you did not touch stay exactly as they were.

![The Workbench](../../media/shot-workbench.png)

## Exporting back out

When a piece is ready to leave, stage it for the Press: right-click it and choose "Stage for the Press," or drop it in from the Press's own rail. The Press works only the pieces you staged, and each run exports to one target format that you pick.

Hoplight writes RoleCall cards as `.json`. RoleCall reads a `.json` card the same as a `.png` one, so it will import fine. If a piece carries a linked lorebook, it rides along with the character automatically. You can also ask for a plain `.txt` or `.md` copy when you just want to read the text. Choosing a different app as the target applies the drop story above.

![The Press](../../media/shot-press.png)

## Common questions

- **Will my card come back exactly as it was?** Yes, if you export it back to RoleCall. Same app in, same app out, nothing lost.
- **I imported a `.png`. Do I get a `.png` back?** Hoplight writes cards as `.json`. RoleCall reads a `.json` card the same as a picture, so it loads fine, you just get a file instead of an image.
- **Does my character's picture come with it?** Hoplight keeps the card art and shows it as the piece's portrait, and it holds onto the original file you imported.
- **What about my casting card and presentation colors?** They stay with the RoleCall card and are not copied into another app's file, because Hoplight does not move one app's private layer into another.
- **My lorebook was inside the card. Is it still there?** Yes. Hoplight pulls the embedded lorebook out so you can edit it on its own, and puts it back when you export to an app that supports lorebooks.
