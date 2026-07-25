/**
 * Pure deterministic search and section extraction for Kit's Hoplight documentation tool.
 */
import type { DocRecord } from "../../docs/types";

export interface DocSearchOptions {
  audience?: "user" | "dev";
  limit?: number;
}

export interface DocChunk {
  doc: DocRecord;
  section: string | null;
  heading: string;
  text: string;
  terms: readonly string[];
}

export interface DocChunkHit {
  doc: DocRecord;
  section: string | null;
  heading: string;
  excerpt: string;
  score: number;
}

const normalized = (value: string): string => value.trim().toLowerCase();

const queryTokens = (query: string): string[] =>
  normalized(query).split(/\s+/).filter(Boolean);

const includesAll = (haystack: string, tokens: readonly string[]): boolean =>
  tokens.every((token) => haystack.includes(token));

const scoreDoc = (doc: DocRecord, query: string, tokens: readonly string[]): number => {
  const title = normalized(doc.title);
  const id = normalized(doc.id);
  const tags = normalized(doc.tags.join(" "));
  const summary = normalized(doc.summary);
  const anchors = normalized(doc.anchors.map((anchor) => anchor.text).join(" "));
  const haystack = `${title} ${id} ${tags} ${summary} ${anchors}`;
  if (!includesAll(haystack, tokens)) return -1;
  let score = 0;
  if (title === query) score += 100;
  if (title.includes(query)) score += 40;
  if (id.includes(query)) score += 25;
  if (tags.includes(query)) score += 20;
  if (summary.includes(query)) score += 12;
  if (anchors.includes(query)) score += 8;
  for (const token of tokens) {
    if (title.includes(token)) score += 6;
    if (tags.includes(token)) score += 4;
    if (summary.includes(token)) score += 2;
    if (anchors.includes(token)) score += 1;
  }
  return score;
};

/** Search catalog metadata without loading every Markdown page. */
export function searchDocCatalog(
  docs: readonly DocRecord[],
  rawQuery: string,
  options: DocSearchOptions = {},
): DocRecord[] {
  const query = normalized(rawQuery);
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];
  const limit = Math.max(1, Math.min(8, options.limit ?? 5));
  return docs
    .filter((doc) => !options.audience || doc.audience === options.audience)
    .map((doc) => ({ doc, score: scoreDoc(doc, query, tokens) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id))
    .slice(0, limit)
    .map((entry) => entry.doc);
}

