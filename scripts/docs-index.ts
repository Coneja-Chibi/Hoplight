/**
 * Emit the docs retrieval catalog from the docs corpus, so a future in-app agent can find and answer
 * from the docs: docs/generated/docs-index.json (one record per page: id, audience, summary, tags,
 * related, heading anchors) plus docs/llms.txt (the llmstxt.org index: title, blurb, per-section links).
 * Frontmatter is the source of truth; pages without it fall back to path-derived id and the first
 * heading/paragraph, so the whole corpus is covered. Same docs-as-code contract as docs-fields.ts.
 *
 * Run:   bun run scripts/docs-index.ts
 * Check: bun run scripts/docs-index.ts --check   (fail if committed output differs)
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const DOCS = join(ROOT, "docs");
const OUT_DIR = join(DOCS, "generated");
const checkOnly = process.argv.includes("--check");

// Corpus = every .md under docs/ except the generated tables and the media folder.
const SKIP_DIRS = new Set(["generated", "media"]);

interface Anchor {
  text: string;
  slug: string;
  level: number;
}
interface DocRecord {
  id: string;
  path: string;
  title: string;
  audience: string;
  summary: string;
  tags: string[];
  related: string[];
  anchors: Anchor[];
}

/** GitHub-style heading slug: lowercase, drop punctuation, spaces to hyphens. */
const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

const toPosix = (p: string): string => p.split("\\").join("/");

function walk(dir: string, acc: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(abs, acc);
    } else if (name.endsWith(".md")) {
      acc.push(abs);
    }
  }
  return acc;
}

/** Split a leading `---` frontmatter block from the body. Returns [frontmatterText|null, body]. */
function splitFrontmatter(text: string): [string | null, string] {
  if (!text.startsWith("---")) return [null, text];
  const end = text.indexOf("\n---", 3);
  if (end === -1) return [null, text];
  const fmEnd = text.indexOf("\n", end + 1);
  return [text.slice(text.indexOf("\n") + 1, end), text.slice(fmEnd + 1)];
}

/** Tiny YAML-subset parser for our flat frontmatter: `key: scalar` and `key: [a, b, c]`. */
function parseFrontmatter(fm: string): Record<string, string | string[]> {
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

/** Heading anchors from the body, skipping fenced code blocks. */
function anchorsOf(body: string): Anchor[] {
  const out: Anchor[] = [];
  let inFence = false;
  for (const line of body.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (m) out.push({ text: m[2]!, slug: slugify(m[2]!), level: m[1]!.length });
  }
  return out;
}

const firstHeading = (body: string): string => {
  const m = /^#\s+(.+?)\s*$/m.exec(body);
  return m ? m[1]!.trim() : "";
};

/** First real paragraph after the H1: a fallback summary for pages with no frontmatter summary. */
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
    if (/^[#>`|-]/.test(line.trim())) continue; // skip headings/quotes/tables/lists/fences
    buf.push(line.trim());
    if (buf.join(" ").length > 200) break;
  }
  return buf.join(" ").slice(0, 240);
}

function recordFor(abs: string): DocRecord {
  const rel = toPosix(relative(DOCS, abs));
  const text = readFileSync(abs, "utf8");
  const [fmText, body] = splitFrontmatter(text);
  const fm = fmText ? parseFrontmatter(fmText) : {};
  const asStr = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? "" : (v ?? ""));
  const asArr = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);
  const id = asStr(fm.id) || rel.replace(/\.md$/, "");
  const audience = asStr(fm.audience) || (rel.startsWith("guide/") ? "user" : "dev");
  return {
    id,
    path: "docs/" + rel,
    title: asStr(fm.title) || firstHeading(body) || id,
    audience,
    summary: asStr(fm.summary) || firstParagraph(body),
    tags: asArr(fm.tags),
    related: asArr(fm.related),
    anchors: anchorsOf(body),
  };
}

const files = walk(DOCS, []).sort();
const records = files.map(recordFor);

const indexJson =
  JSON.stringify(
    {
      generated: new Date().toISOString().slice(0, 10),
      count: records.length,
      docs: records,
    },
    null,
    2,
  ) + "\n";

// llms.txt (llmstxt.org): sections are DERIVED from the directory tree (folders-as-schema), so adding
// or removing a doc or a whole doc folder flows through with nothing to maintain by hand. The site
// blurb comes from docs/README.md's summary when present.
function llmsTxt(): string {
  // Section = first path segment under docs/ ("" means a root-level docs file).
  const sectionOf = (r: DocRecord): string => {
    const seg = r.path.replace(/^docs\//, "").split("/");
    return seg.length > 1 ? seg[0]! : "";
  };
  const prettify = (dir: string): string =>
    dir === "" ? "Top level" : dir.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

  const groups = new Map<string, DocRecord[]>();
  for (const r of records) {
    const k = sectionOf(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  // Alphabetical, root-level files last: a stable order that needs no per-section upkeep.
  const keys = [...groups.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));

  const blurb =
    records.find((r) => r.path === "docs/README.md")?.summary ||
    "Hoplight is the forge for AI-roleplay content: convert, edit, and ship character cards, lorebooks, personas, and regex sets across formats.";

  const lines: string[] = ["# Hoplight documentation", "", `> ${blurb}`, ""];
  for (const k of keys) {
    lines.push(`## ${prettify(k)}`, "");
    for (const r of groups.get(k)!.sort((a, b) => a.path.localeCompare(b.path))) {
      lines.push(`- [${r.title}](${r.path})${r.summary ? ": " + r.summary : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

const artifacts: Array<[string, string]> = [
  [join(OUT_DIR, "docs-index.json"), indexJson],
  [join(DOCS, "llms.txt"), llmsTxt()],
];

let stale = false;
for (const [path, body] of artifacts) {
  if (checkOnly) {
    let existing = "";
    try {
      existing = readFileSync(path, "utf8");
    } catch {
      console.error(`docs-index:check: missing ${toPosix(relative(ROOT, path))}`);
      stale = true;
      continue;
    }
    const norm = (s: string): string => s.replace(/"generated": ".+"/, '"generated": "<date>"');
    if (norm(existing) !== norm(body)) {
      console.error(`docs-index:check: ${toPosix(relative(ROOT, path))} is stale`);
      stale = true;
    }
  } else {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(path, body, "utf8");
  }
}

if (checkOnly) {
  if (stale) {
    console.error("docs-index:check: run `bun run scripts/docs-index.ts` and commit.");
    process.exit(1);
  }
  console.log("docs-index:check: catalog is current");
} else {
  const byAud = records.reduce<Record<string, number>>((a, r) => ((a[r.audience] = (a[r.audience] ?? 0) + 1), a), {});
  console.log(
    `wrote docs/generated/docs-index.json + docs/llms.txt: ${records.length} pages ` +
      `(${Object.entries(byAud).map(([k, v]) => `${v} ${k}`).join(", ")}), ` +
      `${records.reduce((n, r) => n + r.anchors.length, 0)} anchors`,
  );
}
