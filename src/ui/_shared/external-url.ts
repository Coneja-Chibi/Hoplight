/**
 * External-link security + display, pure. Shared by the server's /api/open route (the ENFORCEMENT
 * boundary - it spawns the OS browser) and the client leaving-gate (UX). The route trusts nothing the
 * client says: it re-validates here and spawns the NORMALIZED href this returns, never the raw input.
 *
 * No DOM, no fetch - just URL parsing. `safeExternalUrl` is the single definition of "a link we will
 * open": http/https only, everything else (file:, javascript:, data:, custom handlers, garbage) is
 * refused. Tested directly with an injection battery.
 */

/**
 * Validate and normalize a user-supplied link for external opening. Returns the normalized `href` for
 * an http/https URL only; null for anything else. The OS launcher is not itself a safety boundary
 * (rundll32/open/xdg-open will happily open file:// or a local path), so THIS allowlist is - and the
 * route spawns exactly what this returns.
 */
export const safeExternalUrl = (input: string): string | null => {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  return u.href;
};

/** A vetted external target for the leaving-gate to display. */
export interface ExternalLink {
  /** the normalized, safe href the route will open */
  url: string;
  /** the destination host, shown large on the gate */
  host: string;
  /** the link's visible text advertises a DIFFERENT host than where it points (a phishing tell) */
  mismatch: boolean;
}

/** Extract a host from link TEXT when the text is itself host-like (a url or a bare domain), else null. */
const hostFromText = (text: string): string | null => {
  const t = text.trim();
  if (t === "" || /\s/.test(t)) return null;
  const candidate = /^https?:\/\//i.test(t) ? t : `http://${t}`;
  try {
    const host = new URL(candidate).host.toLowerCase();
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
};

/**
 * Build the gate's view of a clicked link, or null if it is not a safe external target (in which case
 * the caller leaves default behavior alone). `mismatch` is set when the visible text names a different
 * host than the real destination - e.g. text "paypal.com" pointing at "evil.example" - so the gate can
 * warn instead of quietly trusting the words.
 */
export const externalLinkInfo = (href: string, text: string): ExternalLink | null => {
  const url = safeExternalUrl(href);
  if (url === null) return null;
  const host = new URL(url).host;
  const named = hostFromText(text);
  return { url, host, mismatch: named !== null && named !== host.toLowerCase() };
};
