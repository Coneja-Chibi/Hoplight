/**
 * Link gate - carries "a rendered external link was clicked" from RenderBox (bundled into an APP) to
 * the one LeavingGate (bundled into the SHELL). Those are SEPARATE bundles (one React per page), so a
 * module-scoped bus would be duplicated and split-brained - the app's copy and the shell's copy would
 * never see each other. The carrier is therefore the shared `window` as a CustomEvent: both bundle
 * copies of this module talk through the one real event target, not shared module state.
 *
 * UX routing only. POST /api/open re-validates every URL, so a click that slips past the gate still
 * cannot open anything the route would refuse.
 */
import { externalLinkInfo, type ExternalLink } from "./external-url";

const EVENT = "vaude:external-link";

/**
 * Ask the shell's gate to intercept a clicked link. Returns true when it is a safe external target (so
 * the caller preventDefaults); false when it is not openable (leave native behavior alone). Dispatches
 * on click, never at import - so this module stays side-effect-free to load.
 */
export const requestExternal = (href: string, text: string): boolean => {
  const info = externalLinkInfo(href, text);
  if (info === null) return false;
  window.dispatchEvent(new CustomEvent<ExternalLink>(EVENT, { detail: info }));
  return true;
};

/** Subscribe to intercepted links (shell-side). Returns an unsubscribe. */
export const subscribeExternal = (fn: (target: ExternalLink) => void): (() => void) => {
  const handler = (e: Event): void => fn((e as CustomEvent<ExternalLink>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
};
