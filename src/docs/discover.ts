/**
 * Folder-derived Markdown documentation discovery and base DocRecord construction.
 * Provenance: audit-plans/08-fix-semantic-docs-enforcement.md.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { slugifyHeading } from "./summary-corpus";
import type { DocAnchor, DocRecord } from "./types";

/** Directories under docs/ that are never authored Markdown pages. */
export const DOCS_SKIP_DIRS = new Set([
  "generated",
  "media",
  "summaries",
  "summary-reviews",
]);

export const toPosix = (p: string): string => p.split("\\").join("/");

/** Walk docsRoot for .md files, skipping DOCS_SKIP_DIRS. Returns absolute paths, sorted. */
export function walkDocsMarkdown(
  docsRoot: string,
  skipDirs: ReadonlySet<string> = DOCS_SKIP_DIRS,
): string[] {
  const acc: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      const st = statSync(abs);
      if (st.isDirectory()) {
        if (!skipDirs.has(name)) walk(abs);
      } else if (name.endsWith(".md")) {
        acc.push(abs);
      }
    }
  };
  walk(docsRoot);
  return acc.sort((a, b) => toPosix(a).localeCompare(toPosix(b)));
}

/** Split a leading `---` frontmatter block from the body. */
export function splitFrontmatter(text: string): [string | null, string] {
  if (!text.startsWith("---")) return [null, text];
  const end = text.indexOf("\n---", 3);
  if (end === -1) return [null, text];
  const fmEnd = text.indexOf("\n", end + 1);
  return [text.slice(text.indexOf("\n") + 1, end), text.slice(fmEnd + 1)];
}

/** Tiny YAML-subset parser for flat frontmatter: `key: scalar` and `key: [a, b, c]`. */
export function parseFrontmatter(fm: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const line of fm.split("\n")) {
    const m = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!;
    const raw = m[2]!.trim();
    if (raw.startsWith("[") && raw.endsWith("]")) {
      out[key] = raw
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      out[key] = raw.replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

/** Nested H2/H3 anchors from body prose (no semantic summaries). Unique GitHub-style slugs. */
export function structuralAnchors(body: string): DocAnchor[] {
  const out: DocAnchor[] = [];
  const slugSeen = new Map<string, number>();
  let inFence = false;
  for (const line of body.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const base = slugifyHeading(m[2]!);
    const prior = slugSeen.get(base) ?? 0;
    slugSeen.set(base, prior + 1);
    const slug = prior === 0 ? base : `${base}-${prior}`;
    const level = m[1]!.length as 2 | 3;
    out.push({ text: m[2]!, slug, level, summary: "", topics: [], children: [] });
  }
  const nested: DocAnchor[] = [];
  for (const anchor of out) {
    if (anchor.level === 2) {
      nested.push(anchor);
    } else {
      const parent = nested[nested.length - 1];
      if (parent) parent.children.push(anchor);
      else nested.push(anchor);
    }
  }
  return nested;
}

const firstHeading = (body: string): string => {
  const m = /^#\s+(.+?)\s*$/m.exec(body);
  return m ? m[1]!.trim() : "";
};

function firstParagraph(body: string): string {
  const lines = body.split("\n");
  let seenH1 = false;
  const buf: string[] = [];
  for (const line of lines) {
    if (/^#\s+/.test(line)) {
      seenH1 = true;
      continue;
    }
    if (!seenH1) continue;
    if (line.trim() === "") {
      if (buf.length) break;
      continue;
    }
    if (/^[#>`|-]/.test(line.trim())) continue;
    buf.push(line.trim());
    if (buf.join(" ").length > 200) break;
  }
  return buf.join(" ").slice(0, 240);
}

/**
 * Build a structural DocRecord from a docs-relative path and Markdown source.
 * `relFromDocs` is like `guide/importing.md` (no docs/ prefix).
 * Semantic fields stay empty until an approved sidecar is merged.
 */
export function baseDocRecord(relFromDocs: string, markdown: string): DocRecord {
  const rel = toPosix(relFromDocs).replace(/^docs\//, "");
  if (!rel.endsWith(".md")) {
    throw new Error(`discover: expected .md path, got ${relFromDocs}`);
  }
  const [fmText, body] = splitFrontmatter(markdown);
  const fm = fmText ? parseFrontmatter(fmText) : {};
  const asStr = (v: string | string[] | undefined): string =>
    Array.isArray(v) ? v[0] ?? "" : (v ?? "");
  const asArr = (v: string | string[] | undefined): string[] =>
    Array.isArray(v) ? v : v ? [v] : [];
  const id = asStr(fm.id) || rel.replace(/\.md$/, "");
  const audience = asStr(fm.audience) || (rel.startsWith("guide/") ? "user" : "dev");
  return {
    id,
    path: `docs/${rel}`,
    title: asStr(fm.title) || firstHeading(body) || id,
    audience,
    summary: asStr(fm.summary) || firstParagraph(body),
    tags: asArr(fm.tags),
    related: asArr(fm.related),
    semanticSummary: "",
    topics: [],
    anchors: structuralAnchors(body),
  };
}

export interface DiscoveredDocPage {
  absPath: string;
  record: DocRecord;
  markdown: string;
}

/** Discover every authored Markdown page under docsRoot from the filesystem. */
export function discoverDocPages(docsRoot: string): DiscoveredDocPage[] {
  return walkDocsMarkdown(docsRoot).map((absPath) => {
    const rel = toPosix(relative(docsRoot, absPath));
    const markdown = readFileSync(absPath, "utf8");
    return {
      absPath,
      record: baseDocRecord(rel, markdown),
      markdown,
    };
  });
}

/** docs/foo/bar.md -> docs/summaries/foo/bar.json */
export function sidecarPathFor(sourcePath: string): string {
  if (!sourcePath.startsWith("docs/") || !sourcePath.endsWith(".md")) {
    throw new Error(`discover: invalid source path ${sourcePath}`);
  }
  return `docs/summaries/${sourcePath.slice("docs/".length, -".md".length)}.json`;
}

/** docs/foo/bar.md -> docs/summary-reviews/foo/bar.json */
export function reviewPathFor(sourcePath: string): string {
  if (!sourcePath.startsWith("docs/") || !sourcePath.endsWith(".md")) {
    throw new Error(`discover: invalid source path ${sourcePath}`);
  }
  return `docs/summary-reviews/${sourcePath.slice("docs/".length, -".md".length)}.json`;
}
