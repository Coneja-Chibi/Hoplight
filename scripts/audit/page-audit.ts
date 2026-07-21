/**
 * The in-page audit every walk runs on every visited state. Self-contained on purpose: the
 * function is serialized into the page by playwright's evaluate, so it may not close over
 * imports or module state. Three exhaustive checks per rendered page:
 *   tinyText      - any text node under the 10px floor
 *   lowContrast   - any text under WCAG AA against its effective background (4.5:1, 3:1 large)
 *   nakedControls - any button/select wearing browser-default fonts instead of the house tokens
 */

export interface AuditResult {
  tinyText: string[];
  lowContrast: string[];
  nakedControls: string[];
}

export function auditPage(): AuditResult {
  const HOUSE_FONTS = ["archivo", "jetbrains", "crimson", "inter"];
  const out: AuditResult = { tinyText: [], lowContrast: [], nakedControls: [] };

  const lum = (r: number, g: number, b: number): number => {
    const f = (c: number): number => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (s: string): { r: number; g: number; b: number; a: number } | null => {
    const m = s.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?\)/);
    return m
      ? { r: +m[1]!, g: +m[2]!, b: +m[3]!, a: m[4] === undefined ? 1 : +m[4]! }
      : null;
  };
  const effBg = (el: Element): { r: number; g: number; b: number } => {
    // an ancestor's background only counts if the element actually sits ON it - an absolutely
    // positioned label hanging outside its parent (swatch labels) is painted on whatever is
    // behind, not on the parent's fill
    const r0 = el.getBoundingClientRect();
    const cx = r0.left + r0.width / 2;
    const cy = r0.top + r0.height / 2;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const rn = n.getBoundingClientRect();
      const covers = cx >= rn.left && cx <= rn.right && cy >= rn.top && cy <= rn.bottom;
      if (n !== el && !covers) continue;
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.6) return c;
    }
    return { r: 10, g: 10, b: 11 };
  };
  const ratio = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number => {
    const l1 = lum(a.r, a.g, a.b);
    const l2 = lum(b.r, b.g, b.b);
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  };
  const visible = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0.05;
  };
  const sig = (el: Element, extra: string): string => {
    const id = el.id ? `#${el.id}` : "";
    const cls =
      typeof el.className === "string" && el.className
        ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
        : "";
    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 42);
    return `${el.tagName.toLowerCase()}${id}${cls} "${text}" ${extra}`;
  };

  const seen = new Set<string>();
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    if (!visible(el)) continue;
    const hasOwnText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 1,
    );
    const s = getComputedStyle(el);

    if (hasOwnText) {
      const px = parseFloat(s.fontSize);
      const fg = parse(s.color);
      if (px < 10) {
        const k = `tiny:${el.tagName}${el.className}${(el.textContent ?? "").slice(0, 20)}`;
        if (!seen.has(k)) {
          seen.add(k);
          out.tinyText.push(sig(el, `${px.toFixed(1)}px`));
        }
      }
      if (fg) {
        const rt = ratio(fg, effBg(el));
        const big = px >= 24 || (px >= 18.66 && parseInt(s.fontWeight, 10) >= 700);
        if (rt < (big ? 3 : 4.5)) {
          const k = `con:${el.tagName}${el.className}${(el.textContent ?? "").slice(0, 20)}`;
          if (!seen.has(k)) {
            seen.add(k);
            out.lowContrast.push(sig(el, `${rt.toFixed(2)}:1 @${px.toFixed(0)}px`));
          }
        }
      }
    }

    const role = el.getAttribute("role");
    const tag = el.tagName;
    if (tag === "BUTTON" || role === "button" || tag === "SELECT") {
      // textless controls (icon tiles, swatches) legitimately carry no text font
      if ((el.textContent ?? "").trim().length === 0) continue;
      const fam = (s.fontFamily || "").toLowerCase();
      if (!HOUSE_FONTS.some((f) => fam.includes(f))) {
        const k = `naked:${tag}${el.className}${(el.textContent ?? "").slice(0, 20)}`;
        if (!seen.has(k)) {
          seen.add(k);
          out.nakedControls.push(sig(el, `font=${fam.slice(0, 30)}`));
        }
      }
    }
  }
  return out;
}