const stripFrontmatter = (raw: string): string => {
  if (!raw.startsWith("---")) return raw;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return raw;
  const after = raw.indexOf("\n", end + 1);
  return after === -1 ? "" : raw.slice(after + 1);
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

/** Extract one H2 or H3 section, including its descendants, from a Markdown page. */
export function extractDocSection(raw: string, requestedSlug: string): string | null {
  const lines = stripFrontmatter(raw).split(/\r?\n/);
  let start = -1;
  let level = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(lines[index] ?? "");
    if (match && slugify(match[2] ?? "") === requestedSlug) {
      start = index;
      level = match[1]?.length ?? 0;
      break;
    }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const match = /^(#{2,3})\s+/.exec(lines[index] ?? "");
    if (match && (match[1]?.length ?? 0) <= level) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim();
}

/** Remove frontmatter before handing authored prose to a model. */
export function docBody(raw: string): string {
  return stripFrontmatter(raw).trim();
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "is",
  "it", "of", "on", "or", "that", "the", "this", "to", "was", "what", "when", "where",
  "which", "who", "why", "with",
]);

const stem = (word: string): string => {
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
};

const termsOf = (value: string): string[] =>
  value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[`*_#[\](){}<>:;,.!?/\\|"'=+-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map(stem);

const chunkHeading = /^(#{2,3})\s+(.+?)\s*$/;

/** Split one page into small heading-addressable retrieval units. */
export function buildDocChunks(doc: DocRecord, raw: string): DocChunk[] {
  const chunks: DocChunk[] = [];
  let heading = doc.title;
  let section: string | null = null;
  let lines: string[] = [];
  const flush = (): void => {
    const text = lines.join("\n").trim();
    if (text) {
      const searchable = `${doc.title}\n${heading}\n${doc.summary}\n${doc.tags.join(" ")}\n${text}`;
      chunks.push({ doc, section, heading, text, terms: termsOf(searchable) });
    }
    lines = [];
  };
  for (const line of docBody(raw).split(/\r?\n/)) {
    if (/^#\s+/.test(line)) continue;
    const match = chunkHeading.exec(line);
    if (match) {
      flush();
      heading = match[2] ?? doc.title;
      section = slugify(heading);
      continue;
    }
    lines.push(line);
  }
  flush();
  return chunks;
}

const termFrequency = (terms: readonly string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);
  return counts;
};

const excerptFor = (text: string, queryTerms: readonly string[]): string => {
  const plain = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`|[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const lower = plain.toLowerCase();
  const positions = queryTerms.map((term) => lower.indexOf(term)).filter((index) => index >= 0);
  const center = positions.length > 0 ? Math.min(...positions) : 0;
  const start = Math.max(0, center - 80);
  const body = plain.slice(start, start + 280).trim();
  return `${start > 0 ? "... " : ""}${body}${start + 280 < plain.length ? " ..." : ""}`;
};

/** Rank full-text page chunks with a small in-memory BM25-style scorer. */
export function searchDocChunks(
  chunks: readonly DocChunk[],
  rawQuery: string,
  options: DocSearchOptions = {},
): DocChunkHit[] {
  const query = normalized(rawQuery);
  const queryTerms = [...new Set(termsOf(query))];
  if (queryTerms.length === 0 || chunks.length === 0) return [];
  const eligible = chunks.filter((chunk) =>
    !options.audience || chunk.doc.audience === options.audience);
  if (eligible.length === 0) return [];
  const averageLength = eligible.reduce((sum, chunk) => sum + chunk.terms.length, 0) / eligible.length;
  const documentFrequency = new Map<string, number>();
  for (const term of queryTerms) {
    documentFrequency.set(
      term,
      eligible.filter((chunk) => chunk.terms.includes(term)).length,
    );
  }
  const scored = eligible.map((chunk): DocChunkHit => {
    const frequencies = termFrequency(chunk.terms);
    let score = 0;
    for (const term of queryTerms) {
      const frequency = frequencies.get(term) ?? 0;
      if (frequency === 0) continue;
      const containing = documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (eligible.length - containing + 0.5) / (containing + 0.5));
      const lengthNorm = 1.2 * (1 - 0.75 + 0.75 * chunk.terms.length / averageLength);
      score += idf * (frequency * 2.2) / (frequency + lengthNorm);
    }
    const titleTerms = new Set(termsOf(chunk.doc.title));
    const headingTerms = new Set(termsOf(chunk.heading));
    const tagTerms = new Set(termsOf(chunk.doc.tags.join(" ")));
    for (const term of queryTerms) {
      if (headingTerms.has(term)) score += 3;
      if (titleTerms.has(term)) score += 2;
      if (tagTerms.has(term)) score += 2;
    }
    const phrase = query.toLowerCase();
    if (chunk.heading.toLowerCase().includes(phrase)) score += 8;
    if (chunk.text.toLowerCase().includes(phrase)) score += 5;
    return {
      doc: chunk.doc,
      section: chunk.section,
      heading: chunk.heading,
      excerpt: excerptFor(chunk.text, queryTerms),
      score,
    };
  }).filter((hit) => hit.score > 0);

  const bestByDoc = new Map<string, DocChunkHit>();
  for (const hit of scored) {
    const prior = bestByDoc.get(hit.doc.id);
    if (!prior || hit.score > prior.score || (
      hit.score === prior.score && (hit.section ?? "").localeCompare(prior.section ?? "") < 0
    )) {
      bestByDoc.set(hit.doc.id, hit);
    }
  }
  const limit = Math.max(1, Math.min(8, options.limit ?? 5));
  return [...bestByDoc.values()]
    .sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id))
    .slice(0, limit);
}
