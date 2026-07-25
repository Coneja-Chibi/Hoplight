/**
 * Fail-closed validation of authored semantic documentation sidecars.
 * Provenance: audit-plans/07-build-semantic-docs-catalogue.md.
 */
import type { DocRecord } from "./types";
import type {
  SemanticDocSummary,
  SemanticSectionSummary,
  SummaryValidationIssue,
  SummaryValidationResult,
} from "./summary-types";
import {
  hashDocSource,
  hashSectionSource,
  type ParsedDocSection,
  type ParsedDocSections,
} from "./summary-corpus";

const wordCount = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

const issue = (
  severity: "error" | "warning",
  code: string,
  path: string,
  message: string,
): SummaryValidationIssue => ({ severity, code, path, message });

const isSha256 = (value: unknown): value is string =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);

function validateSummaryProse(
  label: string,
  path: string,
  summary: string,
  topics: string[],
  opts: {
    minWords: number;
    maxWords: number;
    shortMin: number;
    shortMax: number;
    shortSource?: boolean;
    topicMin: number;
    topicMax: number;
  },
  issues: SummaryValidationIssue[],
): void {
  if (typeof summary !== "string" || summary.trim().length === 0) {
    issues.push(issue("error", "empty-summary", path, `${label} summary is empty`));
    return;
  }
  if (!isStringArray(topics) || topics.length === 0) {
    issues.push(issue("error", "empty-topics", path, `${label} topics are empty`));
  } else if (topics.length < opts.topicMin || topics.length > opts.topicMax) {
    issues.push(issue(
      "error",
      "topic-count",
      path,
      `${label} topics must be ${opts.topicMin}-${opts.topicMax} (got ${topics.length})`,
    ));
  }
  const words = wordCount(summary);
  if (opts.shortSource) {
    if (words < opts.shortMin || words > opts.shortMax) {
      issues.push(issue(
        "error",
        "word-band",
        path,
        `${label} shortSource summary must be ${opts.shortMin}-${opts.shortMax} words (got ${words})`,
      ));
    }
  } else if (words < opts.minWords || words > opts.maxWords) {
    if (words >= opts.shortMin && words <= opts.shortMax) {
      issues.push(issue(
        "warning",
        "word-band-short",
        path,
        `${label} summary is short (${words} words); set shortSource: true if intentional`,
      ));
    } else {
      issues.push(issue(
        "error",
        "word-band",
        path,
        `${label} summary must be ${opts.minWords}-${opts.maxWords} words (got ${words})`,
      ));
    }
  }
}

function validateSectionTree(
  expected: ParsedDocSection[],
  candidate: unknown,
  path: string,
  issues: SummaryValidationIssue[],
): void {
  if (!Array.isArray(candidate)) {
    issues.push(issue("error", "sections-type", path, "sections must be an array"));
    return;
  }
  if (candidate.length !== expected.length) {
    issues.push(issue(
      "error",
      "section-count",
      path,
      `expected ${expected.length} sections, got ${candidate.length}`,
    ));
  }
  const n = Math.min(candidate.length, expected.length);
  for (let i = 0; i < n; i += 1) {
    const exp = expected[i]!;
    const got = candidate[i] as Partial<SemanticSectionSummary> | null;
    const sectionPath = `${path}[${i}]`;
    if (!got || typeof got !== "object") {
      issues.push(issue("error", "section-type", sectionPath, "section must be an object"));
      continue;
    }
    if (got.slug !== exp.slug) {
      issues.push(issue("error", "section-slug", sectionPath, `expected slug ${exp.slug}, got ${String(got.slug)}`));
    }
    if (got.title !== exp.title) {
      issues.push(issue("error", "section-title", sectionPath, `expected title ${exp.title}, got ${String(got.title)}`));
    }
    if (got.level !== exp.level) {
      issues.push(issue("error", "section-level", sectionPath, `expected level ${exp.level}, got ${String(got.level)}`));
    }
    const expectedHash = hashSectionSource(exp);
    if (!isSha256(got.sourceHash)) {
      issues.push(issue("error", "section-hash-format", sectionPath, "sourceHash must be sha256:<hex>"));
    } else if (got.sourceHash !== expectedHash) {
      issues.push(issue("error", "section-stale", sectionPath, `stale sourceHash for ${exp.slug}`));
    }
    const isH2 = exp.level === 2;
    validateSummaryProse(
      `section ${exp.slug}`,
      `${sectionPath}.summary`,
      typeof got.summary === "string" ? got.summary : "",
      Array.isArray(got.topics) ? got.topics as string[] : [],
      isH2
        ? {
            minWords: 80,
            maxWords: 180,
            shortMin: 40,
            shortMax: 80,
            shortSource: got.shortSource === true,
            topicMin: 2,
            topicMax: 8,
          }
        : {
            minWords: 40,
            maxWords: 120,
            shortMin: 20,
            shortMax: 40,
            shortSource: got.shortSource === true,
            topicMin: 2,
            topicMax: 8,
          },
      issues,
    );
    validateSectionTree(exp.children, got.children ?? [], `${sectionPath}.children`, issues);

    if (isH2 && exp.children.length > 0 && typeof got.summary === "string") {
      const lower = got.summary.toLowerCase();
      const missing = exp.children.filter((child) => {
        const titleHit = lower.includes(child.title.toLowerCase());
        const slugHit = lower.includes(child.slug.replace(/-/g, " "));
        return !titleHit && !slugHit;
      });
      if (missing.length > 0) {
        issues.push(issue(
          "warning",
          "parent-child-coverage",
          sectionPath,
          `H2 summary may omit child topics: ${missing.map((m) => m.slug).join(", ")}`,
        ));
      }
    }
  }
  if (candidate.length > expected.length) {
    for (let i = expected.length; i < candidate.length; i += 1) {
      issues.push(issue("error", "extra-section", `${path}[${i}]`, "extra section not present in source"));
    }
  }
}

