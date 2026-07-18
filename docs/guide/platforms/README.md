---
id: guide/platforms/README
title: Platforms
audience: user
summary: A short map of every platform Hoplight reads and writes today, what each one hands over, and which guide page to open first.
tags: [platforms, index, import, export, convert]
related: [guide/importing, guide/converting, guide/exporting, reference/formats/README]
---

# Platforms

Hoplight reads and writes files from ten platforms today. Each one gets its own page in this section, and every page has the same shape: what Hoplight reads from that platform, what a piece keeps on a same-app round trip, what drops when you convert it to a different app, how it looks on the Workbench, and a common-questions list at the end. Use the table below to find the page for your platform, then read that page for the full, honest story on your files.

@fig coverage

## The platforms

| Platform | Handles | Page |
| --- | --- | --- |
| Agnai | Characters, Lorebooks | [agnai.md](agnai.md) |
| Backyard | Characters | [backyard.md](backyard.md) |
| Chub | Characters, Lorebooks | [chub.md](chub.md) |
| Lumiverse | Characters, Personas, Regex sets | [lumiverse.md](lumiverse.md) |
| Marinara | Personas, Regex sets | [marinara.md](marinara.md) |
| NovelAI | Lorebooks | [novelai.md](novelai.md) |
| Pygmalion | Characters | [pygmalion.md](pygmalion.md) |
| RisuAI | Characters, Lorebooks, Regex sets | [risu.md](risu.md) |
| RoleCall | Characters, Lorebooks, Personas, Regex sets | [rolecall.md](rolecall.md) |
| SillyTavern | Characters, Lorebooks, Personas, Regex sets | [sillytavern.md](sillytavern.md) |

Handles lists the decks a platform's own files land on, Characters, Lorebooks, Personas, or Regex sets. A blank kind means that platform never shipped a file of that shape, not that Hoplight is missing something.

Two entries need a note. Backyard reads two different character shapes, the older flat JSON export and the modern `.byaf` archive, and both are covered on its one page. Marinara's own character cards are SillyTavern-shaped underneath, so they come and go through [the SillyTavern page](sillytavern.md) instead; Marinara's page covers only what is genuinely its own, regex scripts and personas.

## If your platform isn't listed

A handful of apps never shipped a portable file worth its own page. Character.AI's export tools and Crushon both hand you plain SillyTavern-shaped JSON, so drop the file in and Hoplight reads it through [the SillyTavern page](sillytavern.md) the same as a real SillyTavern card. That is also the default shape to reach for if you are not sure what your app produces: most thin hosts copy it.

For the exhaustive, generated list, every adapter Hoplight has today, run `bun run vaud formats`, or read [the format reference](../../reference/formats/README.md), the technical version of this page. It is built straight from the live adapter registry, so it never drifts from what the app can actually do.

## Common questions

- **Why do some platforms handle fewer kinds than others?** Because the platform itself does. Hoplight's adapters mirror what each app actually exports; a platform with no lorebook feature was never going to get a Lorebooks column.
- **Will I lose anything moving between two platforms?** Sometimes, and it is always spelled out. Each platform page has its own "what changes when you convert" table with the exact fields that stay and the ones that drop. [The converting guide](../converting.md) covers the general rule.
- **My app isn't SillyTavern, Chub, or anything above. Now what?** Try importing anyway, Hoplight recognizes a file by its shape, not its name, and most roleplay apps that don't get a page of their own still export a SillyTavern-shaped card underneath.

![Dropping a file into the Library](../../media/shot-import-drop.png)
