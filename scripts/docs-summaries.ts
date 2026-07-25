/**
 * Non-networked authoring CLI for semantic documentation sidecars.
 * Modes: inventory | scaffold | stamp | check | queue | review.
 * Discovery is folder-derived (not the generated index).
 * Global check requires current APPROVE receipts; focused --author validates sidecar only.
 * Provenance: audit-plans/07 and 08.
 *
 * bun run docs:summaries:inventory
 * bun run docs:summaries:scaffold -- <doc-id>
 * bun run docs:summaries:stamp -- <doc-id>
 * bun run docs:summaries:check [-- <doc-id>] [--author]
 * bun run docs:summaries:queue -- --target-chars 90000
 * bun run docs:summaries:review -- <doc-id> <APPROVE|REVISE|BLOCK> [--notes "..."] [--reviewer id]
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { discoverDocPages, reviewPathFor, sidecarPathFor, toPosix } from "../src/docs/discover";
import { parseReviewReceipt } from "../src/docs/review-receipt";
import type { SemanticDocSummary, SummaryReviewReceipt, SummaryReviewVerdict } from "../src/docs/summary-types";
import {
  buildReviewReceipt,
  buildSummaryQueue,
  checkPageApproved,
  checkPageAuthor,
  createScaffold,
  formatInventoryReport,
  formatRepairGuidance,
  inventoryCorpus,
  inventoryPage,
  mergeReviewProjection,
  projectionsEqual,
  stampPage,
  type SummaryCorpusPage,
} from "./docs-summaries-core";

const ROOT = join(import.meta.dir, "..");
const DOCS = join(ROOT, "docs");
const QUEUE_PATH = join(DOCS, "generated", "summary-queue.json");
const REVIEW_PATH = join(DOCS, "generated", "summary-review.json");
const DEFAULT_TARGET_CHARS = 90_000;

const argv = process.argv.slice(2);
const mode = argv[0] ?? "inventory";

function readSidecar(abs: string): SemanticDocSummary | null {
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, "utf8")) as SemanticDocSummary;
  } catch {
    return null;
  }
}

function readReview(abs: string): {
  raw: unknown | null;
  receipt: SummaryReviewReceipt | null;
  parseError?: string;
} {
  if (!existsSync(abs)) return { raw: null, receipt: null };
  try {
    const raw: unknown = JSON.parse(readFileSync(abs, "utf8"));
    const receipt = parseReviewReceipt(raw);
    if (!receipt) {
      return {
        raw,
        receipt: null,
        parseError: `malformed review receipt ${toPosix(relative(ROOT, abs))}`,
      };
    }
    return { raw, receipt };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      raw: null,
      receipt: null,
      parseError: `unreadable review receipt ${toPosix(relative(ROOT, abs))}: ${message}`,
    };
  }
}

/** Folder-derived corpus: every Markdown page under docs/, independent of docs-index.json. */
function loadCorpus(): SummaryCorpusPage[] {
  return discoverDocPages(DOCS).map(({ record, markdown }) => {
    const relSidecar = sidecarPathFor(record.path);
    const relReview = reviewPathFor(record.path);
    const review = readReview(join(ROOT, relReview));
    return {
      record,
      markdown,
      sidecarPath: relSidecar,
      reviewPath: relReview,
      sidecar: readSidecar(join(ROOT, relSidecar)),
      reviewRaw: review.raw,
      review: review.receipt,
      reviewParseError: review.parseError,
    };
  });
}

function findPage(pages: SummaryCorpusPage[], docId: string): SummaryCorpusPage {
  const page = pages.find((p) => p.record.id === docId);
  if (!page) {
    throw new Error(`docs-summaries: unknown doc id ${docId}`);
  }
  return page;
}

function writeJson(abs: string, value: unknown): void {
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseFlag(name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx === -1) return undefined;
  return argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return argv.includes(name);
}

function requirePositional(start: number, label: string): string {
  const value = argv[start];
  if (!value || value.startsWith("--")) {
    throw new Error(`docs-summaries: missing ${label}`);
  }
  return value;
}

