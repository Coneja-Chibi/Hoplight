---
id: reference/entities/htmldoc
title: Drawing entity
audience: dev
summary: The canonical HTML-document entity - a page the agent draws, kept as a studio piece so it can be named, edited, grouped and reopened; and the seal that renders it without ever running it.
tags: [entity, htmldoc, canonical, fields, untrusted]
related: [reference/architecture, reference/ui, reference/security/safe-rendering, reference/security/untrusted-content]
---

# Drawing entity

A `CanonicalHtmlDoc` is `CanonicalEntity<"htmldoc", HtmlDocBody>`: the stable canonical wrapper (see
[architecture.md](../architecture.md)) around an HTML document somebody - usually the agent - wrote to
be looked at. It stores under `studio/htmldoc/<id>.json`, the same hub-and-spoke shape as the lorebook,
persona and regex entities. `src/entities/htmldoc/schema.ts` is the source of truth for the types.

## Why it is an entity at all

A wireframe that lives in a chat reply cannot be renamed, filed, reopened tomorrow or edited. Every one
of those verbs already exists in this app and every one of them acts on a PIECE, so the whole feature is
the kind: once a drawing is a piece it inherits create, read, save, delete, duplicate, collections and
the Library without a single new tool beyond `studio_htmldoc_create`.

The alternative - a bespoke API per verb over a transient value - would have been seven tools that each
lose their content on reload.

## It is untrusted content, and storing it changes nothing

The `html` field is model output. Nothing in this repo evaluates it, at any point, on any surface.

It is stored **verbatim and unsanitised**. Cleaning at rest would be the wrong boundary twice over: the
file would differ from what was written, so a person editing their own drawing would watch it get
mangled, and a second sanitiser would exist that could drift from the one that actually renders.

The seal is at the point of DRAWING, which is the only place it can be enforced. Every surface that
shows a drawing uses the same `SealedHtmlPreview`:

- a `srcdoc` iframe with `sandbox=""` - no scripts, never `allow-same-origin`
- a CSP of `default-src 'none'; script-src 'none'; connect-src 'none'; img-src data: blob:; style-src 'unsafe-inline'`
- DOMPurify over the markup, with `script`, `iframe`, `object`, `embed`, `form`, `input`, `button`,
  `textarea`, `select`, `link`, `meta` and `base` forbidden - the list lives in
  `core/render/seal-policy.ts` so Kit can read the same policy without a DOM

So: **all CSS renders**, images work as `data:` URIs, and JavaScript never runs while no http(s) image,
font, stylesheet or fetch ever resolves. That is a static-drawing surface by construction. See
[security/safe-rendering.md](../security/safe-rendering.md).

A whole document keeps its design: sanitizing returns the parsed BODY, so a `<head><style>` block
would go into the bin with the head. Every style block is lifted out first and re-injected into the
frame's own `<style>`, wherever in the document it was written. Form controls are the one thing an
author has to design around - a `<button>` keeps its label as bare text and loses its shape, so draw
one as a styled `div` or `span`. `html_will_draw` answers that question about any markup before it
is saved.

Three surfaces draw a piece and all three are that one component at different sizes - the agent
transcript's inline preview, the HTML View tab, and the Workbench editor's live pane. One boundary,
three sizes, nothing to drift.

## Where it is used

- **Workbench** - the editor: source on the left, the drawing on the right, live as you type. Autosave
  and the conflict bar behave as they do for any piece. The divider between them drags (arrow keys and
  Home/End work on it, double-click recentres) and the source hides outright, since a drawing being
  looked at does not need half the room spent on markup; both are remembered in settings.
- **Kit, as a design source** - `regex_from_drawing` turns a saved drawing into the replacement half of
  a regex rule, so the rich thing is designed once here and rendered from compact model output by a
  script. See [kit/tools.md](../kit/tools.md).
- **HTML View** - a `catalogOnly` app that draws one at full size. Opened by id from the Library, or by
  handoff from an ```html block in a reply. Both it and the editor pane can go fullscreen (the
  browser's own where the engine grants it, an overlay over the app where it does not; Escape leaves
  either), and both pass `fill` so the drawing takes the whole room rather than the inline ceiling.
- **Kit** - `studio_htmldoc_create` composes one as a preview-only draft; the Gate turns it into a file.
  `htmldoc.document.update` is the edit half, found by search ("edit the wireframe", "fix the
  layout"): a patch of markup, name, summary, tags or notes, previewed as changes and applied at the
  same Gate. It shipped late, and its absence was a real dead end - create-only apply correctly
  refuses an occupied id, so a model that had written a better version of a drawing had nowhere to
  put it. Markup the seal would strip is a warning on the draft, never a refusal: what somebody may
  draw is their call at the Gate, not the capability's.

## Size ceiling

`HTMLDOC_CAP` is 200,000 characters, matching the sealed preview's own ceiling. A longer document is one
whose end could never be drawn, so the decoder refuses it rather than storing something that renders
three quarters of the way and stops. The editor says so while the text is still editable rather than as
a failed save.

## Fields

The table below is pasted verbatim from
[docs/generated/fields.htmldoc.md](../../generated/fields.htmldoc.md); improve a schema doc comment
and regenerate rather than editing a cell here.


### `HtmlDocBody`

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `name` | `string` | - | What this drawing is called. Every other kind titles itself from its body; so does this. |
| `html` | `string` | - | The document, as authored. Kept verbatim - NOT sanitised on the way in. Cleaning at rest would be the wrong boundary twice over: it would make the stored file differ from what was written, so a person editing it sees their own text mangled, and it would put a second sanitiser in the app that could drift from the one that actually renders. The seal is at the point of DRAWING, which is the only place it can be enforced, so that is where it lives. |
| `summary?` | `string` | - | A sentence about what this draws, for a list that would otherwise be a wall of filenames. |
| `tags?` | `string[]` | - | Free-form labels, so a person can group drawings without a folder. |
| `notes?` | `string` | - | The author's own notes, same shape every other entity uses. |


## See also

- [architecture.md](../architecture.md): the canonical model and the hub-and-spoke entity shape.
- [ui.md](../ui.md): the Workbench editor, HTML View, and the agent transcript's preview.
- [security/safe-rendering.md](../security/safe-rendering.md): the seal every drawing is drawn through.
