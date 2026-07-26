/**
 * Inventory reporting and status-specific repair guidance for semantic docs.
 */
import type { CorpusInventory, PageInventory, SummaryCorpusPage } from "./docs-summaries-core";
import { inventoryPage } from "./docs-summaries-core";

/** Stable JSON for projection equality (ignores generated date field when comparing). */
export function normalizeProjectionJson(text: string): string {
  return text
    .replace(/"generated"\s*:\s*"[^"]*"/g, '"generated":"<date>"')
    .replace(/\r\n/g, "\n");
}

export function projectionsEqual(expected: unknown, existingText: string | null): boolean {
  if (existingText === null) return false;
  const expectedText = `${JSON.stringify(expected, null, 2)}\n`;
  return normalizeProjectionJson(existingText) === normalizeProjectionJson(expectedText);
}

/**
 * Status-specific repair workflow for one page. Uses real ids and paths.
 * Never recommends blind stamping without reading changed source.
 */
export function formatRepairGuidance(page: PageInventory): string[] {
  const id = page.docId;
  const lines: string[] = [`repair ${id} (${page.status}):`];
  switch (page.status) {
    case "TODO":
      lines.push(
        `  1. bun run docs:summaries:scaffold -- ${id}`,
        `  2. Author page + every H2/H3 summary in ${page.sidecarPath}`,
        `  3. bun run docs:summaries:stamp -- ${id}`,
        `  4. bun run docs:summaries:check -- ${id} --author`,
        `  5. Independent review (author must not self-review):`,
        `     bun run docs:summaries:review -- ${id} APPROVE --notes "..." --reviewer <id>`,
      );
      break;
    case "IN_PROGRESS":
      lines.push(
        `  1. Edit incomplete or invalid summaries in ${page.sidecarPath}`,
        `  2. Read the complete source ${page.sourcePath} for affected sections`,
        `  3. bun run docs:summaries:stamp -- ${id}`,
        `  4. bun run docs:summaries:check -- ${id} --author`,
        `  5. Independent review: bun run docs:summaries:review -- ${id} APPROVE --notes "..." --reviewer <id>`,
      );
      break;
    case "READY_FOR_REVIEW":
      lines.push(
        `  Sidecar is complete and fresh; approval is missing, stale, or not APPROVE.`,
        `  Author must not self-review. Independent reviewer:`,
        `  bun run docs:summaries:review -- ${id} APPROVE --notes "..." --reviewer <id>`,
      );
      if (page.stale) {
        lines.push(
          `  Note: hashes/receipt are stale. First re-read changed ranges in ${page.sourcePath},`,
          `  update affected summaries in ${page.sidecarPath}, then stamp and re-validate:`,
          `  bun run docs:summaries:stamp -- ${id}`,
          `  bun run docs:summaries:check -- ${id} --author`,
          `  Do not stamp without reviewing prose.`,
        );
      }
      break;
    case "REVISE":
    case "BLOCKED": {
      const notes = page.issues
        .filter((i) => i.code.startsWith("receipt") || i.severity === "error")
        .slice(0, 4)
        .map((i) => `  - ${i.message}`);
      lines.push(
        `  Correct the sidecar/source, stamp, author-check, then re-review.`,
        ...notes,
        `  bun run docs:summaries:stamp -- ${id}`,
        `  bun run docs:summaries:check -- ${id} --author`,
        `  bun run docs:summaries:review -- ${id} APPROVE --notes "..." --reviewer <id>`,
      );
      break;
    }
    case "APPROVED":
      lines.push("  No repair needed.");
      break;
    default:
      lines.push(`  bun run docs:summaries:inventory`);
  }
  return lines;
}

export function formatInventoryReport(inv: CorpusInventory): string {
  const lines = [
    `docs-summaries inventory: ${inv.pages.length} pages`,
    `  TODO=${inv.todo} IN_PROGRESS=${inv.inProgress} READY_FOR_REVIEW=${inv.readyForReview} APPROVED=${inv.approved} REVISE=${inv.revise} BLOCKED=${inv.blocked}`,
    `  missing=${inv.missing} stale=${inv.stale} invalid=${inv.invalid} warnings=${inv.warnings}`,
  ];
  for (const page of inv.pages) {
    if (page.status === "APPROVED" && page.issues.filter((i) => i.severity === "error").length === 0) {
      if (page.reviewWarnings === 0) continue;
    }
    const flags = [
      page.missingSidecar ? "missing" : "",
      page.stale ? "stale" : "",
      page.invalid ? "invalid" : "",
      page.reviewWarnings > 0 ? `warn:${page.reviewWarnings}` : "",
    ].filter(Boolean).join(",");
    lines.push(`  ${page.status.padEnd(16)} ${page.docId}  sections=${page.sectionCount}  ${flags}`);
    for (const issue of page.issues.slice(0, 6)) {
      lines.push(`    [${issue.severity}] ${issue.code}: ${issue.message}`);
    }
  }
  return lines.join("\n");
}

/** True when the page may contribute semantic prose to generated navigation. */
export function isApprovedForMerge(page: SummaryCorpusPage): boolean {
  return inventoryPage(page).status === "APPROVED" && page.sidecar !== null;
}
