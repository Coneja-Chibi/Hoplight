/**
 * Show one element and nothing else - the browser's own fullscreen where it exists, an in-app
 * overlay where it does not.
 *
 * TWO PATHS, BECAUSE THE PACKAGED APP IS NOT A TAB. `requestFullscreen` is the right answer in a
 * browser: the OS chrome goes too, and Escape already means "come back". Inside the desktop shell
 * the call can be missing or simply refused, and a button that does nothing when pressed is worse
 * than a button that does something smaller - so the caller falls back to covering the app window,
 * which is the whole of what a person wanted from "let me see it big".
 *
 * NEITHER PATH TOUCHES THE SEAL. What goes fullscreen is the container; the sealed iframe inside it
 * keeps its own sandbox and CSP exactly as before, and nothing about being large changes what may
 * run inside it (nothing).
 */

export type FullscreenMode = "native" | "overlay";

interface Requestable {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
}

/** Is a real fullscreen currently showing, whichever spelling this engine uses? */
export function fullscreenElement(doc: Document = document): Element | null {
  const d = doc as Document & { webkitFullscreenElement?: Element | null };
  return doc.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

/**
 * Ask for real fullscreen; say which path the caller ended up on.
 *
 * Never throws: a refusal is an answer ("overlay"), not an error to handle at every call site.
 */
export async function requestFullscreen(el: Element | null): Promise<FullscreenMode> {
  const target = el as (Element & Requestable) | null;
  const ask = target?.requestFullscreen ?? target?.webkitRequestFullscreen;
  if (!target || typeof ask !== "function") return "overlay";
  try {
    await ask.call(target);
    return "native";
  } catch {
    // Refused (no user gesture, a policy, an engine that only pretends to have the API).
    return "overlay";
  }
}

/** Leave real fullscreen if we are in it. Safe to call when we are not. */
export async function exitFullscreen(doc: Document = document): Promise<void> {
  if (!fullscreenElement(doc)) return;
  const d = doc as Document & { webkitExitFullscreen?: () => Promise<void> | void };
  const leave = doc.exitFullscreen ?? d.webkitExitFullscreen;
  if (typeof leave !== "function") return;
  try {
    await leave.call(doc);
  } catch {
    /* already out, or refused: the overlay class is removed by the caller either way */
  }
}
