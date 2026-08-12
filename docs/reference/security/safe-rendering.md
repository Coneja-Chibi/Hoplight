---
id: reference/security/safe-rendering
title: Safe rendering: sanitizing card HTML and CSS
audience: dev
summary: Specifies exactly what DOMPurify allows and strips on the two surfaces that render card-authored HTML and CSS, the sealed iframe and scoped CSP the riskier surface adds on top, and what is proven only at the string level versus what is not measured at all.
tags: [security, dompurify, xss, sanitization, csp, iframe-sandbox, html, css]
related: [reference/concepts/safe-rendering]
---

# Safe rendering: sanitizing card HTML and CSS

This page is the sanitizer spec of record for card-authored markup: the complete allow list and
forbid list for both places the app turns untrusted HTML or CSS into DOM. `docs/reference/concepts/safe-rendering.md`
covers the same prose-field pipeline from the UX side (the render toggle, the leaving-gate for
links, `RenderBox`) and is still accurate for that; this page does not repeat it. What that concept
page does not cover is the second, higher-risk surface: `behavior.backgroundHTML` and
`behavior.backgroundCSS`, a Risu card feature that carries full author-supplied HTML and CSS, not
prose. The two surfaces run different sanitizer configurations because they sit behind different
boundaries. That difference, and which parts of it are actually verified, is the subject of this
page.

## Where card HTML and CSS enter the app

`CharacterBehavior` carries two optional verbatim strings: `backgroundHTML` and `backgroundCSS`
(`src/entities/character/schema.ts:303-305`). The Risu field mapper reads and writes them
unchanged, no transform in either direction (`src/formats/risu/risu-fields.ts:119-120` on import,
`:220-221` on export). The module's own header comment is explicit that this is the executable
behavior surface, "NOT here and NOT original-forever," carried on the raw twin and flagged at
import via `hasExecutableContent` until a dedicated behavior entity models it
(`src/formats/risu/risu-fields.ts:3-9`). Nothing in the canonical model parses or interprets this
HTML and CSS; it rides as data until a render call touches it.

Regex replace effects on a card can also produce a string containing HTML. That output is never
rendered inline either; it is documented to reach the screen only through the same sealed preview
covered below (`src/core/regex/apply.ts:13-16`).

Ordinary prose fields (description, greeting, creator notes) are a separate, lower-risk case:
markdown or HTML text, tagged per field by `RenderFormat`, rendered through `renderMarkup` and
shown with `dangerouslySetInnerHTML` (`src/ui/components/render-box/index.tsx:60-94`, the
`dangerouslySetInnerHTML` calls at `:66` and `:88`). No iframe sits between that output and the app
chrome.

## Two rendering surfaces, two boundaries

@fig boundaries

**Prose fields** (`src/ui/_shared/render-markup.ts`, consumed by `RenderBox`) sanitize with
DOMPurify and inject straight into the current document. There is no iframe. The only isolation
this surface has is the app shell's own ambient Content-Security-Policy, described below. Because
there is no per-render sandbox, this config's forbid list has to do the work of blocking
auto-fetch elements outright.

**The backdrop preview** (`src/ui/components/sealed-html-preview/index.tsx`, wired to
`behavior.backgroundHTML` and `behavior.backgroundCSS` from `src/ui/apps/workbench/workshop/code-pane.tsx:54-73`)
sanitizes with a narrower DOMPurify config, then loads the result into a `srcDoc` iframe carrying
its own scoped CSP. The component's own header comment states the design intent plainly:
"Sanitizing is not isolation; the iframe + CSP are the load-bearing egress barrier"
(`src/ui/components/sealed-html-preview/index.tsx:3-5`).

Both surfaces run DOMPurify last, after any markdown-to-HTML conversion, and both cap input size
before parsing (`RENDER_INPUT_CAP` 200000 characters in `src/ui/_shared/render-policy.ts:20`,
`BACKDROP_HTML_CAP` 200000 in `src/ui/components/sealed-html-preview/index.tsx:24`, `BACKDROP_CSS_CAP`
100000 in `src/ui/components/sealed-html-preview/backdrop-css.ts:9`).

## What DOMPurify allows and strips

