---
id: guide/README
title: User guide
audience: user
summary: A map of Hoplight's rooms and links to every guide page, setup, importing, browsing, editing, personas, lorebooks, regex sets, converting, exporting, and platform notes.
tags: [guide, index, rooms, dock, platforms]
related: [guide/getting-started, reference/ui, reference/architecture, reference/formats/README]
---

# User guide

Hoplight is the forge for AI-roleplay content: convert, edit, and ship any format. This page is the
index for the user guide, the pages that walk through using the app itself, as opposed to its file
formats or internals (that's the [reference docs](../reference/README.md)). New here? The first row of
the table below gets you through setup and your first import; everything after it reads fine in
whatever order matches what you're doing that day.

## The rooms

Hoplight is a handful of rooms behind one dock. [Get started](getting-started.md) covers the dock in
full; this is the fast map.

| Room | What it's for |
| --- | --- |
| The Workbench | Editing. Every kind of piece opens here as a tab. It is also home: every boot after your first lands here, or wherever you last were. |
| The Library | Browsing. Six decks, deck chips with live counts, a few view modes, and the door your files come in through. |
| The Press | Shipping out. Works only a staged queue: stage a piece, pick one target platform, run the press, download the bundle. |
| CSS Workshop | Restyling the studio itself. Every color in it is a token you can repaint. |
| The Company | Not open yet. A dimmed tile below the divider. |
| Settings | Pinned in the dock's foot, always reachable. Theme, accent, home app, first deck, publish targets, and Workbench follow behavior all live here. |

## The pages

| Page | What it walks through |
| --- | --- |
| [Get started](getting-started.md) | **Start here.** Install, the four-question setup wizard, and your first import. |
| [Import a file](importing.md) | Bring a card, lorebook, persona, or regex set into the Library, and read the receipt before anything is written. |
| [Browse the Library](library.md) | Filter by deck, switch between Grid, Show, and List, and stage one piece or many for a single send to the Workbench. |
| [Edit a piece](editing.md) | Open a piece on the Workbench, change it through Grid or Steps, and save your draft. |
| [Create and manage personas](personas.md) | Build a persona from identity and sections or flat text, and set where it injects. |
| [Build a lorebook](lorebooks.md) | Add entries, give each one its trigger keywords, and place it in the assembled prompt. |
| [Edit a regex set](regex.md) | Write find-and-replace rules, choose where and in what order each one runs, and check what a rule does before you save it. |
| [Convert a card](converting.md) | Take a card you have in one app's format and ship it out in another, and see what crosses and what stays behind. |
| [Export a piece](exporting.md) | Send a piece out through the editor's Export button, or a staged batch through the Press. |

## Platform notes

Every supported platform gets its own page: what Hoplight reads, what comes across cleanly, and what is
dropped on purpose when you convert to a different app. Read [Convert a card](converting.md) first for
the general rule; come here for the platform-specific detail.

| Platform | Covers |
| --- | --- |
| [Agnai](platforms/agnai.md) | Character JSON and memory books. |
| [Backyard](platforms/backyard.md) | Both card shapes, the older flat JSON export and the modern .byaf archive. |
| [Chub](platforms/chub.md) | Character cards and lorebooks. |
| [Lumiverse](platforms/lumiverse.md) | Character cards, expression archives, personas, and regex scripts. |
| [Marinara](platforms/marinara.md) | Regex scripts and personas. |
| [NovelAI](platforms/novelai.md) | Lorebooks. |
| [Pygmalion](platforms/pygmalion.md) | Classic flat character JSON. |
| [RisuAI](platforms/risu.md) | .charx cards, lorebooks, and regex scripts. |
| [RoleCall](platforms/rolecall.md) | Character cards and lorebooks. |
| [SillyTavern](platforms/sillytavern.md) | Character cards and worldbooks. |
