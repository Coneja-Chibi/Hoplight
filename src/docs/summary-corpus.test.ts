/**
 * Boundary, hierarchy, hash, staleness, and fail-closed tests for semantic doc summaries.
 */
import { describe, expect, test } from "bun:test";
import type { DocRecord } from "./types";
import {
  hashDocSource,
  hashSectionSource,
  hashSemanticSummary,
  scaffoldSemanticSummary,
  splitDocSections,
  stampSemanticSummary,
  validateSemanticSummary,
} from "./summary-corpus";
import type { SemanticDocSummary } from "./summary-types";

const sample = `---
id: sample
title: Sample
audience: dev
summary: A short frontmatter blurb.
---
# Sample

Intro paragraph before any H2.

## Alpha

Alpha body one.
Alpha body two.

### Alpha child

Child body that matters.

## Beta

Beta only section.

`;

const record: DocRecord = {
  id: "sample",
  path: "docs/sample.md",
  title: "Sample",
  audience: "dev",
  summary: "A short frontmatter blurb.",
  tags: [],
  related: [],
  semanticSummary: "",
  topics: [],
  anchors: [],
};

const fillWords = (n: number, seed = "word"): string =>
  Array.from({ length: n }, (_, i) => `${seed}${i}`).join(" ");

const validSummary = (markdown: string): SemanticDocSummary => {
  const scaffold = scaffoldSemanticSummary(record, markdown);
  return {
    ...scaffold,
    summary: fillWords(150, "page"),
    topics: ["alpha domain", "beta domain", "sample page"],
    sections: scaffold.sections.map((section) => ({
      ...section,
      summary: fillWords(section.level === 2 ? 90 : 50, section.slug.replace(/-/g, "")),
      topics: [`${section.slug} topic`, `${section.slug} alt`],
      children: section.children.map((child) => ({
        ...child,
        summary: fillWords(50, child.slug.replace(/-/g, "")),
        topics: [`${child.slug} topic`, `${child.slug} alt`],
      })),
    })),
  };
};

describe("splitDocSections", () => {
  test("nests H3 under preceding H2 and hashes full H2 range", () => {
    const parsed = splitDocSections(sample);
    expect(parsed.errors).toEqual([]);
    expect(parsed.sections.map((s) => s.slug)).toEqual(["alpha", "beta"]);
    expect(parsed.sections[0]!.children.map((c) => c.slug)).toEqual(["alpha-child"]);
    expect(parsed.sections[0]!.source).toContain("### Alpha child");
    expect(parsed.sections[0]!.source).toContain("Child body that matters.");
    expect(parsed.sections[0]!.children[0]!.source).toContain("Child body that matters.");
    expect(parsed.sections[0]!.children[0]!.source).not.toContain("## Beta");
    expect(parsed.flat.map((s) => s.slug)).toEqual(["alpha", "alpha-child", "beta"]);
  });

  test("skips headings inside fenced code blocks", () => {
    const md = `# Title\n\n## Real\n\n\`\`\`\n## Fake\n\`\`\`\n\n## After\n`;
    const parsed = splitDocSections(md);
    expect(parsed.sections.map((s) => s.slug)).toEqual(["real", "after"]);
  });

  test("rejects H3 before any H2", () => {
    const parsed = splitDocSections("# T\n\n### Early\n\n## Later\n");
    expect(parsed.errors.some((e) => e.includes("H3 before any H2"))).toBe(true);
    expect(parsed.sections).toEqual([]);
  });

  test("disambiguates duplicate heading titles GitHub-style", () => {
    const parsed = splitDocSections("# T\n\n## Same Title\n\n## Same Title\n");
    expect(parsed.errors).toEqual([]);
    expect(parsed.sections.map((s) => s.slug)).toEqual(["same-title", "same-title-1"]);
  });

  test("normalizes CRLF without changing hash semantics of LF content", () => {
    const lf = "# T\n\n## A\n\nbody\n";
    const crlf = lf.replace(/\n/g, "\r\n");
    expect(hashDocSource(lf)).toBe(hashDocSource(crlf));
    const a = splitDocSections(lf).sections[0]!;
    const b = splitDocSections(crlf).sections[0]!;
    expect(hashSectionSource(a)).toBe(hashSectionSource(b));
  });
});