Both configurations set `ALLOW_DATA_ATTR: false` and add back only `target` on anchors
(`render-markup.ts:113-120`, `sealed-html-preview/index.tsx:83-87`). DOMPurify's default HTML
profile already empties `<script>` content and strips inline event handlers and `javascript:` /
`vbscript:` URIs before any project config is applied; both call sites also explicitly forbid the
`script` tag for clarity and defense in depth. This baseline is exercised directly:
`render-markup.test.ts` asserts a script tag, an `onerror` handler, an SVG `onload` handler, and a
`javascript:` href (as raw HTML and as a markdown link) are all absent from the sanitized output
(`src/ui/_shared/render-markup.test.ts:33-52`), and a known mutation-XSS payload
(`<math><mtext><table><mglyph><style><img ...>`) still comes out clean
(`render-markup.test.ts:68-72`).

Past that shared baseline, the two forbid lists diverge on purpose:

- **Prose-field forbid list** (`render-markup.ts:31-53`): `style`, `script`, `iframe`, `object`,
  `embed`, `form`, `input`, `button`, `textarea`, `select`, `option`, `link`, `meta`, `base`,
  `img`, `picture`, `source`, `video`, `audio`, `track`, `image`. Every auto-fetch element (media
  tags, the SVG `<image>` carrier) is removed outright, because this surface has no CSP of its own
  to fall back on for network egress; the tag list has to carry that job. This is verified: remote
  `<img>`, `<picture>`/`<source>`/`<video>`/`<audio>`/`<track>`, and SVG `<image>` are all confirmed
  stripped and no test host string survives (`render-markup.test.ts:76-102`).
- **Backdrop-preview forbid list** (`sealed-html-preview/index.tsx:26-41`): `script`, `iframe`,
  `object`, `embed`, `form`, `input`, `button`, `textarea`, `select`, `link`, `meta`, `base`,
  `frame`, `frameset`. Notably it does not forbid `style` or `img`. That is deliberate, not an
  oversight: this surface's scoped CSP (`img-src data: blob:`, `connect-src 'none'`, next section)
  is what is meant to stop any network reference that survives the tag scan, so the tag list is
  narrower and the CSP carries the network-egress job instead.

Permitting `<style>` in the tag list was not, on its own, enough to keep a page's design.
`DOMPurify.sanitize` returns the parsed document's BODY markup, so a whole document's
`<head><style>` went into the bin with the head - every word drew and none of the design did, while
a `<style>` written inside `<body>` survived, which made the failure look arbitrary. Every style
block is therefore lifted out before sanitizing (`extractStyleBlocks`,
`sealed-html-preview/index.tsx:68-77`) and its text is concatenated after any author CSS and passed
through `sanitizeBackdropCss` - the same function, the same guarantees, one behavior wherever the
block was written. A block left unterminated by the 200,000-character cap is taken to the end rather
than dropped, so a truncated drawing still shows the design of the part that arrived. What follows a
real `</style>` is ordinary markup and is treated as such: a remote `<img>` there survives the tag
scan and is stopped by the CSP, exactly as it was before (`sealed-html-preview.test.ts`).

An `afterSanitizeAttributes` hook, registered lazily on first render so importing the module never
touches `window` (`render-markup.ts:76-111`), does three more things to whatever DOMPurify lets
through on the prose-field path: strips `src`, `srcset`, `poster`, `ping`, and `xlink:href` from any
surviving element (`FETCH_ATTRS`, `render-policy.ts:129-135`, verified at
`render-markup.test.ts:104-112`); drops an anchor's `href` unless it passes `isSafeHref` (http,
https, mailto, or an in-document/root-relative link; everything else including `javascript:` and
`data:` is rejected, `render-policy.ts:66-79`), then pins `target="_blank" rel="noopener noreferrer"`
on whatever anchor survives (`render-markup.test.ts:159-163`); and narrows any `style` attribute to
six presentation properties (`text-align`, `color`, `background-color`, `font-weight`, `font-style`,
`text-decoration`) with a value that does not match `url(`, `image-set(`, `@import`, `expression(`,
`behavior`, `-moz-binding`, or `var(` (`ALLOWED_INLINE_STYLE_PROPS` and `UNSAFE_STYLE_VALUE`,
`render-policy.ts:85-106`; verified at `render-markup.test.ts:120-147`).

