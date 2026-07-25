/**
 * Folder-derived docs discovery: new pages without a generated index, exclusions, sidecar paths.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  baseDocRecord,
  discoverDocPages,
  DOCS_SKIP_DIRS,
  reviewPathFor,
  sidecarPathFor,
  walkDocsMarkdown,
} from "./discover";

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const tempDocs = (): string => {
  const root = mkdtempSync(join(tmpdir(), "hoplight-docs-"));
  temps.push(root);
  return root;
};

describe("discoverDocPages", () => {
  test("discovers a new Markdown page absent from any generated index", () => {
    const docs = tempDocs();
    writeFileSync(join(docs, "example.md"), "# Example\n\n## One\n\nBody.\n", "utf8");
    mkdirSync(join(docs, "generated"), { recursive: true });
    writeFileSync(
      join(docs, "generated", "docs-index.json"),
      JSON.stringify({ generated: "2026-07-25", count: 0, docs: [] }),
      "utf8",
    );
    const pages = discoverDocPages(docs);
    expect(pages.map((p) => p.record.id)).toEqual(["example"]);
    expect(pages[0]!.record.path).toBe("docs/example.md");
    expect(sidecarPathFor(pages[0]!.record.path)).toBe("docs/summaries/example.json");
    expect(reviewPathFor(pages[0]!.record.path)).toBe("docs/summary-reviews/example.json");
  });

  test("excludes generated, media, summaries, and summary-reviews folders", () => {
    const docs = tempDocs();
    writeFileSync(join(docs, "real.md"), "# Real\n", "utf8");
    for (const skip of DOCS_SKIP_DIRS) {
      mkdirSync(join(docs, skip), { recursive: true });
      writeFileSync(join(docs, skip, "hidden.md"), "# Hidden\n", "utf8");
    }
    const paths = walkDocsMarkdown(docs);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.endsWith("real.md")).toBe(true);
    expect(discoverDocPages(docs).map((p) => p.record.id)).toEqual(["real"]);
  });

  test("baseDocRecord derives id, audience, and nested anchors from source alone", () => {
    const md = `---
id: guide/demo
title: Demo
audience: user
summary: Short blurb.
---
# Demo

## Alpha

### Nested

Text.
`;
    const record = baseDocRecord("guide/demo.md", md);
    expect(record.id).toBe("guide/demo");
    expect(record.path).toBe("docs/guide/demo.md");
    expect(record.audience).toBe("user");
    expect(record.semanticSummary).toBe("");
    expect(record.anchors.map((a) => a.slug)).toEqual(["alpha"]);
    expect(record.anchors[0]!.children.map((c) => c.slug)).toEqual(["nested"]);
  });
});
