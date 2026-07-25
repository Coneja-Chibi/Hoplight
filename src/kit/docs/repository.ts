/**
 * Read-only, catalog-contained access to Hoplight's generated documentation corpus.
 */
import { fileURLToPath } from "node:url";
import { parseDocsIndex, resolveDocPage } from "../../docs/corpus";
import type { DocAnchor, DocRecord, DocsIndex } from "../../docs/types";
import {
  buildDocChunks,
  docBody,
  extractDocSection,
  searchDocCatalog,
  searchDocChunks,
  type DocChunk,
  type DocSearchOptions,
} from "./catalog";
import {
  browseDocs,
  outlineDoc,
  type DocBrowseOptions,
  type DocBrowseResult,
  type DocPageOutline,
} from "./navigation";

export interface DocMatch {
  id: string;
  title: string;
  audience: string;
  summary: string;
  anchors: readonly DocAnchor[];
  section?: string;
  excerpt?: string;
}

export interface DocReadResult {
  id: string;
  title: string;
  section: string | null;
  body: string;
  truncated: boolean;
  offset: number;
  nextOffset: number | null;
  totalChars: number;
  anchors: readonly DocAnchor[];
}

export interface DocReadOptions {
  section?: string;
  maxChars?: number;
  offset?: number;
}

export interface HoplightDocs {
  browse(options?: DocBrowseOptions): Promise<DocBrowseResult | null>;
  outline(id: string): Promise<DocPageOutline | null>;
  search(query: string, options?: DocSearchOptions): Promise<readonly DocMatch[]>;
  read(id: string, options?: DocReadOptions): Promise<DocReadResult | null>;
}

const DEFAULT_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const DEFAULT_MAX_CHARS = 8_000;

const asMatch = (doc: DocRecord, section?: string | null, excerpt?: string): DocMatch => ({
  id: doc.id,
  title: doc.title,
  audience: doc.audience,
  summary: doc.summary,
  anchors: doc.anchors,
  ...(section ? { section } : {}),
  ...(excerpt ? { excerpt } : {}),
});

const pageAtBoundary = (
  body: string,
  requestedOffset: number,
  maxChars: number,
): { body: string; offset: number; nextOffset: number | null } => {
  const offset = Math.max(0, Math.min(body.length, requestedOffset));
  const candidateEnd = Math.min(body.length, offset + maxChars);
  const slice = body.slice(offset, candidateEnd);
  if (candidateEnd === body.length) {
    return { body: slice, offset, nextOffset: null };
  }
  const boundary = slice.lastIndexOf("\n");
  const end = boundary > maxChars * 0.7 ? offset + boundary + 1 : candidateEnd;
  return {
    body: body.slice(offset, end).trimEnd(),
    offset,
    nextOffset: end,
  };
};

/** Bind a docs repository to the checked-in corpus beneath one Hoplight root. */
export function createHoplightDocs(root: string = DEFAULT_ROOT): HoplightDocs {
  let corpusPromise: Promise<{ index: DocsIndex; chunks: DocChunk[] } | null> | null = null;
  const loadIndex = async (): Promise<DocsIndex | null> => {
    try {
      return parseDocsIndex(await Bun.file(`${root}/docs/generated/docs-index.json`).json());
    } catch {
      return null;
    }
  };
  const loadCorpus = (): Promise<{ index: DocsIndex; chunks: DocChunk[] } | null> => {
    corpusPromise ??= (async () => {
      const index = await loadIndex();
      if (!index) return null;
      const pages = await Promise.all(index.docs.map(async (doc) => {
        const path = resolveDocPage(root, index, doc.id);
        if (!path) return [];
        const file = Bun.file(path);
        return await file.exists() ? buildDocChunks(doc, await file.text()) : [];
      }));
      return { index, chunks: pages.flat() };
    })();
    return corpusPromise;
  };

  return {
    async browse(options) {
      const index = await loadIndex();
      if (!index) return null;
      return browseDocs(index.docs, options);
    },
    async outline(id) {
      const index = await loadIndex();
      if (!index) return null;
      const record = index.docs.find((doc) => doc.id === id);
      return record ? outlineDoc(record) : null;
    },
    async search(query, options) {
      const corpus = await loadCorpus();
      if (!corpus) return [];
      const hits = searchDocChunks(corpus.chunks, query, options);
      if (hits.length > 0) {
        return hits.map((hit) => asMatch(hit.doc, hit.section, hit.excerpt));
      }
      return searchDocCatalog(corpus.index.docs, query, options).map((doc) => asMatch(doc));
    },
    async read(id, options = {}) {
      const index = await loadIndex();
      if (!index) return null;
      const record = index.docs.find((doc) => doc.id === id);
      const path = resolveDocPage(root, index, id);
      if (!record || !path) return null;
      const file = Bun.file(path);
      if (!await file.exists()) return null;
      const raw = await file.text();
      const selected = options.section ? extractDocSection(raw, options.section) : docBody(raw);
      if (selected === null) return null;
      const maxChars = Math.max(1_000, Math.min(12_000, options.maxChars ?? DEFAULT_MAX_CHARS));
      const page = pageAtBoundary(selected, options.offset ?? 0, maxChars);
      return {
        id,
        title: record.title,
        section: options.section ?? null,
        body: page.body,
        truncated: page.nextOffset !== null,
        offset: page.offset,
        nextOffset: page.nextOffset,
        totalChars: selected.length,
        anchors: record.anchors,
      };
    },
  };
}

export type { DocBrowseOptions, DocBrowseResult, DocPageOutline };