`buildBackdropSrcDoc` does not install or call that hook. Its DOMPurify pass relies only on its own
`FORBID_TAGS` and `ALLOW_DATA_ATTR: false` for the HTML, and on the CSS sanitizer and CSP described
next for style and network egress. This is a difference in mechanism, not necessarily a gap: DOMPurify
hooks are process-global once registered, so if the prose-field renderer has already run once in the
same bundle before a backdrop preview renders, its hook would also apply to that later call. Nothing
in the codebase guarantees or tests that ordering, so the backdrop path's stated guarantees come from
its own explicit config and the iframe/CSP boundary, never from an assumption about hook order.

## CSS: `sanitizeBackdropCss` is defense in depth, not a parser

`behavior.backgroundCSS` (passed as the `css` prop, distinct from any `<style>` tag that might
survive inside `backgroundHTML` itself) goes through `sanitizeBackdropCss`
(`src/ui/components/sealed-html-preview/backdrop-css.ts`). Its own header comment states the
limits plainly: "Defense in depth only: sealed-preview CSP is the load-bearing egress barrier. This
helper must not claim to be a complete CSS parser" (`backdrop-css.ts:1-6`). It is a sequence of
regex passes, in this order: neutralize any `</style>` breakout sequence before anything else runs
(`CLOSE_STYLE`, `:15,22`), blank any residual markup left by a breakout attempt
(`:24`), strip `@import` and `@font-face` blocks (`:25-26`), neutralize `expression(`, `behavior:`,
and `-moz-binding:` (`:27-29`), rewrite any non-`data:` `url(...)` to `url(about:blank)`
(`:30`), and wipe bare `http://`/`https://` substrings that survive outside a `url()` call
(`:32`). All of this is verified at the string-output level, including four case- and
whitespace-varied `</style>` breakout payloads that must not leave `evil.test` or a live
close-style tag in the output (`sealed-html-preview.test.ts:9-45`).

The CSS Workshop tool's own sealed preview uses a separate, independently implemented sanitizer,
`sanitizeWorkshopCss` (`src/ui/components/css-workshop/sanitize.ts:8-19`), not a reuse of
`sanitizeBackdropCss`. The two overlap on part of the pattern (stripping `@import` and `@font-face`,
neutralizing `expression(`, `behavior:`, and `-moz-binding:`, and rewriting non-`data:` `url(...)`
calls), but `sanitizeWorkshopCss` omits two protections `sanitizeBackdropCss` has: the `CLOSE_STYLE`
closing-style-breakout neutralization (`backdrop-css.ts:15, 22-24`) and the bare `http://`/`https://`
string strip (`backdrop-css.ts:32`). The Workshop preview's CSP is also more permissive on images,
`img-src data: blob: https: http:` (`css-workshop/preview.ts:97-100`), against the backdrop preview's
`img-src data: blob:` (`sealed-html-preview/index.tsx:48`). That surface sanitizes CSS the Studio user
types themselves against a fixed, non-card mock HTML string, a different and lower-stakes trust
boundary than card-authored content; it is not otherwise covered by this page.

## The iframe sandbox and the scoped CSP

The backdrop preview renders inside an `<iframe sandbox="" srcDoc={...} referrerPolicy="no-referrer" />`
(`sealed-html-preview/index.tsx:78-84`). An empty `sandbox` attribute is the most restrictive form
the HTML sandbox attribute supports: scripts, forms, popups, pointer lock, and top-level navigation
are all disabled, and because `allow-same-origin` is not present the frame's content is treated as
coming from a unique, opaque origin rather than the app's own. That is standard, specified iframe
behavior, not custom code.

