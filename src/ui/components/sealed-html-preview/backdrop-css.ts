/**
 * Pure CSS sanitizer for untrusted card backdrop styles. No DOM required.
 * Defense in depth only: sealed-preview CSP is the load-bearing egress barrier. This helper must not
 * claim to be a complete CSS parser; it strips known-hostile constructs and prevents style-block
 * breakout before interpolation into a generated <style> element.
 */

/** Cap on author CSS characters accepted into the sealed srcdoc. */
export const BACKDROP_CSS_CAP = 100_000;

/**
 * Neutralize a literal closing-style sequence (any case / whitespace) so author CSS cannot escape
 * the generated <style> block via `</style><img ...>`.
 */
const CLOSE_STYLE = /<\s*\/\s*style\b[^>]*>?/gi;

/** Drop CSS that can exfiltrate or break out of the preview geometry. */
export function sanitizeBackdropCss(raw: string): string {
  if (!raw) return "";
  let s = raw.length > BACKDROP_CSS_CAP ? raw.slice(0, BACKDROP_CSS_CAP) : raw;
  // Prevent style-block breakout before any other rewrite.
  s = s.replace(CLOSE_STYLE, "/*blocked-close-style*/");
  // Residual markup from a breakout attempt must not remain as a live tag inside the style block.
  s = s.replace(/<[^>]*>/g, "/*blocked-tag*/");
  s = s.replace(/@import\b[^;]+;?/gi, "");
  s = s.replace(/@font-face\s*\{[\s\S]*?\}/gi, "");
  s = s.replace(/expression\s*\(/gi, "/*blocked*/(");
  s = s.replace(/behavior\s*:/gi, "/*blocked*/:");
  s = s.replace(/-moz-binding\s*:/gi, "/*blocked*/:");
  s = s.replace(/url\s*\(\s*['"]?\s*(?!data:)[^)]+\)/gi, "url(about:blank)");
  // Bare remote origins outside url() (e.g. after a neutralized close-style) are wiped as well.
  s = s.replace(/https?:\/\/[^\s"'()<>]+/gi, "about:blank");
  return `${s}\nhtml,body{margin:0;padding:0;max-width:100%;overflow:auto;}\n`;
}
