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

/** Where the document waits between the two apps. */
const KEY = "hoplight.html-view.doc";

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

/** Put a document where the viewer will find it, and announce that one is waiting. */
export function handOffHtml(html: string): void {
  const doc = html.length > HANDOFF_CAP ? html.slice(0, HANDOFF_CAP) : html;
  try {
    sessionStorage.setItem(KEY, doc);
  } catch {
    // A full or blocked store is not worth throwing into a transcript render. The viewer will say
    // it has nothing, which is true, rather than the window dying around a preview.
    return;
  }
  window.dispatchEvent(new CustomEvent(OPEN_HTML_EVENT));
}

/**
 * Read the waiting document, WITHOUT consuming it.
 *
 * Left in place on purpose: the viewer re-reads on every mount, and switching to another app and
 * back should show the same thing rather than an empty frame. It is replaced when the next document
 * is handed over, and dropped when the session ends.
 */
export function takeHandedHtml(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Listen for a document being handed over. Returns the detach. */
export function onHtmlHandoff(run: () => void): () => void {
  window.addEventListener(OPEN_HTML_EVENT, run);
  return () => window.removeEventListener(OPEN_HTML_EVENT, run);
}
