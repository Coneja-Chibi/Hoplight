/**
 * CssWorkshop functional core: structured CSS rules <-> plain CSS string.
 * Source string is the truth on the wire; the model is an assist layer.
 * Best-effort parse never throws; unmodeled material lands in freeform.
 */

export interface CssDecl {
  property: string;
  value: string;
  important?: boolean;
}

export interface CssRule {
  id: string;
  selector: string;
  decls: CssDecl[];
  /** optional section comment above the rule */
  comment?: string;
}

export interface CssDoc {
  rules: CssRule[];
  /** trailing / unparsed material (@media, comments, broken blocks) kept verbatim */
  freeform: string;
}

/** Properties the knob panel owns; everything else is still editable as free decls. */
export const KNOWN_PROPS = [
  "background",
  "background-color",
  "background-image",
  "color",
  "font-size",
  "font-weight",
  "font-family",
  "text-align",
  "padding",
  "margin",
  "border-radius",
  "border",
  "border-width",
  "border-style",
  "border-color",
  "box-shadow",
  "text-shadow",
  "opacity",
  "display",
  "visibility",
  "filter",
  "width",
  "height",
  "max-width",
] as const;

export type KnownProp = (typeof KNOWN_PROPS)[number];

const isKnown = (p: string): p is KnownProp =>
  (KNOWN_PROPS as readonly string[]).includes(p);

let idSeq = 0;
const nextId = (): string => {
  idSeq += 1;
  return `r${idSeq}`;
};

/** Reset id counter (tests only). */
export const resetCssIds = (): void => {
  idSeq = 0;
};

export const emptyDoc = (): CssDoc => ({ rules: [], freeform: "" });

export const makeRule = (
  selector: string,
  decls: CssDecl[] = [],
  comment?: string,
): CssRule => ({
  id: nextId(),
  selector: selector.trim() || ".card",
  decls: decls.map((d) => ({ ...d, property: d.property.trim(), value: d.value.trim() })),
  comment,
});

const fmtDecl = (d: CssDecl): string => {
  const imp = d.important ? " !important" : "";
  return `  ${d.property}: ${d.value}${imp};`;
};

/** Emit a CssDoc as plain CSS. Deterministic given stable rule order. */
export function emitCss(doc: CssDoc): string {
  const chunks: string[] = [];
  for (const rule of doc.rules) {
    if (rule.comment) chunks.push(`/* ${rule.comment} */`);
    const body = rule.decls.map(fmtDecl).join("\n");
    chunks.push(`${rule.selector} {\n${body}\n}`);
  }
  const free = doc.freeform.trim();
  if (free) {
    if (chunks.length > 0) chunks.push("");
    chunks.push(free);
  }
  return chunks.join("\n\n");
}

/** Parse a single declaration line; null if empty/comment. */
const parseDeclLine = (line: string): CssDecl | null => {
  const t = line.trim();
  if (!t || t.startsWith("/*") || t.startsWith("//")) return null;
  const m = t.match(/^([a-zA-Z-]+)\s*:\s*(.+?)\s*;?\s*$/);
  if (!m) return null;
  let value = m[2]!.trim();
  let important = false;
  if (/\s*!important\s*$/i.test(value)) {
    important = true;
    value = value.replace(/\s*!important\s*$/i, "").trim();
  }
  if (!value) return null;
  return { property: m[1]!.toLowerCase(), value, important };
};

/**
 * Best-effort parse of plain CSS into CssDoc.
 * Handles simple `selector { decls }` blocks. Nested braces, @rules, and
 * anything we cannot cleanly split land in freeform (never dropped).
 */
