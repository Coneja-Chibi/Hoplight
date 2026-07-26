/**
 * Pure Markdown section boundaries, hashing, scaffold, and stamp for semantic docs.
 */
import { createHash } from "node:crypto";
import type { DocRecord } from "./types";
import type { SemanticDocSummary, SemanticSectionSummary } from "./summary-types";

export interface ParsedDocSection {
  slug: string;
  title: string;
  level: 2 | 3;
  /** Inclusive start line index in the normalized line array. */
  startLine: number;
  /** Exclusive end line index. */
  endLine: number;
  /** Normalized LF source covering this section's hash range. */
  source: string;
  children: ParsedDocSection[];
}

export interface ParsedDocSections {
  /** Complete page source with LF line endings only. */
  normalized: string;
  body: string;
  sections: ParsedDocSection[];
  /** Flat H2/H3 in document order (pre-order). */
  flat: ParsedDocSection[];
  errors: string[];
}

/** GitHub-style heading slug: lowercase, drop punctuation, spaces to hyphens. */
export const slugifyHeading = (value: string): string =>
  value
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

/** Normalize to LF only; do not trim prose or strip Markdown. */
export function normalizeDocSource(markdown: string): string {
  return markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function hashDocSource(markdown: string): string {
  const normalized = normalizeDocSource(markdown);
  return `sha256:${createHash("sha256").update(normalized, "utf8").digest("hex")}`;
}

export function hashSectionSource(section: ParsedDocSection): string {
  return hashDocSource(section.source);
}

export function hashSemanticSummary(summary: SemanticDocSummary): string {
  const canonical = JSON.stringify(summary);
  return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

const isFence = (line: string): boolean => /^\s*```/.test(line);
const headingMatch = (line: string): RegExpExecArray | null => /^(#{2,3})\s+(.+?)\s*$/.exec(line);

/**
 * Split a Markdown page into nested H2/H3 sections with honest source ranges.
 * H2 hash range includes nested H3 ranges. H3 ends at the next equal-or-higher heading.
 */
export function splitDocSections(markdown: string): ParsedDocSections {
  const normalized = normalizeDocSource(markdown);
  const lines = normalized.split("\n");
  const errors: string[] = [];

  let bodyStart = 0;
  if (lines[0] === "---") {
    for (let i = 1; i < lines.length; i += 1) {
      if (lines[i] === "---") {
        bodyStart = i + 1;
        break;
      }
    }
  }
  const body = lines.slice(bodyStart).join("\n");

  type HeadingHit = {
    line: number;
    level: 2 | 3;
    title: string;
    slug: string;
  };

  const hits: HeadingHit[] = [];
  const slugSeen = new Map<string, number>();
  let inFence = false;
  for (let i = bodyStart; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (isFence(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = headingMatch(line);
    if (!m) continue;
    const level = m[1]!.length as 2 | 3;
    const title = m[2]!.trim();
    // GitHub-style disambiguation: first keeps the base slug, later collisions get -1, -2, ...
    const base = slugifyHeading(title);
    const prior = slugSeen.get(base) ?? 0;
    slugSeen.set(base, prior + 1);
    const slug = prior === 0 ? base : `${base}-${prior}`;
    hits.push({ line: i, level, title, slug });
  }

  for (const hit of hits) {
    if (hit.level === 3) {
      const priorH2 = hits.some((h) => h.line < hit.line && h.level === 2);
      if (!priorH2) {
        errors.push(`H3 before any H2: ${hit.slug}`);
      }
    }
  }

  if (errors.length > 0) {
    return { normalized, body, sections: [], flat: [], errors };
  }

  const sections: ParsedDocSection[] = [];
  let i = 0;
  while (i < hits.length) {
    const hit = hits[i]!;
    if (hit.level !== 2) {
      i += 1;
      continue;
    }
    const nextH2 = hits.findIndex((h, idx) => idx > i && h.level === 2);
    const h2EndLine = nextH2 === -1 ? lines.length : hits[nextH2]!.line;
    const children: ParsedDocSection[] = [];
    let j = i + 1;
    while (j < hits.length && hits[j]!.level === 3 && hits[j]!.line < h2EndLine) {
      const childHit = hits[j]!;
      let childEnd = h2EndLine;
      for (let k = j + 1; k < hits.length; k += 1) {
        if (hits[k]!.line >= h2EndLine) break;
        if (hits[k]!.level <= childHit.level) {
          childEnd = hits[k]!.line;
          break;
        }
      }
      children.push({
        slug: childHit.slug,
        title: childHit.title,
        level: 3,
        startLine: childHit.line,
        endLine: childEnd,
        source: lines.slice(childHit.line, childEnd).join("\n"),
        children: [],
      });
      j += 1;
    }
    sections.push({
      slug: hit.slug,
      title: hit.title,
      level: 2,
      startLine: hit.line,
      endLine: h2EndLine,
      source: lines.slice(hit.line, h2EndLine).join("\n"),
      children,
    });
    i = j;
  }

  const flat: ParsedDocSection[] = [];
  for (const section of sections) {
    flat.push(section);
    for (const child of section.children) flat.push(child);
  }

  return { normalized, body, sections, flat, errors };
}

/** Build an empty scaffold matching the current heading hierarchy and hashes. */
export function scaffoldSemanticSummary(
  record: DocRecord,
  markdown: string,
): SemanticDocSummary {
  const parsed = splitDocSections(markdown);
  if (parsed.errors.length > 0) {
    throw new Error(`summary-corpus: cannot scaffold ${record.id}: ${parsed.errors.join("; ")}`);
  }
  const mapSection = (section: ParsedDocSection): SemanticSectionSummary => ({
    slug: section.slug,
    title: section.title,
    level: section.level,
    sourceHash: hashSectionSource(section),
    summary: "",
    topics: [],
    children: section.children.map(mapSection),
  });
  return {
    schemaVersion: 1,
    docId: record.id,
    sourcePath: record.path as `docs/${string}.md`,
    sourceHash: hashDocSource(parsed.normalized),
    summary: "",
    topics: [],
    sections: parsed.sections.map(mapSection),
  };
}

/**
 * Refresh hashes on an existing sidecar after summaries were updated.
 * Refuses empty summaries. Returns the stamped summary and the list of changed hash paths.
 */
export function stampSemanticSummary(
  record: DocRecord,
  markdown: string,
  existing: SemanticDocSummary,
): { summary: SemanticDocSummary; changed: string[] } {
  const parsed = splitDocSections(markdown);
  if (parsed.errors.length > 0) {
    throw new Error(`summary-corpus: cannot stamp ${record.id}: ${parsed.errors.join("; ")}`);
  }
  if (existing.docId !== record.id) {
    throw new Error(`summary-corpus: docId mismatch for ${record.id}`);
  }
  if (!existing.summary.trim()) {
    throw new Error(`summary-corpus: refuse stamp with empty page summary for ${record.id}`);
  }

  const changed: string[] = [];
  const stampSection = (
    expected: ParsedDocSection,
    current: SemanticSectionSummary | undefined,
    path: string,
  ): SemanticSectionSummary => {
    if (!current) {
      throw new Error(`summary-corpus: missing section ${path} while stamping ${record.id}`);
    }
    if (!current.summary.trim()) {
      throw new Error(`summary-corpus: refuse stamp with empty summary at ${path}`);
    }
    const nextHash = hashSectionSource(expected);
    if (current.sourceHash !== nextHash) changed.push(path);
    const childMap = new Map(current.children.map((c) => [c.slug, c]));
    return {
      ...current,
      slug: expected.slug,
      title: expected.title,
      level: expected.level,
      sourceHash: nextHash,
      children: expected.children.map((child, idx) =>
        stampSection(child, childMap.get(child.slug) ?? current.children[idx], `${path}/${child.slug}`),
      ),
    };
  };

  const bySlug = new Map(existing.sections.map((s) => [s.slug, s]));
  const sections = parsed.sections.map((section, idx) =>
    stampSection(section, bySlug.get(section.slug) ?? existing.sections[idx], section.slug),
  );

  const pageHash = hashDocSource(parsed.normalized);
  if (existing.sourceHash !== pageHash) changed.push("(page)");

  return {
    summary: {
      ...existing,
      schemaVersion: 1,
      docId: record.id,
      sourcePath: record.path as `docs/${string}.md`,
      sourceHash: pageHash,
      sections,
    },
    changed,
  };
}

// Re-export validation so existing importers keep a single module surface.
export { validateSemanticSummary } from "./summary-validate";
