/**
 * SealedHtmlPreview - sandboxed preview of untrusted card HTML (backgroundHTML).
 * Boundary: srcDoc iframe with a bare sandbox (no allow-scripts, never allow-same-origin), strict
 * offline CSP (img/media data/blob only), and DOMPurify-cleaned markup. Sanitizing is not isolation;
 * the iframe + CSP are the load-bearing egress barrier.
 */
import { useMemo, type JSX } from "react";
import DOMPurify from "dompurify";
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
}

/** Cap on untrusted HTML characters accepted into the sealed srcdoc. */
export const BACKDROP_HTML_CAP = 200_000;

const FORBID_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "link",
  "meta",
  "base",
  "frame",
  "frameset",
];

/**
 * Offline-only CSP for sealed card HTML. No http/https image or media sources; connect/frame/object
 * denied; scripts denied. data: and blob: remain so local/imported assets can still paint.
 */
export const SEALED_PREVIEW_CSP =
  "default-src 'none'; img-src data: blob:; media-src data: blob:; " +
  "style-src 'unsafe-inline'; script-src 'none'; font-src 'none'; connect-src 'none'; " +
  "frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

export function buildBackdropSrcDoc(html: string, css = ""): string {
  const cappedHtml =
    html.length > BACKDROP_HTML_CAP ? html.slice(0, BACKDROP_HTML_CAP) : html || "";
  const cleanHtml = DOMPurify.sanitize(cappedHtml, {
    FORBID_TAGS,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"],
  });
  const cleanCss = sanitizeBackdropCss(css);
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
}: SealedHtmlPreviewProps): JSX.Element {
  const srcDoc = useMemo(() => buildBackdropSrcDoc(html, css), [html, css]);
  return (
    <iframe
      className={styles.frame}
      title={title}
      sandbox=""
      srcDoc={srcDoc}
      referrerPolicy="no-referrer"
    />
  );
}
