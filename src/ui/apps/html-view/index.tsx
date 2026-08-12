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

/** What the frame is drawing, and where it came from. */
interface Drawing {
  readonly html: string;
  /** the piece's name, when this came from the studio rather than a reply */
  readonly name?: string;
}

export function HtmlView({ ctx }: { ctx: AppContext }): JSX.Element {
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [handoff, setHandoff] = useState(() => takeHandedHtml());

  // Re-read when something else is handed over while this tab is already open, so a second ask
  // replaces the drawing rather than leaving the first one up.
  useEffect(() => onHtmlHandoff(() => setHandoff(takeHandedHtml())), []);

  /**
   * A piece is READ FROM THE STUDIO, not carried. So the tab shows what the drawing says now rather
   * than what it said when somebody opened it, and a reload costs nothing - the id is enough to
   * find it again. Only an unsaved reply has to be carried whole, because it exists nowhere else.
   */
  useEffect(() => {
    let cancelled = false;
    if (!handoff) { setDrawing(null); setProblem(null); return; }
    if (handoff.at === "inline") { setDrawing({ html: handoff.html }); setProblem(null); return; }
    setProblem(null);
    void (async () => {
      try {
        const entity = await ctx.api.getEntity(handoff.id);
        if (cancelled) return;
        const body = (entity as { body?: { html?: unknown; name?: unknown } } | null)?.body;
        if (typeof body?.html !== "string") {
          // Named rather than drawn as an empty frame: a piece that is not a drawing is a wrong
          // id, and a blank tab would read as a drawing that renders to nothing.
          setDrawing(null);
          setProblem(`"${handoff.id}" is not a drawing this tab can show.`);
          return;
        }
        setDrawing({ html: body.html, ...(typeof body.name === "string" ? { name: body.name } : {}) });
      } catch {
        if (!cancelled) {
          setDrawing(null);
          setProblem(`Could not read "${handoff.id}" from the studio. It may have been deleted.`);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [ctx, handoff]);

  const html = drawing?.html ?? null;

  useEffect(() => {
    ctx.setStatus(
      drawing
        ? `html view · ${drawing.name ?? "from a reply"} · ${drawing.html.length} characters`
        : "html view · nothing to draw",
    );
  }, [ctx, drawing]);

  return (
    <div className={styles.room} style={{ "--a": ACCENT } as CSSProperties}>
      <header className={styles.head}>
        <span className={styles.eyebrow}>HTML view</span>
        <h1 className={styles.title}>{drawing?.name ?? (html ? "What the agent drew" : "Nothing to draw yet")}</h1>
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
          {problem
            ?? "A drawing saved as a piece reopens from the Library after a reload. One written "
              + "straight into a reply is kept for this session only, so open it again from the "
              + "reply it came from."}
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
      /**
       * WRITTEN TO 300 CHARACTERS, which is what actually reaches the model.
       *
       * surface.ts truncates a describe at 300 (`safeText(reading.describe, 300)`), so a longer
       * brief is not a fuller brief - it is the same brief with the end cut off, and the end is
       * where the constraints were. The full authoring notes live in the actions below, which get
       * 200 each and are listed separately.
       *
       * These facts are what a page needs to be written FOR this surface rather than for a browser:
       * without them a model reaches for a <script>, a CDN image and a webfont, every one of which
       * is dropped silently so the drawing arrives subtly wrong with nothing to explain it.
       */
      describe:
        "HTML View draws a page as a full tab. Write it in an ```html block - the PERSON opens it, "
        + "no tool does. Sealed and offline: all CSS works, images only as data: URIs. No "
        + "JavaScript, no iframe/form/input/button, no http(s) image, font or fetch. Static "
        + "wireframes and mockups only.",
      /**
       * NOT A TOOL MENU - there is no tool here, and one was claimed once already.
       *
       * An earlier version listed an "open" action and named an `html_open` tool. Neither exists,
       * and that text goes to the model, so it spent a step on an unknown tool while the person
       * watched it fail at something the screen had promised.
       *
       * These are AUTHORING NOTES instead: the surface has capabilities worth knowing even though
       * it has no verbs, and 200 characters each is where the detail the describe could not hold
       * actually fits. Each one is a fact about SealedHtmlPreview's real CSP and forbid list.
       */
      actions: [
        {
          id: "css",
          label: "What renders",
          describe:
            "Every CSS feature: grid, flexbox, custom properties, gradients, transforms, "
            + "animations, media and container queries. Inline <style> and style attributes. "
            + "Tables, semantic layout, inline SVG, unicode.",
        },
        {
          id: "blocked",
          label: "What is dropped, silently",
          describe:
            "<script> and every event attribute - no JavaScript runs. iframe, object, embed, form, "
            + "input, button, textarea, select, link, meta, base are stripped. Reaching for one "
            + "leaves a page missing that part.",
        },
        {
          id: "offline",
          label: "The frame is offline",
          describe:
            "No http(s) request of any kind resolves: a remote image is a blank box and a webfont "
            + "falls back to a system font. Images must be data: URIs. Assume no network and no "
            + "fonts beyond the system stack.",
        },
        {
          id: "interactive",
          label: "When asked for interactive",
          describe:
            "Say plainly that this surface cannot run scripts and offer the static version - "
            + "states drawn side by side, or a flow shown as steps. Do not ship a page whose "
            + "behaviour will silently not happen.",
        },
      ],
    },
  },
  Component: HtmlView,
};

export default app;
