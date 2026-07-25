/**
 * Emit the docs retrieval catalog from the docs corpus: docs/generated/docs-index.json,
 * docs/llms.txt, and docs/generated/PAGE-INDEX.md.
 * Semantic sidecars merge only when the sidecar and a current APPROVE receipt both validate.
 * Discovery is folder-derived (shared with docs-summaries).
 *
 * Run:   bun run scripts/docs-index.ts
 * Check: bun run scripts/docs-index.ts --check
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  discoverDocPages,
  reviewPathFor,
  sidecarPathFor,
  toPosix,
} from "../src/docs/discover";
import { parseReviewReceipt, validateReviewReceipt } from "../src/docs/review-receipt";
import {
  hashSemanticSummary,
  splitDocSections,
  validateSemanticSummary,
} from "../src/docs/summary-corpus";
import type { SemanticDocSummary, SemanticSectionSummary } from "../src/docs/summary-types";
import type { DocAnchor, DocRecord } from "../src/docs/types";
import {
  formatRepairGuidance,
  inventoryPage,
  type SummaryCorpusPage,
} from "./docs-summaries-core";

const ROOT = join(import.meta.dir, "..");
const DOCS = join(ROOT, "docs");
const OUT_DIR = join(DOCS, "generated");
const checkOnly = process.argv.includes("--check");

const sectionToAnchor = (section: SemanticSectionSummary): DocAnchor => ({
  text: section.title,
  slug: section.slug,
  level: section.level,
  summary: section.summary,
  topics: section.topics,
  children: section.children.map(sectionToAnchor),
});

function loadJson(abs: string): unknown | null {
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, "utf8")) as unknown;
  } catch {
    return null;
  }
}

interface MergeResult {
  record: DocRecord;
  page: SummaryCorpusPage;
  merged: boolean;
  incompleteReason: string | null;
}

function buildPage(
  record: DocRecord,
  markdown: string,
): MergeResult {
  const relSidecar = sidecarPathFor(record.path);
  const relReview = reviewPathFor(record.path);
  const sidecarAbs = join(ROOT, relSidecar);
  const reviewAbs = join(ROOT, relReview);

  let sidecar: SemanticDocSummary | null = null;
  let reviewRaw: unknown | null = null;
  let review: ReturnType<typeof parseReviewReceipt> = null;
  let reviewParseError: string | undefined;

  if (existsSync(sidecarAbs)) {
    const raw = loadJson(sidecarAbs);
    if (raw && typeof raw === "object") {
      const parsed = splitDocSections(markdown);
      const valid = validateSemanticSummary(record, parsed, raw);
      if (valid.ok) sidecar = raw as SemanticDocSummary;
    }
  }

  if (existsSync(reviewAbs)) {
    try {
      reviewRaw = JSON.parse(readFileSync(reviewAbs, "utf8")) as unknown;
      review = parseReviewReceipt(reviewRaw);
      if (!review) {
        reviewParseError = `malformed review receipt ${relReview}`;
      }
    } catch (err) {
      reviewParseError = `unreadable review receipt ${relReview}: ${
        err instanceof Error ? err.message : String(err)
      }`;
    }
  }

  const page: SummaryCorpusPage = {
    record,
    markdown,
    sidecarPath: relSidecar,
    reviewPath: relReview,
    sidecar,
    reviewRaw,
    review,
    reviewParseError,
  };

  const inv = inventoryPage(page);
  if (inv.status === "APPROVED" && sidecar) {
    const bound = validateReviewReceipt(review, {
      docId: record.id,
      sourcePath: record.path,
      sourceHash: sidecar.sourceHash,
      semanticSummaryHash: hashSemanticSummary(sidecar),
    });
    if (bound.ok && review?.verdict === "APPROVE") {
      return {
        record: {
          ...record,
          semanticSummary: sidecar.summary,
          topics: sidecar.topics,
          anchors: sidecar.sections.map(sectionToAnchor),
        },
        page,
        merged: true,
        incompleteReason: null,
      };
    }
  }

  // Present invalid sidecar is an incomplete reason, not a silent success.
  let incompleteReason: string | null = null;
  if (existsSync(sidecarAbs) && !sidecar) {
    incompleteReason = "invalid or stale semantic sidecar";
  } else if (inv.status !== "APPROVED") {
    incompleteReason = `status ${inv.status}`;
  }

  return {
    record,
    page,
    merged: false,
    incompleteReason,
  };
}

const discovered = discoverDocPages(DOCS);
const builds = discovered.map(({ record, markdown }) => buildPage(record, markdown));
const records = builds.map((b) => b.record);
const semanticCount = builds.filter((b) => b.merged).length;
const incomplete = builds.filter((b) => !b.merged);

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

function pageIndexMd(): string {
  const lines: string[] = [
    "# Hoplight page index",
    "",
    "Generated catalogue of documentation collections, pages, and nested sections.",
    "Semantic summaries are navigation aids; read the source page before relying on a detail.",
    "Only independently APPROVED semantic sidecars are merged into this catalogue.",
    "",
  ];
  const collectionOf = (r: DocRecord): string => {
    const rel = r.path.replace(/^docs\//, "");
    const slash = rel.lastIndexOf("/");
    return slash === -1 ? "" : rel.slice(0, slash);
  };
  const byCollection = new Map<string, DocRecord[]>();
  for (const r of records) {
    const c = collectionOf(r);
    if (!byCollection.has(c)) byCollection.set(c, []);
    byCollection.get(c)!.push(r);
  }
  const collections = [...byCollection.keys()].sort((a, b) => a.localeCompare(b));
  const writeSections = (anchors: DocAnchor[], depth: number): void => {
    for (const anchor of anchors) {
      const pad = "  ".repeat(depth);
      const label = anchor.level === 3 ? "H3" : "H2";
      lines.push(`${pad}- **${label} ${anchor.text}** (\`${anchor.slug}\`)`);
      if (anchor.summary) lines.push(`${pad}  ${anchor.summary}`);
      if (anchor.children.length > 0) writeSections(anchor.children, depth + 1);
    }
  };
  for (const collection of collections) {
    const title = collection === "" ? "(root)" : collection;
    lines.push(`## ${title}`, "");
    for (const r of byCollection.get(collection)!.sort((a, b) => a.path.localeCompare(b.path))) {
      lines.push(`### ${r.title}`, "");
      lines.push(`- id: \`${r.id}\``);
      lines.push(`- path: \`${r.path}\``);
      const overview = r.semanticSummary || r.summary;
      if (overview) lines.push(`- ${overview}`);
      lines.push("");
      writeSections(r.anchors, 0);
      lines.push("");
    }
  }
  return lines.join("\n");
}

function llmsTxt(): string {
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
  const keys = [...groups.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));

  const blurb =
    records.find((r) => r.path === "docs/README.md")?.summary ||
    "Hoplight is the forge for AI-roleplay content: convert, edit, and ship character cards, lorebooks, personas, and regex sets across formats.";

  const lines: string[] = ["# Hoplight documentation", "", `> ${blurb}`, ""];
  for (const k of keys) {
    lines.push(`## ${prettify(k)}`, "");
    for (const r of groups.get(k)!.sort((a, b) => a.path.localeCompare(b.path))) {
      const pageBlurb = r.summary || r.semanticSummary;
      lines.push(`- [${r.title}](${r.path})${pageBlurb ? ": " + pageBlurb : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

const artifacts: Array<[string, string]> = [
  [join(OUT_DIR, "docs-index.json"), indexJson],
  [join(OUT_DIR, "PAGE-INDEX.md"), pageIndexMd()],
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

if (incomplete.length > 0) {
  console.error(
    `docs-index: ${incomplete.length} page(s) lack approved semantic metadata `
    + `(structural records still emitted; CI must stay red):`,
  );
  for (const item of incomplete.slice(0, 12)) {
    const inv = inventoryPage(item.page);
    console.error(
      `  ${item.record.id}  ${item.record.path}  [${inv.status}]`
      + (item.incompleteReason ? `  ${item.incompleteReason}` : ""),
    );
    for (const line of formatRepairGuidance(inv).slice(0, 8)) {
      console.error(`    ${line}`);
    }
  }
  if (incomplete.length > 12) {
    console.error("  ... run bun run docs:summaries:inventory for the full list");
  }
  stale = true;
}

if (checkOnly) {
  if (stale) {
    console.error(
      "docs-index:check: fix incomplete pages (scaffold/author/stamp/review), then "
      + "`bun run docs:index` and commit.",
    );
    process.exit(1);
  }
  console.log(
    `docs-index:check: catalog is current (${semanticCount}/${records.length} approved semantic)`,
  );
} else if (incomplete.length > 0) {
  console.error(
    `wrote docs catalog with ${records.length} pages but ${incomplete.length} incomplete; `
    + "docs-index:check will fail until they are APPROVED.",
  );
  process.exit(1);
} else {
  const byAud = records.reduce<Record<string, number>>(
    (a, r) => ((a[r.audience] = (a[r.audience] ?? 0) + 1), a),
    {},
  );
  console.log(
    `wrote docs/generated/docs-index.json + PAGE-INDEX.md + docs/llms.txt: ${records.length} pages `
    + `(${Object.entries(byAud).map(([k, v]) => `${v} ${k}`).join(", ")}), `
    + `${semanticCount} approved semantic`,
  );
}
