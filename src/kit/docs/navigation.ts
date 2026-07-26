/**
 * Pure folder, page, and outline projections over the docs catalog index.
 */
import type { DocAnchor, DocRecord } from "../../docs/types";

export interface DocBrowseOptions {
  collection?: string;
  audience?: "user" | "dev";
  offset?: number;
  limit?: number;
}

export interface DocCollectionRef {
  id: string;
  pageCount: number;
}

export interface DocBrowsePage {
  id: string;
  title: string;
  audience: string;
  summary: string;
  semanticSummary: string;
  topics: readonly string[];
}

export interface DocBrowseResult {
  collection: string | null;
  collections: readonly DocCollectionRef[];
  pages: readonly DocBrowsePage[];
  totalPages: number;
  offset: number;
  limit: number;
}

export interface DocOutlineSection {
  text: string;
  slug: string;
  level: 2 | 3;
  summary: string;
  topics: readonly string[];
  children: readonly DocOutlineSection[];
}

export interface DocPageOutline {
  id: string;
  title: string;
  audience: string;
  summary: string;
  semanticSummary: string;
  topics: readonly string[];
  sections: readonly DocOutlineSection[];
}

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 25;

const COLLECTION_ID = /^[A-Za-z0-9][A-Za-z0-9/_-]*$/;

/**
 * Normalize a catalog collection id. Empty string means the docs root.
 * Returns null for path-escape attempts or malformed ids.
 */
export function normalizeCollectionId(raw: string | undefined): string | null {
  if (raw === undefined) return "";
  const trimmed = raw.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  if (trimmed === "") return "";
  if (trimmed.includes("..")) return null;
  const parts = trimmed.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) return null;
  if (!COLLECTION_ID.test(trimmed)) return null;
  return trimmed;
}

/** Slash-separated folder prefix of a doc path after stripping docs/ and the filename. */
export function collectionOf(doc: DocRecord): string {
  const relative = doc.path.replaceAll("\\", "/").replace(/^docs\//, "");
  const slash = relative.lastIndexOf("/");
  return slash === -1 ? "" : relative.slice(0, slash);
}

const pageCountUnder = (docs: readonly DocRecord[], collectionId: string): number => {
  if (collectionId === "") return docs.length;
  const prefix = `${collectionId}/`;
  return docs.filter((doc) => {
    const folder = collectionOf(doc);
    return folder === collectionId || folder.startsWith(prefix);
  }).length;
};

const immediateChildCollections = (
  docs: readonly DocRecord[],
  parent: string,
): string[] => {
  const children = new Set<string>();
  const prefix = parent === "" ? "" : `${parent}/`;
  for (const doc of docs) {
    const folder = collectionOf(doc);
    if (parent === "") {
      if (folder === "") continue;
      const head = folder.split("/")[0];
      if (head) children.add(head);
      continue;
    }
    if (folder === parent || !folder.startsWith(prefix)) continue;
    const rest = folder.slice(prefix.length);
    const head = rest.split("/")[0];
    if (head) children.add(`${parent}/${head}`);
  }
  return [...children].sort((a, b) => a.localeCompare(b));
};

const asBrowsePage = (doc: DocRecord): DocBrowsePage => ({
  id: doc.id,
  title: doc.title,
  audience: doc.audience,
  summary: doc.summary,
  semanticSummary: doc.semanticSummary ?? "",
  topics: doc.topics ?? [],
});

const toOutlineSection = (anchor: DocAnchor): DocOutlineSection => ({
  text: anchor.text,
  slug: anchor.slug,
  level: anchor.level,
  summary: anchor.summary ?? "",
  topics: anchor.topics ?? [],
  children: (anchor.children ?? []).map(toOutlineSection),
});

/**
 * Project flat level-tagged anchors into an H2/H3 tree when children are absent.
 * Anchors that already carry nested children are returned as-is.
 */
export function nestAnchors(anchors: readonly DocAnchor[]): DocOutlineSection[] {
  if (anchors.some((anchor) => (anchor.children?.length ?? 0) > 0)) {
    return anchors.map(toOutlineSection);
  }
  const roots: DocOutlineSection[] = [];
  let currentH2: {
    text: string;
    slug: string;
    level: 2 | 3;
    summary: string;
    topics: readonly string[];
    children: DocOutlineSection[];
  } | null = null;
  const flushH2 = (): void => {
    if (!currentH2) return;
    roots.push({
      text: currentH2.text,
      slug: currentH2.slug,
      level: currentH2.level,
      summary: currentH2.summary,
      topics: currentH2.topics,
      children: currentH2.children,
    });
    currentH2 = null;
  };
  for (const anchor of anchors) {
    const section = toOutlineSection(anchor);
    if (anchor.level === 2) {
      flushH2();
      currentH2 = { ...section, children: [] };
      continue;
    }
    if (currentH2) {
      currentH2.children.push(section);
    } else {
      roots.push(section);
    }
  }
  flushH2();
  return roots;
}

/** Depth-first flatten of nested anchors for rails and search. */
export function flattenAnchors(anchors: readonly DocAnchor[]): DocAnchor[] {
  const out: DocAnchor[] = [];
  for (const anchor of anchors) {
    out.push(anchor);
    if (anchor.children?.length) out.push(...flattenAnchors(anchor.children));
  }
  return out;
}

/**
 * Browse one catalog collection. No collection returns root collections and root pages.
 * Offset/limit paginate pages only. Returns null for path-escape collection ids.
 */
export function browseDocs(
  docs: readonly DocRecord[],
  options: DocBrowseOptions = {},
): DocBrowseResult | null {
  const collection = normalizeCollectionId(options.collection);
  if (collection === null) return null;

  const limit = Math.max(1, Math.min(MAX_LIMIT, options.limit ?? DEFAULT_LIMIT));
  const offset = Math.max(0, options.offset ?? 0);
  const eligible = docs.filter((doc) => !options.audience || doc.audience === options.audience);

  const collections = immediateChildCollections(eligible, collection).map((id) => ({
    id,
    pageCount: pageCountUnder(eligible, id),
  }));

  const directPages = eligible
    .filter((doc) => collectionOf(doc) === collection)
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    collection: collection === "" ? null : collection,
    collections,
    pages: directPages.slice(offset, offset + limit).map(asBrowsePage),
    totalPages: directPages.length,
    offset,
    limit,
  };
}

/** Page semantic overview plus complete nested section map. */
export function outlineDoc(doc: DocRecord): DocPageOutline {
  return {
    id: doc.id,
    title: doc.title,
    audience: doc.audience,
    summary: doc.summary,
    semanticSummary: doc.semanticSummary ?? "",
    topics: doc.topics ?? [],
    sections: nestAnchors(doc.anchors),
  };
}

/** Find one section in a nested page outline by its catalog slug. */
export function findOutlineSection(
  sections: readonly DocOutlineSection[],
  slug: string,
): DocOutlineSection | null {
  for (const section of sections) {
    if (section.slug === slug) return section;
    const child = findOutlineSection(section.children, slug);
    if (child) return child;
  }
  return null;
}
