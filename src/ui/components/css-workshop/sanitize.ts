/**
 * Preview-only CSS sanitizer for CssWorkshop sealed iframe.
 * Export path keeps author CSS intact; only the preview applies this.
 * Extends the backdrop strip rules with frame-local safety.
 */

/** Drop CSS that can exfiltrate or break out of the sealed preview. */
export function sanitizeWorkshopCss(raw: string): string {
  if (!raw) return "";
  let s = raw;
  s = s.replace(/@import\b[^;]+;?/gi, "");
  s = s.replace(/@font-face\s*\{[\s\S]*?\}/gi, "");
  s = s.replace(/expression\s*\(/gi, "/*blocked*/(");
  s = s.replace(/behavior\s*:/gi, "/*blocked*/:");
  s = s.replace(/-moz-binding\s*:/gi, "/*blocked*/:");
  // remote urls in preview -> blank (data: images still ok for mocks)
  s = s.replace(/url\s*\(\s*['"]?\s*(?!data:)[^)]+\)/gi, "url(about:blank)");
  return s;
}
