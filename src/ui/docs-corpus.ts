/** Fail-closed validation and path resolution for the read-only docs HTTP boundary. */
import { extname, isAbsolute, relative, resolve } from "node:path";
import type { DocAnchor, DocRecord, DocsIndex } from "./docs-types";

const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isAnchor = (value: unknown): value is DocAnchor => {
  if (!value || typeof value !== "object") return false;
  const anchor = value as Partial<DocAnchor>;
  return typeof anchor.text === "string" && typeof anchor.slug === "string" &&
    (anchor.level === 2 || anchor.level === 3);
};

const isRecord = (value: unknown): value is DocRecord => {
  if (!value || typeof value !== "object") return false;
  const doc = value as Partial<DocRecord>;
  return typeof doc.id === "string" && doc.id.length > 0 &&
    typeof doc.path === "string" && doc.path.startsWith("docs/") &&
    typeof doc.title === "string" && typeof doc.audience === "string" &&
    typeof doc.summary === "string" && stringArray(doc.tags) && stringArray(doc.related) &&
    Array.isArray(doc.anchors) && doc.anchors.every(isAnchor);
};

export function parseDocsIndex(value: unknown): DocsIndex | null {
  if (!value || typeof value !== "object") return null;
  const index = value as Partial<DocsIndex>;
  if (typeof index.generated !== "string" || typeof index.count !== "number" || !Array.isArray(index.docs)) {
    return null;
  }
  if (!index.docs.every(isRecord) || index.count !== index.docs.length) return null;
  if (new Set(index.docs.map((doc) => doc.id)).size !== index.docs.length) return null;
  return index as DocsIndex;
}

const containedBy = (parent: string, child: string): boolean => {
  const rel = relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
};

/** Resolve only a catalog-declared Markdown page beneath docs/. */
export function resolveDocPage(root: string, index: DocsIndex, id: string): string | null {
  const record = index.docs.find((doc) => doc.id === id);
  if (!record) return null;
  const docsRoot = resolve(root, "docs");
  const target = resolve(root, record.path);
  return containedBy(docsRoot, target) && extname(target).toLowerCase() === ".md" ? target : null;
}

/** Resolve only presentation assets from the two intentionally public docs asset folders. */
export function resolveDocAsset(root: string, requested: string): string | null {
  const normalized = requested.replaceAll("\\", "/");
  const roots = [resolve(root, "docs", "media"), resolve(root, "docs", "generated", "figures")];
  const target = resolve(root, normalized);
  return roots.some((allowed) => containedBy(allowed, target)) ? target : null;
}

export function docsAssetMime(path: string): string | null {
  switch (extname(path).toLowerCase()) {
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".gif": return "image/gif";
    case ".avif": return "image/avif";
    default: return null;
  }
}
