/**
 * RenderBox - one reusable content box with a per-box "render" toggle. It shows a field's value either
 * RENDERED (markdown/html run through marked + DOMPurify, safe for innerHTML) or as SOURCE (the raw
 * editable surface, or the raw text for a read-only field). Default is rendered, which is what the
 * editor wants: you see how the content actually reads, one click flips to editing the source.
 *
 * Reusable by construction - it takes the value and its declared format, never a field id, so nothing
 * about which field this is leaks into the component. Security lives entirely in render-markup; this
 * file only decides rendered-vs-source and mounts the sanitized string as parsed nodes (DOMParser +
 * importNode, the ADR-008 pattern - no innerHTML-family sink even for sanitized output).
 *
 * "plain" fields (a version string, a URL) have nothing to render, so they show inline with no toggle;
 * the button only appears where markup actually transforms the text.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX, MouseEvent, ReactNode } from "react";
import { renderMarkup } from "../../_shared/render-markup";
import type { RenderFormat } from "../../_shared/render-policy";
import { requestExternal } from "../../_shared/link-gate";
import styles from "./styles.module.css";

/**
 * Intercept a plain left-click on a rendered link and route it through the leaving-gate. Modified
 * clicks (ctrl/meta/middle/shift) are left to native behavior - a deliberate "open anyway", and the
 * single-window webview has nowhere to spawn a tab regardless. The gate is confirmation; the /api/open
 * route is the actual guard, so a click that slips past here still cannot open an unsafe target.
 */
const onRenderedClick = (
  e: MouseEvent<HTMLDivElement>,
  onLinkClick?: (href: string, text: string) => boolean,
): void => {
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  const anchor = (e.target as HTMLElement).closest("a");
  const href = anchor?.getAttribute("href");
  if (!href) return;
  if (onLinkClick?.(href, anchor?.textContent ?? "")) {
    e.preventDefault();
    return;
  }
  if (requestExternal(href, anchor?.textContent ?? "")) e.preventDefault();
};

/** Mount an already-sanitized markup string as parsed inert nodes (DOMParser never runs scripts). */
function SanitizedHtml({
  html,
  className,
  onClick,
}: {
  html: string;
  className: string | undefined;
  onClick: (e: MouseEvent<HTMLDivElement>) => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // resolve the parser from the element's own window (test DOMs expose it there, not globally)
    const Parser =
      el.ownerDocument.defaultView?.DOMParser ??
      (typeof DOMParser !== "undefined" ? DOMParser : undefined);
    if (!Parser) {
      el.textContent = ""; // fail closed: no parser, no markup
      return;
    }
    const doc = new Parser().parseFromString(html, "text/html");
    el.replaceChildren(...[...doc.body.childNodes].map((n) => el.ownerDocument.importNode(n, true)));
  }, [html]);
  return <div ref={ref} className={className} onClick={onClick} />;
}

interface RenderBoxProps {
  /** the stored field value */
  value: string;
  /** how to interpret it when rendered */
  format: RenderFormat;
  /** edit surface shown in source mode; omit for a read-only field (source mode shows raw text) */
  children?: ReactNode;
  /** start rendered (default) or start on source */
  defaultRendered?: boolean;
  /** show only sanitized output, without the editor's rendered/source chrome */
  displayOnly?: boolean;
  /** intercept safe in-app links before the external leaving gate */
  onLinkClick?: (href: string, text: string) => boolean;
}

const EyeIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CodeIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="m8 6-6 6 6 6M16 6l6 6-6 6" />
  </svg>
);

/** A content box that toggles between a sanitized rendered view and its raw source. */
export function RenderBox({
  value,
  format,
  children,
  defaultRendered = true,
  displayOnly = false,
  onLinkClick,
}: RenderBoxProps): JSX.Element {
  const [rendered, setRendered] = useState(defaultRendered);
  const html = useMemo(() => renderMarkup(value, format), [value, format]);

  // plain fields carry no markup, but a URL in one (creator, source) is linkified and still gated;
  // displayOnly shares the chrome-less surface
  if (format === "plain" || displayOnly) {
    return (
      <SanitizedHtml
        html={html}
        className={styles.plain}
        onClick={(event) => onRenderedClick(event, onLinkClick)}
      />
    );
  }

  const empty = value.trim() === "";
  // nothing to render on an empty field: fall back to the source/edit surface so it is not a blank preview
  const showRendered = rendered && !empty;

  return (
    <div className={styles.box}>
      <div className={styles.bar}>
        <button
          type="button"
          className={`stamp ${styles.toggle}`}
          aria-pressed={showRendered}
          title={showRendered ? "Showing rendered output - click to edit the source" : "Showing source - click to render"}
          onClick={() => setRendered((r) => !r)}
        >
          {showRendered ? EyeIcon : CodeIcon}
          <span>{showRendered ? "Rendered" : "Source"}</span>
        </button>
      </div>
      {showRendered ? (
        <SanitizedHtml
          html={html}
          className={styles.out}
          onClick={(event) => onRenderedClick(event, onLinkClick)}
        />
      ) : (
        children ?? <pre className={styles.src}>{value}</pre>
      )}
    </div>
  );
}
