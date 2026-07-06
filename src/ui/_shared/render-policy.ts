/**
 * Render policy - the PURE, DOM-free half of the markup renderer. Everything here is deterministic
 * string logic (format union, input cap, link-scheme allowlist) so it can be unit-tested directly
 * without a DOM. The DOM-dependent half (marked + DOMPurify) lives in render-markup.ts and depends on
 * this; keeping the policy pure means the security-critical decisions (which URL schemes survive, how
 * big an input we will parse) are provable in `bun test`, not buried inside the sanitizer call.
 */

/** how a field's stored content should be interpreted when rendered */
export type RenderFormat = "markdown" | "html" | "plain";

export const RENDER_FORMATS: readonly RenderFormat[] = ["markdown", "html", "plain"] as const;

/**
 * Hard cap on characters handed to the parser/sanitizer. Creator-notes and example-message blocks can
 * be large; an unbounded parse is a DoS surface (the catalog's "bound the parser input" rule). 200k is
 * far above any real field yet cheap to sanitize.
 */
export const RENDER_INPUT_CAP = 200_000;

/** Truncate to the parse cap. Returns the input untouched when it is already within budget. */
export const capInput = (raw: string): string =>
  raw.length > RENDER_INPUT_CAP ? raw.slice(0, RENDER_INPUT_CAP) : raw;

const ESC: Readonly<Record<string, string>> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

/**
 * Escape the five HTML-significant characters so a "plain" field shows its content LITERALLY (a stray
 * `<b>` reads as `<b>`, not vanishes). One pass, so `&` is not double-encoded. This is entity escaping,
 * not sanitizing - it makes text inert by never being parsed as markup in the first place.
 */
export const escapeHtml = (raw: string): string => raw.replace(/[&<>"']/g, (c) => ESC[c] ?? c);

/** bare http/https URLs inside plain text, so a creator/source URL field becomes a clickable link */
const BARE_URL = /https?:\/\/[^\s<>"']+/g;
/** trailing sentence punctuation that should stay text, not ride into the link */
const TRAILING_PUNCT = /[.,;:!?)\]}]+$/;

/**
 * Escape plain text AND turn bare http/https URLs within it into safe anchors. Everything is escaped
 * (a stray `<b>` still reads literally); only matched URLs become links, and their href/text are
 * escaped too. The anchors carry rel/target as defense in depth, though the render layer intercepts
 * clicks and routes them through the leaving-gate before any navigation happens. Pure, no DOM.
 */
export const linkifyEscaped = (raw: string): string => {
  let out = "";
  let last = 0;
  for (const m of raw.matchAll(BARE_URL)) {
    const whole = m[0];
    const start = m.index ?? 0;
    out += escapeHtml(raw.slice(last, start));
    const tail = TRAILING_PUNCT.exec(whole)?.[0] ?? "";
    const link = tail ? whole.slice(0, whole.length - tail.length) : whole;
    const safe = escapeHtml(link);
    out += `<a href="${safe}" rel="noopener noreferrer" target="_blank">${safe}</a>${escapeHtml(tail)}`;
    last = start + whole.length;
  }
  out += escapeHtml(raw.slice(last));
  return out;
};

/** schemes we allow on an anchor href; everything else (javascript:, data:, vbscript:, file:) is dropped */
const SAFE_SCHEME = /^(?:https?:|mailto:)/i;

/**
 * Whether an anchor href is safe to keep. Absolute http/https/mailto pass; in-document (#anchor) and
 * root-relative (/path) links pass; any explicit scheme we do not allow (javascript:, data:, etc.) is
 * rejected so the sanitizer hook can strip the href. DOMPurify already blocks javascript: URIs, but
 * this is the belt to its suspenders and the single place the policy is stated and tested.
 */
export const isSafeHref = (href: string): boolean => {
  const h = href.trim();
  if (h === "") return false;
  if (h.startsWith("#") || h.startsWith("/")) return true;
  return SAFE_SCHEME.test(h);
};
