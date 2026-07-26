---
id: reference/platforms/sillytavern/personas-and-data-bank
title: SillyTavern personas and Data Bank
audience: user
summary: Creation and portability model for SillyTavern user personas and retrieval documents, including prompt placement, locks, backups, attachment scopes, ingestion, and vectors.
tags: [platform, sillytavern, persona, data-bank, rag, attachments]
related: [reference/platforms/sillytavern/README, reference/entities/persona, reference/formats/sillytavern]
---

# SillyTavern personas and Data Bank

Personas and Data Bank documents both add user-controlled context, but they have different ownership and
portability. A persona is the user's identity in a chat. A Data Bank document is retrievable reference
material. Neither should be folded into a character card merely because it influenced a conversation.

Primary sources: [Personas](https://docs.sillytavern.app/usage/core-concepts/personas/) and
[Data Bank](https://docs.sillytavern.app/usage/core-concepts/data-bank/).

## Persona identity and description

A persona combines a display name, avatar, optional title, and optional description. The title is UI
metadata and does not enter the prompt. The description can contain traits, appearance, occupation, or role
context and may use supported macros.

Description position is saved per persona. It can be disabled, inserted through Story String or Prompt
Manager, placed above or below an existing Author's Note, or injected into chat history at a selected depth
and role. Position changes prompt priority and must remain an explicit field rather than being baked into
description text.

Converting a character to a persona copies the useful identity subset, chiefly name and description.
Scenario, personality, greetings, and other character fields do not become persona fields. Because
`{{user}}` and `{{char}}` reverse roles across the two concepts, SillyTavern warns before swapping macros
found during conversion.

## Persona connections and backups

SillyTavern may lock a persona to one chat, associate it with a character, or designate it as the default.
Chat lock wins for that chat; character connection selects a persona when opening that character; default
applies when no narrower connection does. A temporary selection can override the automatic choice until the
chat or page is reopened.

Past user messages retain the persona attribution they had when authored. Switching does not rewrite
history; persona sync is a separate explicit operation. Multiple persona connections per character can be
enabled and then require a selection.

Persona backup carries names, descriptions, and character connections, but the official documentation
states that images and chat connections are not included. Backups contain internal links and are not
designed as portable public persona packages. Hoplight's SillyTavern persona adapter currently imports one
selected persona from a backup while preserving the whole backup in escrow for same-format export.

## Data Bank documents and scopes

Data Bank stores text-representable documents for retrieval-augmented generation. Global attachments are
available to every chat, character attachments are available while that character participates, and chat
attachments are available only in the active chat. Character attachments are local installation data and
are not exported with the character card.

Sources include authored notepad text, local text or convertible files, readable web pages, video
transcripts, and extension-provided scrapers. Built-in file conversion accepts formats such as PDF text,
HTML, Markdown, ePUB, TXT, JSON, YAML, and source code when a plain-text representation can be extracted.
Raw unreadable binary files are rejected.

Message-level file attachments are related but are not formally part of Data Bank scope. A converter should
not infer a durable corpus entry from a file attached to one message.

## Vectorization and retrieval

Vector Storage splits documents into chunks, produces embeddings through a selected provider, and retrieves
chunks related to recent messages. Embeddings are model-specific; changing the embedding model or source
requires recalculation. Chunk size, overlap, score threshold, query-message count, and insertion limits
change what is retrieved and how much prompt space it consumes.

The vectors are generated indexes, not the authored document. SillyTavern stores them separately from the
source attachment. Hoplight should preserve source documents and authored retrieval settings where
supported, but should not treat cached vectors as portable semantic content.

Data Bank is not currently a dedicated Hoplight canonical entity. Kit can explain its behavior and avoid
false card-portability claims, but must not claim that importing a character also imports its Data Bank.
Future support should model documents, scope, and generated indexes separately.