/**
 * Fail-closed validation of one authored semantic sidecar against a DocRecord and parsed source.
 */
export function validateSemanticSummary(
  record: DocRecord,
  parsed: ParsedDocSections,
  candidate: unknown,
): SummaryValidationResult {
  const issues: SummaryValidationIssue[] = [];

  if (parsed.errors.length > 0) {
    for (const err of parsed.errors) {
      issues.push(issue("error", "parse", record.id, err));
    }
    return { ok: false, issues };
  }

  if (!candidate || typeof candidate !== "object") {
    return {
      ok: false,
      issues: [issue("error", "type", record.id, "sidecar must be an object")],
    };
  }
  const doc = candidate as Partial<SemanticDocSummary>;

  if (doc.schemaVersion !== 1) {
    issues.push(issue("error", "schema", record.id, "schemaVersion must be 1"));
  }
  if (doc.docId !== record.id) {
    issues.push(issue("error", "doc-id", record.id, `docId must be ${record.id}`));
  }
  if (doc.sourcePath !== record.path) {
    issues.push(issue("error", "source-path", record.id, `sourcePath must be ${record.path}`));
  }
  if (!isSha256(doc.sourceHash)) {
    issues.push(issue("error", "page-hash-format", record.id, "sourceHash must be sha256:<hex>"));
  } else if (doc.sourceHash !== hashDocSource(parsed.normalized)) {
    issues.push(issue("error", "page-stale", record.id, "page sourceHash is stale"));
  }

  validateSummaryProse(
    "page",
    `${record.id}.summary`,
    typeof doc.summary === "string" ? doc.summary : "",
    Array.isArray(doc.topics) ? doc.topics as string[] : [],
    {
      minWords: 140,
      maxWords: 260,
      shortMin: 80,
      shortMax: 140,
      shortSource: doc.shortSource === true,
      topicMin: 3,
      topicMax: 12,
    },
    issues,
  );

  validateSectionTree(parsed.sections, doc.sections, `${record.id}.sections`, issues);

  if (typeof doc.summary === "string" && parsed.sections.length > 0) {
    const lower = doc.summary.toLowerCase();
    const missing = parsed.sections.filter((section) => {
      const titleHit = lower.includes(section.title.toLowerCase());
      const slugHit = lower.includes(section.slug.replace(/-/g, " "));
      return !titleHit && !slugHit;
    });
    if (missing.length > 0) {
      issues.push(issue(
        "warning",
        "page-h2-coverage",
        record.id,
        `page summary may omit H2 topics: ${missing.map((m) => m.slug).join(", ")}`,
      ));
    }
  }

  const hasErrors = issues.some((item) => item.severity === "error");
  return { ok: !hasErrors, issues };
}