describe("hash freshness", () => {
  test("appending a final H3 paragraph invalidates H3, parent H2, and page hashes", () => {
    const before = splitDocSections(sample);
    const afterMd = sample.replace("Child body that matters.", "Child body that matters.\nExtra tail sentence.");
    const after = splitDocSections(afterMd);
    expect(hashDocSource(before.normalized)).not.toBe(hashDocSource(after.normalized));
    expect(hashSectionSource(before.sections[0]!)).not.toBe(hashSectionSource(after.sections[0]!));
    expect(hashSectionSource(before.sections[0]!.children[0]!))
      .not.toBe(hashSectionSource(after.sections[0]!.children[0]!));
    expect(hashSectionSource(before.sections[1]!)).toBe(hashSectionSource(after.sections[1]!));
  });
});

describe("validateSemanticSummary", () => {
  test("accepts a complete fresh sidecar", () => {
    const parsed = splitDocSections(sample);
    const result = validateSemanticSummary(record, parsed, validSummary(sample));
    expect(result.ok).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  test("fails on stale page hash", () => {
    const parsed = splitDocSections(sample);
    const bad = validSummary(sample);
    bad.sourceHash = "sha256:" + "0".repeat(64);
    const result = validateSemanticSummary(record, parsed, bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "page-stale")).toBe(true);
  });

  test("fails on missing or reordered sections", () => {
    const parsed = splitDocSections(sample);
    const bad = validSummary(sample);
    bad.sections = [bad.sections[1]!, bad.sections[0]!];
    const result = validateSemanticSummary(record, parsed, bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "section-slug")).toBe(true);
  });

  test("fails on empty summaries", () => {
    const parsed = splitDocSections(sample);
    const scaffold = scaffoldSemanticSummary(record, sample);
    const result = validateSemanticSummary(record, parsed, scaffold);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "empty-summary")).toBe(true);
  });

  test("fails on shallow word counts outside the band", () => {
    const parsed = splitDocSections(sample);
    const bad = validSummary(sample);
    bad.summary = "too short";
    const result = validateSemanticSummary(record, parsed, bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "word-band")).toBe(true);
  });

  test("rejects schema versions other than 1", () => {
    const parsed = splitDocSections(sample);
    const bad = { ...validSummary(sample), schemaVersion: 2 };
    const result = validateSemanticSummary(record, parsed, bad);
    expect(result.ok).toBe(false);
  });
});

describe("stampSemanticSummary", () => {
  test("refuses empty summaries and refreshes hashes after edit", () => {
    const scaffold = scaffoldSemanticSummary(record, sample);
    expect(() => stampSemanticSummary(record, sample, scaffold)).toThrow(/empty/);

    const filled = validSummary(sample);
    const edited = sample + "\nTrailing page note.\n";
    const stamped = stampSemanticSummary(record, edited, filled);
    expect(stamped.changed).toContain("(page)");
    const parsed = splitDocSections(edited);
    const result = validateSemanticSummary(record, parsed, stamped.summary);
    // Section structure unchanged; only page hash should need the new page body.
    // Trailing content after last H2 is part of page hash only, not H2 ranges.
    expect(result.ok).toBe(true);
    expect(hashSemanticSummary(stamped.summary)).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  /**
   * THE MID-PAGE INSERTION, which is the failure this refusal exists for.
   *
   * The section lookup falls back to POSITION when no slug matches, and stamping used to overwrite
   * slug and title from the document - so inserting one heading rebranded every later summary onto
   * its neighbour, and `check` then passed because stamp had already made the titles agree. A
   * real page shipped with one section carrying another section's text.
   */
  test("refuses to stamp a summary onto a heading it was not written for", () => {
    const filled = validSummary(sample);
    const inserted = sample.replace("## Beta", "## Inserted\n\nNew body.\n\n## Beta");
    expect(() => stampSemanticSummary(record, inserted, filled))
      .toThrow(/refuse to restamp/);
  });

  test("names both titles, so a rename and a shift can be told apart", () => {
    const filled = validSummary(sample);
    const renamed = sample.replace("## Beta", "## Beta renamed");
    try {
      stampSemanticSummary(record, renamed, filled);
      throw new Error("expected a refusal");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).toContain("Beta");
      expect(msg).toContain("Beta renamed");
    }
  });
});
