/** Read-only HTTP boundary for the docs corpus in development and packaged builds. */
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { PackagedAssets } from "./assets";
import type { DocFigure, DocsIndex } from "./docs-types";
import { docsAssetMime, parseDocsIndex, resolveDocAsset, resolveDocPage } from "./docs-corpus";
import { err, json } from "./server-security";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

async function devDocsIndex(): Promise<DocsIndex | null> {
  try {
    const raw = await Bun.file(fileURLToPath(new URL("../../docs/generated/docs-index.json", import.meta.url))).json();
    return parseDocsIndex(raw);
  } catch {
    return null;
  }
}

async function devDocFigures(): Promise<DocFigure[] | null> {
  try {
    const raw = await Bun.file(fileURLToPath(new URL("../../docs/generated/figures.json", import.meta.url))).json();
    return Array.isArray(raw) ? raw as DocFigure[] : null;
  } catch {
    return null;
  }
}

const text = (body: string, type: string): Response =>
  new Response(body, { headers: { "content-type": type } });

export async function handleDocsRequest(
  req: Request,
  url: URL,
  packaged?: PackagedAssets,
): Promise<Response | null> {
  if (url.pathname === "/api/docs/index" && req.method === "GET") {
    const index = packaged?.docs.index ?? await devDocsIndex();
    return index ? json(index) : err("docs unavailable", 500);
  }
  if (url.pathname === "/api/docs/figures" && req.method === "GET") {
    const figures = packaged?.docs.figures ?? await devDocFigures();
    return figures ? json(figures) : err("docs unavailable", 500);
  }
  if (url.pathname === "/api/docs/get" && req.method === "GET") {
    const id = url.searchParams.get("id") ?? "";
    if (packaged) {
      const body = packaged.docs.pages[id];
      return body === undefined ? err("doc not found", 404) : text(body, "text/markdown; charset=utf-8");
    }
    const index = await devDocsIndex();
    const path = index ? resolveDocPage(REPO_ROOT, index, id) : null;
    if (!path) return err("doc not found", 404);
    const file = Bun.file(path);
    return await file.exists() ? text(await file.text(), "text/markdown; charset=utf-8") : err("doc not found", 404);
  }
  if (url.pathname !== "/api/docs/asset" || req.method !== "GET") return null;

  const requested = url.searchParams.get("path") ?? "";
  if (packaged) {
    const asset = packaged.docs.assets[requested];
    if (!asset) return err("doc asset not found", 404);
    return new Response(Buffer.from(asset.b64, "base64"), {
      headers: {
        "content-type": asset.mime,
        "cache-control": "public, max-age=86400",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  }
  const path = resolveDocAsset(REPO_ROOT, requested);
  const mime = path ? docsAssetMime(path) : null;
  if (!path || !mime || relative(REPO_ROOT, path).startsWith("..")) return err("doc asset not found", 404);
  const file = Bun.file(path);
  if (!await file.exists()) return err("doc asset not found", 404);
  return new Response(file, {
    headers: {
      "content-type": mime,
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
