/**
 * SealedHtmlPreview - sandboxed preview of untrusted card HTML (backgroundHTML).
 * Boundary: srcDoc iframe with a bare sandbox (no allow-scripts, never allow-same-origin), strict
 * offline CSP (img/media data/blob only), and DOMPurify-cleaned markup. Sanitizing is not isolation;
 * the iframe + CSP are the load-bearing egress barrier.
 */
import { useMemo, type JSX } from "react";
import createDOMPurify from "dompurify";
import { SEALED_FORBID_TAGS } from "../../../core/render/seal-policy";
import { sanitizeBackdropCss } from "./backdrop-css";
import styles from "./styles.module.css";

export { sanitizeBackdropCss } from "./backdrop-css";

export interface SealedHtmlPreviewProps {
  /** Untrusted HTML. */
  html: string;
  /** Optional author CSS; dangerous constructs are stripped before injection. */
  css?: string;
  /** Accessible name for the iframe. */
  title?: string;
  /**
   * Take the whole of the room rather than stopping at the inline ceiling.
   *
   * Set by the surfaces whose entire job is the drawing - the editor's pane and the HTML View tab.
   * Left off in a transcript, where a tall drawing must not push the conversation off the screen.
   */
  fill?: boolean;
}

/** Cap on untrusted HTML characters accepted into the sealed srcdoc. */
export const BACKDROP_HTML_CAP = 200_000;

/**
 * The list lives in core/render/seal-policy.ts so Kit can read the same policy without a DOM: a
 * regex that emits a <button> should be caught while it is being written, not by looking at a chat.
 * This module is still the only place the policy is ENFORCED.
 */
const FORBID_TAGS = [...SEALED_FORBID_TAGS];

/**
 * Offline-only CSP for sealed card HTML. No http/https image or media sources; connect/frame/object
 * denied; scripts denied. data: and blob: remain so local/imported assets can still paint.
 */
export const SEALED_PREVIEW_CSP =
  "default-src 'none'; img-src data: blob:; media-src data: blob:; " +
  "style-src 'unsafe-inline'; script-src 'none'; font-src 'none'; connect-src 'none'; " +
  "frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

/**
 * A page's own <style> blocks, lifted out before sanitizing.
 *
 * THE HEAD IS THROWN AWAY, and that is not a bug in DOMPurify. `sanitize()` returns the parsed
 * BODY's markup, so anything the HTML parser puts in <head> - which is where a whole document's
 * <style> block goes - is gone with it. The symptom is a page that draws every word and none of its
 * design: right fonts nowhere, no background, no grid. A <style> written inside <body> survived,
 * which made the failure look arbitrary rather than structural.
 *
 * Hoisting them all, wherever they sat, keeps one behaviour and one CSS sanitiser: the text goes
 * through sanitizeBackdropCss like author CSS always has, so `</style>` breakout and remote urls
 * are handled in the place that already handles them.
 *
 * An unterminated block (a document cut off by the cap mid-style) is taken to the end rather than
 * dropped, so a truncated drawing still shows the design of the part that arrived.
 */
/**
 * The sanitizer, bound to the window that is here NOW rather than the one that was here at import.
 *
 * `import DOMPurify from "dompurify"` binds to whatever `window` existed when the module first
 * loaded. In a browser that is the only window there will ever be; in this repo's suite it is
 * whichever test file imported this module first, and once that file closes its JSDOM every later
 * caller sanitizes against a dead document and throws. Two tests here already failed that way
 * depending on which files ran beside them - the same import-time-side-effect shape as the hook in
 * render-markup.ts, which is registered lazily for this exact reason.
 *
 * NO WINDOW IS A REFUSAL, not a pass-through. DOMPurify's unsupported build returns its input
 * unchanged, so a caller without a DOM would get untouched untrusted markup while every line here
 * still claimed it was sanitized.
 */
let purifier: ReturnType<typeof createDOMPurify> | null = null;
let boundTo: unknown = null;

function sanitizer(): ReturnType<typeof createDOMPurify> {
  const view = (globalThis as { window?: unknown }).window;
  if (view === undefined || view === null) {
    throw new Error("sealed preview: cannot sanitize without a DOM");
  }
  if (!purifier || boundTo !== view) {
    purifier = createDOMPurify(view as Parameters<typeof createDOMPurify>[0]);
    boundTo = view;
  }
  return purifier;
}

const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)(?:<\/style\s*>|$)/gi;

export function extractStyleBlocks(html: string): { markup: string; css: string } {
  const found: string[] = [];
  const markup = html.replace(STYLE_BLOCK, (_match, body: string) => {
    found.push(body);
    return "";
  });
  return { markup, css: found.join("\n") };
}

export function buildBackdropSrcDoc(html: string, css = ""): string {
  const cappedHtml =
    html.length > BACKDROP_HTML_CAP ? html.slice(0, BACKDROP_HTML_CAP) : html || "";
  const { markup, css: documentCss } = extractStyleBlocks(cappedHtml);
  const cleanHtml = sanitizer().sanitize(markup, {
    FORBID_TAGS,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"],
  });
  // The page's own rules last, so a drawing wins inside its own frame over a card's backdrop CSS.
  const cleanCss = sanitizeBackdropCss([css, documentCss].filter((part) => part !== "").join("\n"));
  return (
    `<!doctype html><html><head>` +
    `<meta charset="utf-8"/>` +
    `<meta http-equiv="Content-Security-Policy" content="${SEALED_PREVIEW_CSP}"/>` +
    `<style>${cleanCss}</style>` +
    `</head><body>${cleanHtml}</body></html>`
  );
}

/** Sandboxed iframe preview of card backdrop HTML. */
export function SealedHtmlPreview({
  html,
  css = "",
  title = "Backdrop preview",
  fill = false,
}: SealedHtmlPreviewProps): JSX.Element {
  const srcDoc = useMemo(() => buildBackdropSrcDoc(html, css), [html, css]);
  return (
    <iframe
      className={fill ? `${styles.frame} ${styles.fill}` : styles.frame}
      title={title}
      sandbox=""
      srcDoc={srcDoc}
      referrerPolicy="no-referrer"
    />
  );
}
