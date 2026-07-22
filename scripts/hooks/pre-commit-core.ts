/** Pure parsing and staged-path routing decisions for the fast pre-commit hook. */

export interface StagedPath {
  status: string;
  path: string;
  previousPath?: string;
}

const normalize = (path: string): string => path.replace(/\\/g, "/");

/** Parse NUL-delimited `git diff --name-status -z`, keeping rename/copy destinations. */
export function parseNameStatusZ(raw: string): StagedPath[] {
  const fields = raw.split("\0");
  const paths: StagedPath[] = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (!status) break;
    const firstPath = fields[index++];
    if (!firstPath) break;
    const renamed = /^[CR]/.test(status);
    const path = renamed ? fields[index++] : firstPath;
    if (!path) break;
    paths.push({
      status,
      path: normalize(path),
      ...(renamed ? { previousPath: normalize(firstPath) } : {}),
    });
  }
  return paths;
}

/** Live staged UI TSX paths, normalized, deduplicated, and sorted for deterministic lint input. */
export function stagedUiTsx(paths: readonly StagedPath[]): string[] {
  return [...new Set(paths
    .filter((entry) => !entry.status.startsWith("D"))
    .map((entry) => normalize(entry.path))
    .filter((path) => path.startsWith("src/ui/") && path.endsWith(".tsx")))].sort();
}

const CATALOG_INFRA = new Set([
  "scripts/hooks/catalog-lib.ts",
  "scripts/hooks/component-catalog.ts",
]);

/** Whether any staged addition, edit, rename, or deletion can change the component catalog. */
export function needsComponentCatalog(paths: readonly StagedPath[]): boolean {
  const affectsCatalog = (rawPath: string): boolean => {
    const path = normalize(rawPath);
    if (path === "docs/reference/components.md" || CATALOG_INFRA.has(path)) return true;
    if (/^src\/ui\/(components|apps|shell)\/.*\.tsx$/.test(path)) return true;
    if (/^src\/ui\/(components|apps|shell)\/.*\.module\.css$/.test(path)) return true;
    return /^src\/ui\/_shared\/[^/]+\.ts$/.test(path);
  };
  return paths.some((entry) =>
    affectsCatalog(entry.path) || (entry.previousPath !== undefined && affectsCatalog(entry.previousPath)));
}

/**
 * Whether any staged change touches a docs-index corpus file: a `.md` under docs/ that is not a
 * generated table. When true the hook regenerates docs/generated/docs-index.json + docs/llms.txt and
 * stages them, so the docs:index:check in verify:ci can never go stale from a forgotten regen. Add,
 * edit, rename, and delete all count (moving a doc out of docs/ changes the index too).
 */
export function needsDocsIndex(paths: readonly StagedPath[]): boolean {
  const affects = (rawPath: string): boolean => {
    const path = normalize(rawPath);
    if (!/^docs\/.*\.md$/.test(path)) return false;
    if (path.startsWith("docs/generated/")) return false;
    return path !== "docs/FORMAT-SUPPORT.md";
  };
  return paths.some((entry) =>
    affects(entry.path) || (entry.previousPath !== undefined && affects(entry.previousPath)));
}
