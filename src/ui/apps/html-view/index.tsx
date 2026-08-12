/**
 * HTML View - the tab that draws a page the agent wrote.
 *
 * WHY AN APP AND NOT A PANEL. "Open it as a tab I can see" is, in this shell, an app surface: apps
 * are folders-as-schema and cost three files, and the Dock/tab machinery already exists. It is
 * `catalogOnly`, so it never sits on the everyday Dock - it appears when something opens it and is
 * otherwise out of the way, which is the right weight for a surface you visit rather than live in.
 *
 * IT DRAWS THROUGH THE SAME SEAL AS THE TRANSCRIPT. SealedHtmlPreview: a srcdoc iframe with
 * `sandbox=""` and a CSP of `script-src 'none'; connect-src 'none'; img-src data: blob:`, over
 * DOMPurify-cleaned markup. This is model output, which is untrusted by construction, and a bigger
 * frame is not a reason to relax the boundary - so a full tab and an inline preview are the same
 * seal at two sizes, rather than two rendering paths that could drift.
 *
 * CSS renders faithfully; JavaScript never runs and no external image or webfont is fetched. Static
 * wireframes and mockups are what this is for.
 */
import { useEffect, useState, type CSSProperties, type JSX } from "react";
import type { AppContext, HoplightApp } from "../../app-contract";
import { SealedHtmlPreview } from "../../components/sealed-html-preview";
import { onHtmlHandoff, takeHandedHtml } from "../../agent/html-handoff";
import styles from "./styles.module.css";

/** a framed page: the family grammar is flat ink, no gradients, no glow */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">'
  + '<rect x="3.5" y="4.5" width="17" height="15"/><path d="M3.5 9h17"/><path d="M7 6.6h.01"/></svg>';

const ACCENT = "#c2683f"; // hardcode-ok: app identity accent, not theme chrome

export function HtmlView({ ctx }: { ctx: AppContext }): JSX.Element {
  const [html, setHtml] = useState<string | null>(() => takeHandedHtml());

  // Re-read when another document is handed over while this tab is already open, so a second ask
  // replaces the drawing rather than leaving the first one up.
  useEffect(() => onHtmlHandoff(() => setHtml(takeHandedHtml())), []);

  useEffect(() => {
    ctx.setStatus(html ? `html view · ${html.length} characters` : "html view · nothing to draw");
  }, [ctx, html]);

  return (
    <div className={styles.room} style={{ "--a": ACCENT } as CSSProperties}>
      <header className={styles.head}>
        <span className={styles.eyebrow}>HTML view</span>
        <h1 className={styles.title}>{html ? "What the agent drew" : "Nothing to draw yet"}</h1>
        <p className={styles.lede}>
          {html
            ? "Rendered with scripts and network access off, so this is layout and styling only - "
              + "what a browser would paint, minus anything that would run or phone out."
            : "Ask the agent for a wireframe or a mockup, then open it from the reply. This tab draws "
              + "whatever it hands over."}
        </p>
      </header>

      {html ? (
        <div className={styles.frame}>
          <SealedHtmlPreview html={html} title="The page the agent wrote" />
        </div>
      ) : (
        /*
          Said rather than shown as an empty frame. The handoff is session-scoped, so a reload is a
          real way to arrive here with nothing, and "it vanished" is worse than knowing why.
        */
        <p className={styles.quiet}>
          Anything opened here is kept for this session only, so a reload empties it. Open it again
          from the reply it came from.
        </p>
      )}
    </div>
  );
}

const app: HoplightApp = {
  manifest: {
    id: "html-view",
    title: "HTML View",
    markSvg: MARK_SVG,
    accent: ACCENT,
    order: 95,
    subtitle: "app · preview",
    catalogOnly: true,
    agentSurface: {
      describe:
        "HTML View draws a page as a full tab, with scripts and network access off. The agent opens "
        + "it by writing an html code block and calling html_open, or the person clicks through from "
        + "a reply. It renders layout and styling only.",
      actions: [
        {
          id: "open",
          label: "Open a drawing",
          describe:
            "Show an HTML document as a full tab. Use it for wireframes and mockups the person "
            + "should look at rather than read.",
        },
      ],
    },
  },
  Component: HtmlView,
};

export default app;
