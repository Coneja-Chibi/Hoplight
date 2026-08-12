/**
 * Hand one HTML document from the transcript to the viewer app, and ask the shell to open it.
 *
 * WHY NOT `prefs`. AppContext.prefs is the persisted per-app store, written into the studio's
 * settings.json. A wireframe is tens of kilobytes of somebody else's markup and it is worth looking
 * at once - putting that in the settings file would grow a document every app reads on boot, to keep
 * something nobody asked to keep.
 *
 * WHY NOT A NEW AppContext METHOD. `openApp(id)` takes no payload, and widening it would mean every
 * app can push arbitrary state into every other app. This needs exactly one direction, for exactly
 * one kind of value, so it gets its own narrow seam instead of a general one.
 *
 * SESSION STORAGE, DELIBERATELY TRANSIENT. Both the agent window and the viewer are chunks of the
 * same origin, so they share it; it survives the app switch, which is all it has to do, and it does
 * NOT survive a reload. That last part is a real limit and the viewer says so rather than showing an
 * empty frame - a preview that quietly vanishes is worse than one that explains itself.
 *
 * The event is how the shell hears about it. This module cannot call openApp - it is imported by the
 * pure transcript renderer, which has no AppContext and should not gain one - so it announces, and
 * the agent room, which does have ctx, listens.
 */

/** Where the handoff waits between the two apps. */
const KEY = "hoplight.html-view.doc";

/**
 * What is waiting: a document written into a reply, or a piece already on disk.
 *
 * TWO SHAPES BECAUSE THERE ARE TWO ORIGINS, and only one of them survives a reload. Inline text is
 * all there is for an ```html block nobody saved - lose the session and it is genuinely gone. A
 * SAVED drawing needs only its id, so the viewer re-reads it from the studio and a reload costs
 * nothing. Carrying the id rather than a copy of the html also means the tab shows what the piece
 * says NOW, not what it said when the tab was opened.
 */
export type HtmlHandoff =
  | { readonly at: "inline"; readonly html: string }
  | { readonly at: "piece"; readonly id: string };

/** The one event name both sides use. A typo here fails silently, so it lives in one place. */
export const OPEN_HTML_EVENT = "hoplight:open-html";

/** The app that draws it. Named here so the transcript never hardcodes an app id of its own. */
export const HTML_VIEW_APP = "html-view";

/**
 * A cap, because this crosses into storage a whole origin shares.
 *
 * Matches the sealed preview's own ceiling: anything it would truncate on the way to the screen is
 * not worth carrying here first.
 */
export const HANDOFF_CAP = 200_000;

function put(handoff: HtmlHandoff): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(handoff));
  } catch {
    // A full or blocked store is not worth throwing into a transcript render. The viewer will say
    // it has nothing, which is true, rather than the window dying around a preview.
    return;
  }
  window.dispatchEvent(new CustomEvent(OPEN_HTML_EVENT));
}

/** Hand over a document written into a reply, which exists nowhere else. */
export function handOffHtml(html: string): void {
  put({ at: "inline", html: html.length > HANDOFF_CAP ? html.slice(0, HANDOFF_CAP) : html });
}

/** Hand over a saved drawing by id; the viewer reads it from the studio. */
export function handOffPiece(id: string): void {
  put({ at: "piece", id });
}

/**
 * Read what is waiting, WITHOUT consuming it.
 *
 * Left in place on purpose: the viewer re-reads on every mount, and switching to another app and
 * back should show the same thing rather than an empty frame.
 *
 * Tolerant of a stored value it cannot read. The key is session-scoped and this shape has already
 * changed once, so a value written by an older tab is a real thing to meet - and answering "nothing
 * is waiting" is right, where throwing would take the whole viewer down over a preview.
 */
export function takeHandedHtml(): HtmlHandoff | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as HtmlHandoff;
    if (parsed.at === "inline" && typeof parsed.html === "string") return parsed;
    if (parsed.at === "piece" && typeof parsed.id === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Listen for a document being handed over. Returns the detach. */
export function onHtmlHandoff(run: () => void): () => void {
  window.addEventListener(OPEN_HTML_EVENT, run);
  return () => window.removeEventListener(OPEN_HTML_EVENT, run);
}
