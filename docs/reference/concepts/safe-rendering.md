# Concept: safe content rendering (the render toggle)

Character fields carry authored markup: descriptions and greetings are Markdown, creator notes arrive
as HTML, and short facts (version, creator, license) are plain text. The editor and the read-only
inspector render that markup so a field reads the way its author intended, instead of dumping raw
`<p style="text-align: center">...` as literal text. Because the markup is untrusted (it rides in from
any source format), every rendered string is sanitized first.

## The pipeline (sanitize last)

Source: `src/ui/_shared/render-markup.ts` (the DOM-touching shell) and `src/ui/_shared/render-policy.ts`
(the pure, DOM-free policy). `renderMarkup(raw, format)` runs:

1. `capInput` - truncate to `RENDER_INPUT_CAP` (200k) so a giant field cannot stall the parser.
2. by format: `markdown` runs `marked` then sanitizes; `html` sanitizes as-is; `plain` HTML-escapes to
   inert text (no parsing at all).
3. `DOMPurify.sanitize` is always the LAST step. Its output goes straight to `dangerouslySetInnerHTML`
   with no mutation after. The sanitizer is never hand-rolled - DOMPurify exists to survive the
   mutation-XSS that an allowlist walk misses.

The policy half is pure so the security-relevant decisions are unit-tested without a DOM: the URL-scheme
allowlist (`isSafeHref`: http/https/mailto and relative links only) and the input cap. The XSS battery
(`render-markup.test.ts`) runs the real sanitizer under jsdom - DOMPurify's supported non-browser DOM -
and asserts on the sanitized OUTPUT (no `<script>`, no `on*` handler, no `javascript:` scheme survives),
never the weaker "it did not pop an alert".

## Hardening

- `<script>`, `<style>`, `iframe/object/embed`, and form controls are forbidden. The `style` ATTRIBUTE
  is kept (authored `text-align` on notes survives; DOMPurify sanitizes its value).
- An `afterSanitizeAttributes` hook drops any anchor href that is not scheme-allowlisted and pins
  `target="_blank" rel="noopener noreferrer"` on the rest, so a rendered link cannot share an opener or
  navigate the shell in place. The hook is registered lazily on first render (never at import), so the
  module stays side-effect-free for the desktop boot smoke, which evaluates it with no `window`.
- Results are memoized (bounded map) keyed on format + raw, so re-rendering an unchanged field does not
  re-run marked + DOMPurify.

## The leaving-gate (external links)

A rendered link is untrusted twice over: it can point anywhere, and its visible text can lie about where
it points. So no link navigates directly. `RenderBox` intercepts a plain left-click on any rendered
anchor (`onRenderedClick`) and routes it to a full-window "you are leaving Vaude" page
(`src/ui/components/leaving-gate`) that shows the REAL destination host and url, and warns when the
link's text named a different host (`externalLinkInfo.mismatch`). Modified clicks (ctrl/meta/middle) are
left to native behavior - a deliberate "open anyway".

Because RenderBox (in an app bundle) and the gate (in the shell bundle) are separate bundles, the click
crosses to the gate as a `window` CustomEvent (`src/ui/_shared/link-gate.ts`), not a shared module - a
module-scoped bus would split-brain across bundles.

The gate is UX. The enforcement boundary is the server: `POST /api/open` (`src/ui/server.ts`) re-runs
`safeExternalUrl` (`src/ui/_shared/external-url.ts` - http/https only, normalized) and spawns the OS
browser with an argv ARRAY (no shell, no command injection). It is POST-only so embedded content cannot
GET-trigger it, and DOMPurify forbids `<form>`, so rendered content cannot auto-submit one. A click that
somehow bypasses the gate still cannot open anything the route refuses; `safeExternalUrl` has an
adversarial unit battery (schemes, whitespace/CRLF, quotes, IDN).

Bare URLs in `plain` fields (a creator or source URL) are linkified by `linkifyEscaped` so they become
clickable and pass through the same gate.

The gate recognizes the destination from a LOCAL registry (`src/ui/_shared/platform-registry.ts`, a
curated ~150-host seed of the AI-roleplay ecosystem plus mainstream sites) and shows a colored monogram
tile + the site's name, or a neutral globe + the bare host when unrecognized. Recognition is a pure
lookup: it never fetches a favicon, thumbnail, or preview from the destination, so the badge cannot leak
the user's IP or ping a hostile host. A real metadata unfurl was considered and declined - it would mean
the app fetching arbitrary user-supplied URLs (SSRF surface) and pinging the site, which defeats the
gate's purpose. Widen the registry by adding a SEED row, never a code branch.

## The RenderBox component

Source: `src/ui/components/render-box`. One reusable box with a per-box "render" toggle, default ON. It
takes a value and its declared `RenderFormat` - never a field id - so nothing about which field it is
leaks into the component (format is data-driven: `characterFields` tags each `InspectField`, and the
editor passes `"markdown"` for prose cards). Rendered mode shows the sanitized HTML; source mode shows
the raw editable surface (the field's textarea) or, for a read-only field, the raw text. `plain` fields
have nothing to render, so they show inline with no toggle. An empty editable field falls back to its
source surface so editing never costs a click on a blank preview.