function listExtraJson(
  expected: Set<string>,
  root: string,
): string[] {
  if (!existsSync(root)) return [];
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      const st = statSync(abs);
      if (st.isDirectory()) walk(abs);
      else if (name.endsWith(".json")) {
        const rel = toPosix(relative(ROOT, abs));
        if (!expected.has(rel)) found.push(rel);
      }
    }
  };
  walk(root);
  return found;
}

function readTextIfExists(abs: string): string | null {
  if (!existsSync(abs)) return null;
  return readFileSync(abs, "utf8");
}

function queueTargetChars(): number {
  const existing = readTextIfExists(QUEUE_PATH);
  if (existing) {
    try {
      const parsed = JSON.parse(existing) as { targetChars?: number };
      if (typeof parsed.targetChars === "number" && parsed.targetChars >= 1) {
        return parsed.targetChars;
      }
    } catch {
      // fall through
    }
  }
  return DEFAULT_TARGET_CHARS;
}

try {
  const pages = loadCorpus();

  if (mode === "inventory") {
    console.log(formatInventoryReport(inventoryCorpus(pages)));
    process.exit(0);
  }

  if (mode === "scaffold") {
    const docId = requirePositional(1, "doc-id");
    const page = findPage(pages, docId);
    const scaffold = createScaffold(page.record, page.markdown, page.sidecar);
    writeJson(join(ROOT, page.sidecarPath), scaffold);
    console.log(`docs-summaries:scaffold wrote ${page.sidecarPath} (${scaffold.sections.length} H2 sections)`);
    process.exit(0);
  }

  if (mode === "stamp") {
    const docId = requirePositional(1, "doc-id");
    const page = findPage(pages, docId);
    const stamped = stampPage(page.record, page.markdown, page.sidecar);
    writeJson(join(ROOT, page.sidecarPath), stamped.summary);
    if (stamped.changed.length === 0) {
      console.log(`docs-summaries:stamp ${docId}: hashes already current`);
    } else {
      console.log(`docs-summaries:stamp ${docId}: refreshed ${stamped.changed.join(", ")}`);
      console.log("docs-summaries:stamp: prior approval is invalid until a new independent review");
    }
    process.exit(0);
  }

  if (mode === "check") {
    const focused = argv[1] && !argv[1].startsWith("--") ? argv[1] : undefined;
    const targets = focused ? [findPage(pages, focused)] : pages;
    let failed = 0;
    const maxRepair = 12;
    let repairPrinted = 0;

    if (!focused) {
      const expectedSidecars = new Set(pages.map((p) => p.sidecarPath));
      const expectedReviews = new Set(pages.map((p) => p.reviewPath));
      const extras = [
        ...listExtraJson(expectedSidecars, join(DOCS, "summaries")).map((p) => `sidecar ${p}`),
        ...listExtraJson(expectedReviews, join(DOCS, "summary-reviews")).map((p) => `receipt ${p}`),
      ];
      if (extras.length > 0) {
        failed += 1;
        console.error(`docs-summaries:check: extra files: ${extras.join(", ")}`);
      }

      // Projection freshness: queue + review status must match folder-derived state.
      const generated = new Date().toISOString().slice(0, 10);
      const expectedQueue = buildSummaryQueue(pages, queueTargetChars(), generated);
      const expectedReview = mergeReviewProjection(pages, generated);
      if (!projectionsEqual(expectedQueue, readTextIfExists(QUEUE_PATH))) {
        failed += 1;
        console.error("docs-summaries:check: docs/generated/summary-queue.json is stale");
        console.error("  repair: bun run docs:summaries:queue -- --target-chars "
          + `${expectedQueue.targetChars}`);
      }
      if (!projectionsEqual(expectedReview, readTextIfExists(REVIEW_PATH))) {
        failed += 1;
        console.error("docs-summaries:check: docs/generated/summary-review.json is stale");
        console.error(
          "  repair: bun run docs:summaries:queue -- --target-chars "
          + `${expectedQueue.targetChars}`,
        );
      }
    }

    // Focused check validates the sidecar for authoring.
    // Global check requires every page APPROVED and current projections.
    const useAuthor = Boolean(focused) || hasFlag("--author");

    for (const page of targets) {
      const check = useAuthor ? checkPageAuthor(page) : checkPageApproved(page);
      if (!check.ok) {
        failed += 1;
        const inv = inventoryPage(page);
        console.error(`docs-summaries:check FAIL ${page.record.id} [${inv.status}]`);
        for (const issue of check.issues.filter((i) => i.severity === "error").slice(0, 8)) {
          console.error(`  [${issue.code}] ${issue.message}`);
        }
        if (repairPrinted < maxRepair) {
          for (const line of formatRepairGuidance(inv)) {
            console.error(`  ${line}`);
          }
          repairPrinted += 1;
        }
      } else {
        const warnings = check.issues.filter((i) => i.severity === "warning");
        if (warnings.length > 0) {
          console.log(`docs-summaries:check OK ${page.record.id} (${warnings.length} warnings)`);
        } else if (focused) {
          console.log(`docs-summaries:check OK ${page.record.id}`);
        }
      }
    }

    if (failed > 0) {
      if (repairPrinted >= maxRepair) {
        console.error("docs-summaries:check: more failures truncated; run docs:summaries:inventory");
      }
      console.error(`docs-summaries:check: ${failed} failure(s)`);
      process.exit(1);
    }
    console.log(
      focused
        ? `docs-summaries:check: ${focused} is author-valid (sidecar complete and fresh)`
        : `docs-summaries:check: ${targets.length} pages approved and projections current`,
    );
    process.exit(0);
  }

  if (mode === "queue") {
    const targetRaw = parseFlag("--target-chars") ?? String(DEFAULT_TARGET_CHARS);
    const targetChars = Number(targetRaw);
    if (!Number.isFinite(targetChars) || targetChars < 1) {
      throw new Error("docs-summaries: --target-chars must be a positive number");
    }
    const generated = new Date().toISOString().slice(0, 10);
    const queue = buildSummaryQueue(pages, targetChars, generated);
    writeJson(QUEUE_PATH, queue);
    // Keep review projection aligned whenever the queue is regenerated.
    writeJson(REVIEW_PATH, mergeReviewProjection(pages, generated));
    console.log(
      `docs-summaries:queue wrote docs/generated/summary-queue.json: `
      + `${queue.totalPages} pages, ${queue.totalSourceChars} chars, ${queue.batches.length} batches`,
    );
    process.exit(0);
  }

  if (mode === "review") {
    const docId = requirePositional(1, "doc-id");
    const verdictRaw = requirePositional(2, "verdict").toUpperCase();
    if (verdictRaw !== "APPROVE" && verdictRaw !== "REVISE" && verdictRaw !== "BLOCK") {
      throw new Error("docs-summaries: verdict must be APPROVE|REVISE|BLOCK");
    }
    const verdict = verdictRaw as SummaryReviewVerdict;
    const notes = parseFlag("--notes") ?? "";
    const reviewer = parseFlag("--reviewer") ?? process.env.DOCS_SUMMARY_REVIEWER ?? "independent-reviewer";
    const page = findPage(pages, docId);
    const receipt = buildReviewReceipt({
      page,
      verdict,
      reviewer,
      notes,
      reviewedAt: new Date().toISOString(),
      existing: page.review,
    });
    writeJson(join(ROOT, page.reviewPath), receipt);
    page.review = receipt;
    page.reviewRaw = receipt;
    page.reviewParseError = undefined;
    const projection = mergeReviewProjection(pages, new Date().toISOString().slice(0, 10));
    writeJson(REVIEW_PATH, projection);
    console.log(`docs-summaries:review ${docId} -> ${verdict} by ${reviewer}`);
    process.exit(0);
  }

  console.error(`docs-summaries: unknown mode ${mode}`);
  process.exit(2);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
}