The `srcDoc` also carries its own `<meta http-equiv="Content-Security-Policy">`
(`SEALED_PREVIEW_CSP`, `sealed-html-preview/index.tsx:47-50`): `default-src 'none'`, images and media
restricted to `data:` and `blob:`, `script-src 'none'`, `connect-src 'none'`, `frame-src 'none'`,
`object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, and `style-src 'unsafe-inline'` (inline
`<style>` content is allowed to apply, which is exactly why the CSS sanitizer and the tag-forbid gap
noted above matter). This policy is asserted as a literal string in the served `srcDoc`, and the test
suite confirms the generated document never contains an `http:` or `https:` substring after a
closing-style breakout attempt (`sealed-html-preview.test.ts:64-84`). What that test does not do is
run a real browser or WebView2 instance and confirm the CSP is actually enforced at the network
layer: `jsdom`, which the suite uses because DOMPurify requires a `window`, does not implement CSP
at all. The claim that survives verification is narrower than "this cannot exfiltrate": it is "the
generated markup contains no literal remote reference, and the CSP string that would need to block
one is present and well-formed."

`ADR-009` (`docs/decisions/ADR-009-sandbox-origin.md`) records the same class of gap for a different
subsystem, the Lua sandbox worker's distinct-origin boundary: implemented and unit-tested at the Bun
HTTP layer, but "packaged-host proof remains BLOCKED" pending a WebView2 measurement pass
(`ADR-009:100-113`), and the ADR is explicit that "full sandbox isolation" must not be claimed until
that matrix is green. No equivalent measurement pass exists for the backdrop iframe either. By the
same house posture, this page does not claim the backdrop preview is fully isolated or fully
sandboxed in the packaged Windows build; it claims what the code enforces (the sandbox attribute
value, the CSP string, the DOMPurify config) and what the test suite actually exercises (string- and
jsdom-level checks), and no more.

## The ambient app CSP covers the prose-field surface too

Prose fields have no iframe, but they are not undefended past DOMPurify either. Every HTML response
the app server serves, including the shell the whole Studio UI (and `RenderBox`) runs inside, carries
a CSP built by `htmlSecurityHeaders` (`src/ui/server-security.ts:87-100`): `default-src 'self'`,
`script-src 'self'` plus the exact sha256 hashes of the inline scripts actually served (computed from
the served HTML itself, `inlineScriptHashes`, `server-security.ts:77-84`, so no hand-pinned hash can
rot), `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob:`, `connect-src 'self'`,
`worker-src 'self' blob:` (plus the sandbox origin when set), `font-src 'self'`, `frame-ancestors 'none'`,
`base-uri 'none'`, `form-action 'none'`. `server.ts:96-107` applies this header to every served index
HTML response. `no unsafe-inline` on `script-src` means even a script that somehow reached the DOM
past DOMPurify could not run from an inline source; `connect-src 'self'` means a surviving element
could not fetch or beacon to an external host. This is asserted against a real HTTP `Response` header
in `src/ui/server.test.ts:249-265`, which is a genuine assertion, not a live browser, so it proves the
header is served correctly, not that a given browser engine enforces every directive as written.

DOMPurify's own `img`/media forbid list on the prose-field path (previous section) is therefore
redundant with `img-src 'self' data: blob:` for the remote-image case specifically: either layer
alone would stop a remote `<img src="https://...">`. That redundancy is intentional defense in
depth, not dead code; the two layers fail differently (DOMPurify removes the node from the DOM
entirely, the CSP would block only the network request if a node somehow survived).

## What is tested, and what is not

| Claim | Verified by | Not verified by |
| --- | --- | --- |
| Prose-field DOMPurify config strips scripts, handlers, active tags, unsafe hrefs, unsafe styles, fetch attributes | `render-markup.test.ts` (jsdom, asserts on sanitized output string) | A real browser engine or the packaged WebView2 host |
| Ambient app CSP header is well-formed and served on every HTML response | `server.test.ts:249-265` (real HTTP `Response` header) | Live enforcement of any individual directive in a browser |
| Backdrop DOMPurify config plus CSS regex sanitizer strip active tags and known CSS breakout patterns | `sealed-html-preview.test.ts` (jsdom, string assertions on the generated `srcDoc`) | CSP enforcement at the network layer (jsdom has no CSP implementation) |
| Backdrop iframe (`sandbox=""`, no `allow-same-origin`) blocks scripts and grants a unique opaque origin | HTML sandbox attribute specification | Packaged WebView2 behavior for this specific component (no measurement pass exists, unlike the Lua-worker ADR-009 gap this mirrors) |

Nothing on this page should be read as "cards cannot smuggle active markup onto the screen" as an
absolute. It should be read as: two independently-configured sanitizer passes, an ambient CSP, and
a sandboxed iframe with a second CSP each remove a specific, tested class of payload, the gaps
between what each layer forbids are covered by a different layer on purpose, and the one class of
claim this page cannot make is that any of it has been confirmed against the actual packaged
Windows WebView2 host.