export function parseCss(raw: string): CssDoc {
  if (!raw || !raw.trim()) return emptyDoc();

  const rules: CssRule[] = [];
  const freeParts: string[] = [];
  let i = 0;
  const s = raw;
  let pendingComment: string | undefined;

  while (i < s.length) {
    // skip whitespace
    if (/\s/.test(s[i]!)) {
      i += 1;
      continue;
    }

    // block comment before a rule
    if (s.startsWith("/*", i)) {
      const end = s.indexOf("*/", i + 2);
      if (end === -1) {
        freeParts.push(s.slice(i));
        break;
      }
      const body = s.slice(i + 2, end).trim();
      pendingComment = body || undefined;
      i = end + 2;
      continue;
    }

    // @-rule: keep whole construct in freeform (brace-aware)
    if (s[i] === "@") {
      const start = i;
      while (i < s.length && s[i] !== "{" && s[i] !== ";") i += 1;
      if (s[i] === ";") {
        i += 1;
        freeParts.push(s.slice(start, i).trim());
        pendingComment = undefined;
        continue;
      }
      if (s[i] !== "{") {
        freeParts.push(s.slice(start).trim());
        break;
      }
      let depth = 0;
      for (; i < s.length; i++) {
        if (s[i] === "{") depth += 1;
        else if (s[i] === "}") {
          depth -= 1;
          if (depth === 0) {
            i += 1;
            break;
          }
        }
      }
      freeParts.push(s.slice(start, i).trim());
      pendingComment = undefined;
      continue;
    }

    // selector { ... }
    const brace = s.indexOf("{", i);
    if (brace === -1) {
      freeParts.push(s.slice(i).trim());
      break;
    }
    const selector = s.slice(i, brace).trim();
    // reject if selector looks like nested garbage
    if (!selector || selector.includes("{") || selector.includes("}")) {
      freeParts.push(s.slice(i).trim());
      break;
    }
    let depth = 0;
    let j = brace;
    for (; j < s.length; j++) {
      if (s[j] === "{") depth += 1;
      else if (s[j] === "}") {
        depth -= 1;
        if (depth === 0) {
          j += 1;
          break;
        }
      }
    }
    const block = s.slice(brace + 1, j - 1);
    // nested rules -> freeform whole rule
    if (block.includes("{")) {
      freeParts.push(s.slice(i, j).trim());
      pendingComment = undefined;
      i = j;
      continue;
    }
    const decls: CssDecl[] = [];
    for (const part of block.split(";")) {
      const d = parseDeclLine(`${part.trim()};`);
      if (d) decls.push(d);
    }
    rules.push(makeRule(selector, decls, pendingComment));
    pendingComment = undefined;
    i = j;
  }

  return {
    rules,
    freeform: freeParts.filter(Boolean).join("\n\n"),
  };
}

/** Read a known property from a rule (first match). */
export function getProp(rule: CssRule, property: string): CssDecl | undefined {
  const key = property.toLowerCase();
  return rule.decls.find((d) => d.property === key);
}

/**
 * Set or clear a property on a rule. Empty value removes the decl.
 * Returns a new rule (immutable).
 */
export function setProp(
  rule: CssRule,
  property: string,
  value: string,
  important = false,
): CssRule {
  const key = property.toLowerCase().trim();
  const rest = rule.decls.filter((d) => d.property !== key);
  const v = value.trim();
  if (!v) return { ...rule, decls: rest };
  return {
    ...rule,
    decls: [...rest, { property: key, value: v, important: important || undefined }],
  };
}

/** Replace one rule by id inside a doc. */
export function replaceRule(doc: CssDoc, rule: CssRule): CssDoc {
  return {
    ...doc,
    rules: doc.rules.map((r) => (r.id === rule.id ? rule : r)),
  };
}

/** Append a rule. */
export function appendRule(doc: CssDoc, rule: CssRule): CssDoc {
  return { ...doc, rules: [...doc.rules, rule] };
}

/** Remove rule by id. */
export function removeRule(doc: CssDoc, id: string): CssDoc {
  return { ...doc, rules: doc.rules.filter((r) => r.id !== id) };
}

/**
 * Merge a recipe CSS string into an existing document (append parsed rules + freeform).
 * Does not rewrite existing rules.
 */
export function mergeCss(base: string, addition: string): string {
  const a = addition.trim();
  if (!a) return base;
  const b = base.trim();
  if (!b) return a;
  return `${b}\n\n/* --- starter --- */\n\n${a}`;
}

/** Decl summary for English assist line. */
export function summarizeRule(rule: CssRule): string {
  if (rule.decls.length === 0) return `${rule.selector} { (empty) }`;
  const bits = rule.decls.slice(0, 4).map((d) => {
    const v = d.value.length > 28 ? `${d.value.slice(0, 28)}...` : d.value;
    return `${d.property}: ${v}`;
  });
  const more = rule.decls.length > 4 ? ` +${rule.decls.length - 4} more` : "";
  return `${rule.selector} { ${bits.join("; ")}${more} }`;
}

export { isKnown };
