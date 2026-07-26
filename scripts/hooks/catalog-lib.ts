/**
 * Pure extraction logic for the component catalog (component-catalog.ts's functional core). Given a
 * file's path and its source text, finds exported UI entries: React components (any .tsx export whose
 * name starts uppercase and is typed or shaped as a component) and shared UI helpers (exported
 * create/build/swatch/inject functions under src/ui/_shared). No fs, no
 * TypeScript compiler: a crude text scan over our own small, well-formed source, same doctrine as
 * scripts/hooks/lib.ts. component-catalog.ts is the imperative shell that walks the tree and writes
 * docs/reference/components.md from these entries.
 */

export interface CatalogEntry {
  name: string;
  file: string;
  kind: "component" | "shared-helper";
  /** props type text or param list, single line, truncated */
  signature: string;
  /** first line of the preceding /** *\/ block, "" if none */
  doc: string;
  /** class names of the colocated *.module.css (walkable styles: the shell attaches these) */
  styles?: string[];
}

/** Class names declared in a CSS Modules source, in first-appearance order, deduped. Pure text
 * scan (same crude-but-sufficient doctrine as the component extraction): a selector's `.name`
 * counts; names inside comments do not. Makes stylesheets walkable the same way components are. */
export function cssClassNames(cssSource: string): string[] {
  const clean = cssSource.replace(/\/\*[\s\S]*?\*\//g, " ");
  const out: string[] = [];
  const seen = new Set<string>();
  // any `.name` token: chained selectors (.dot.full) count too; the letter-first rule keeps
  // decimals (.45) out. url()/content false positives are tolerable noise for a discovery index.
  const re = /\.([A-Za-z_][\w-]*)/g;
  for (let m = re.exec(clean); m; m = re.exec(clean)) {
    const name = m[1]!;
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

const norm = (path: string): string => path.replace(/\\/g, "/");

const SHARED_HELPER_NAME_RE = /^(create|build|swatch|inject)[A-Z]/;
const UPPER_NAME_RE = /^[A-Z]/;
const COMPONENT_TYPE_RE = /\bFC\s*<|\bFunctionComponent\s*<|JSX\.Element|React\.ReactElement|ReactElement|ReactNode/;

const SIG_MAX = 120;

/** Strip inline block/line comments (a multi-line param list often carries per-field doc comments
 * that read as noise once collapsed to one line), collapse whitespace, and truncate for a table cell. */
function oneLine(s: string, max = SIG_MAX): string {
  const uncommented = s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, "");
  const flat = uncommented.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 3)}...` : flat;
}

/** Index of the char matching `s[openIdx]` (one of `open`), honoring nesting. -1 if unbalanced. */
function matchClose(s: string, openIdx: number, open: string, close: string): number {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** The preceding doc comment's first content line, walking up from `beforeLineIdx` over blank lines
 * only (a comment separated by real code is not "the" doc for this export). "" when none. */
function docAbove(lines: string[], beforeLineIdx: number): string {
  let i = beforeLineIdx - 1;
  while (i >= 0 && lines[i]!.trim() === "") i--;
  if (i < 0 || !lines[i]!.trim().endsWith("*/")) return "";
  const end = i;
  while (i >= 0 && !lines[i]!.includes("/**")) i--;
  if (i < 0) return "";
  for (const raw of lines.slice(i, end + 1)) {
    const text = raw
      .trim()
      .replace(/^\/\*\*/, "")
      .replace(/\*\/$/, "")
      .replace(/^\*/, "")
      .trim();
    if (text) return text;
  }
  return "";
}

/** Body text following an arrow's `=>` or a function's opening `{`, for JSX-return sniffing. Reads a
 * bounded slice as a fallback so an unbalanced/huge source never runs away. */
function bodyAt(source: string, start: number): string {
  const c = source[start];
  if (c === "{") {
    const close = matchClose(source, start, "{", "}");
    return close === -1 ? source.slice(start, start + 2000) : source.slice(start, close + 1);
  }
  if (c === "(") {
    const close = matchClose(source, start, "(", ")");
    return close === -1 ? source.slice(start, start + 2000) : source.slice(start, close + 1);
  }
  return source.slice(start, start + 400);
}

const isComponentShaped = (typeText: string, body: string): boolean =>
  COMPONENT_TYPE_RE.test(typeText) || /return\s*\(?\s*</.test(body) || /^\s*</.test(body);

interface ParsedDecl {
  /** param list including parens, e.g. "(props: FooProps)" */
  params: string;
  /** the const's own type annotation before "=" ("" for a function decl or an untyped const) */
  annotation: string;
  /** the declared return type ("" if inferred) */
  returnType: string;
  bodyStart: number;
}

/** Combined type text used for component-shape sniffing (annotation and return type both count). */
const typeTextOf = (d: ParsedDecl): string => [d.annotation, d.returnType].filter(Boolean).join(" ");

/** Find the function body's opening "{" in the text following a param list, skipping over an object
 * return type's own braces (`): { root: HTMLElement } {` is a real shape in this codebase - the type
 * literal's "{" is always preceded by ":", the body's never is). -1 if no body brace is found. */
function findBodyOpen(afterParams: string): number {
  let i = 0;
  for (;;) {
    const rel = afterParams.indexOf("{", i);
    if (rel === -1) return -1;
    let j = rel - 1;
    while (j >= 0 && /\s/.test(afterParams[j]!)) j--;
    if (afterParams[j] !== ":") return rel; // not a type literal: this is the body
    const close = matchClose(afterParams, rel, "{", "}");
    if (close === -1) return -1;
    i = close + 1;
  }
}

/** Parse `export function Name(...): Ret {` starting at the index right after the matched name. */
function parseFunctionDecl(source: string, afterName: number): ParsedDecl | null {
  const openParen = source.indexOf("(", afterName);
  if (openParen === -1) return null;
  const closeParen = matchClose(source, openParen, "(", ")");
  if (closeParen === -1) return null;
  const afterParams = source.slice(closeParen + 1);
  const bodyOpenRel = findBodyOpen(afterParams);
  if (bodyOpenRel === -1) return null;
  return {
    params: source.slice(openParen, closeParen + 1),
    annotation: "",
    returnType: afterParams.slice(0, bodyOpenRel).replace(/^:/, "").trim(),
    bodyStart: closeParen + 1 + bodyOpenRel,
  };
}

/** Parse `export const Name: Type = (...): Ret => {` (or `=> (`) starting after the matched name.
 * Only the parenthesized-params arrow shape is recognized (the house style always types props); any
 * other const value (object, non-arrow) returns null and is not a catalog candidate. */
function parseArrowConst(source: string, afterName: number): ParsedDecl | null {
  const eqIdx = source.indexOf("=", afterName);
  if (eqIdx === -1) return null;
  const annotation = source.slice(afterName, eqIdx).replace(/^:/, "").trim();
  let vi = eqIdx + 1;
  while (/\s/.test(source[vi] ?? "")) vi++;
  if (source[vi] !== "(") return null;
  const closeParen = matchClose(source, vi, "(", ")");
  if (closeParen === -1) return null;
  const afterParams = source.slice(closeParen + 1);
  const arrowRel = afterParams.indexOf("=>");
  if (arrowRel === -1) return null;
  const returnType = afterParams.slice(0, arrowRel).replace(/^:/, "").trim();
  let bi = closeParen + 1 + arrowRel + 2;
  while (/\s/.test(source[bi] ?? "")) bi++;
  return {
    params: source.slice(vi, closeParen + 1),
    annotation,
    returnType,
    bodyStart: bi,
  };
}

const isSharedHelperFile = (file: string): boolean => /(^|\/)src\/ui\/_shared\/[^/]+\.ts$/.test(file);
const isComponentFile = (file: string): boolean => file.endsWith(".tsx");

/**
 * Exported UI entries in one file. `file` should be repo-relative (used both to route shared-helper vs.
 * component rules and to stamp into the entry). Returns [] for files neither rule applies to, and for
 * test files (a *.test.ts(x) carries no catalog surface of its own).
 */
export function extractCatalogEntries(filePath: string, source: string): CatalogEntry[] {
  const file = norm(filePath);
  if (/\.test\.tsx?$/.test(file)) return [];
  const shared = isSharedHelperFile(file);
  const component = isComponentFile(file);
  if (!shared && !component) return [];

  const lines = source.split("\n");
  const lineStarts: number[] = [];
  let acc = 0;
  for (const l of lines) {
    lineStarts.push(acc);
    acc += l.length + 1;
  }
  const lineIndexAt = (pos: number): number => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    let ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lineStarts[mid]! <= pos) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  };

  const entries: CatalogEntry[] = [];
  const seen = new Set<string>();
  const EXPORT_RE = /export\s+(function|const)\s+([A-Za-z_$][\w$]*)/g;
  let m: RegExpExecArray | null;
  while ((m = EXPORT_RE.exec(source))) {
    const [, keyword, name] = m as unknown as [string, "function" | "const", string];
    if (seen.has(name)) continue;
    const afterName = m.index + m[0].length;
    const parsed = keyword === "function" ? parseFunctionDecl(source, afterName) : parseArrowConst(source, afterName);
    if (!parsed) continue;

    const isSharedName = SHARED_HELPER_NAME_RE.test(name);
    const isUpperName = UPPER_NAME_RE.test(name);
    if (shared && isSharedName) {
      seen.add(name);
      entries.push({
        name,
        file,
        kind: "shared-helper",
        signature: oneLine(parsed.params),
        doc: docAbove(lines, lineIndexAt(m.index)),
      });
      continue;
    }
    if (component && isUpperName) {
      const body = bodyAt(source, parsed.bodyStart);
      if (!isComponentShaped(typeTextOf(parsed), body)) continue;
      seen.add(name);
      // an arrow typed as `const X: React.FC<Props> =` names its props type in the annotation, which
      // is more useful than its param list; anything else (including a plain return type like
      // "JSX.Element", which names nothing about the props) falls back to the param list itself.
      const signature = keyword === "const" ? parsed.annotation || parsed.params : parsed.params;
      entries.push({
        name,
        file,
        kind: "component",
        signature: oneLine(signature),
        doc: docAbove(lines, lineIndexAt(m.index)),
      });
    }
  }
  return entries;
}
