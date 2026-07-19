/**
 * Pure folder-forest logic for the Marinara binder lens (locked wireframe vs-lore-mari-folders).
 * Canonical categories stay FLAT ({id,name,sortOrder,enabled}); the parent/child edges live only in
 * the escrowed Marinara envelope (original["marinara-lorebook"].raw.data.folders[].parentFolderId).
 * This module reads those edges tolerantly, projects the tree the binder renders, enforces the
 * engine's reparent cycle rule, computes ancestor gating, and rewrites the escrow rows on save.
 * Engine ground truth: Marinara-Engine packages/shared/src/utils/lorebook-folder-tree.ts
 * (buildFolderForest roots-fallback + per-sibling sort, canReparentFolder, and
 * collectEffectivelyDisabledFolderIds) and lorebooks.storage.ts removeFolder (promote default:
 * entries to the root, direct children lifted to the root, never a flatten).
 */
import type { LorebookBody, LorebookCategory, LorebookEntry } from "../../../../entities/lorebook/schema";
import { newUiId } from "../../../_shared/new-id";

/** folderId -> parentFolderId (null = root). Missing key = root. */
export type ParentEdges = ReadonlyMap<string, string | null>;

export interface FolderNode {
  category: LorebookCategory;
  children: FolderNode[];
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const ESCROW_KEY = "marinara-lorebook";

/** The escrowed folder rows, or null when the book carries no Marinara escrow. */
function escrowFolders(original: unknown): Record<string, unknown>[] | null {
  if (!isRec(original)) return null;
  const slot = original[ESCROW_KEY];
  if (!isRec(slot)) return null;
  const raw = slot.raw;
  if (!isRec(raw)) return null;
  const data = raw.data;
  if (!isRec(data) || !Array.isArray(data.folders)) return null;
  return data.folders.filter(isRec);
}

/** Tolerant reader: parent edges from the escrowed envelope. Empty map when absent or malformed. */
export function readMarinaraEdges(original: unknown): Map<string, string | null> {
  const edges = new Map<string, string | null>();
  for (const row of escrowFolders(original) ?? []) {
    if (typeof row.id !== "string") continue;
    edges.set(row.id, typeof row.parentFolderId === "string" ? row.parentFolderId : null);
  }
  return edges;
}

/**
 * Rewrite the escrowed folder rows so save persists the edges: existing rows get their
 * parentFolderId updated, categories with no escrow row gain a minimal one (the codec overlays
 * name/enabled/order from canonical at export), and rows for deleted folders are pruned. When the
 * book has no Marinara escrow at all, a minimal envelope is seeded - the nesting has no other home
 * (canonical categories are flat by design), and the codec's overlay path treats a minimal twin
 * identically to no twin for every other field.
 */
export function writeMarinaraEdges(
  original: unknown,
  edges: ParentEdges,
  categories: readonly LorebookCategory[],
): Record<string, unknown> {
  const base: Record<string, unknown> = isRec(original) ? (structuredClone(original) as Record<string, unknown>) : {};
  const slot = isRec(base[ESCROW_KEY]) ? (base[ESCROW_KEY] as Record<string, unknown>) : {};
  const raw = isRec(slot.raw)
    ? (slot.raw as Record<string, unknown>)
    : { type: "marinara_lorebook", version: 1, exportedAt: "", data: {} };
  const data = isRec(raw.data) ? (raw.data as Record<string, unknown>) : {};
  const rows = Array.isArray(data.folders) ? data.folders.filter(isRec) : [];
  const byId = new Map(rows.map((r) => [String(r.id), r]));

  data.folders = categories.map((c) => {
    const parent = edges.get(c.id) ?? null;
    const row = byId.get(c.id);
    if (row) {
      row.parentFolderId = parent;
      return row;
    }
    return { id: c.id, name: c.name, enabled: c.enabled ?? true, parentFolderId: parent, order: c.sortOrder };
  });
  raw.data = data;
  slot.raw = raw;
  base[ESCROW_KEY] = slot;
  return base;
}

/**
 * Engine cycle rule (canReparentFolder): a folder may move anywhere except onto itself or into its
 * own subtree; the root (null) is always legal. An unknown target parent is refused.
 */
export function canReparentFolder(
  edges: ParentEdges,
  folderId: string,
  newParentId: string | null,
  knownIds: ReadonlySet<string>,
): boolean {
  if (newParentId === null) return true;
  if (newParentId === folderId) return false;
  if (!knownIds.has(newParentId)) return false;
  // walk the target's ancestor chain upward; landing on folderId means a descendant target
  let cursor: string | null = newParentId;
  const seen = new Set<string>();
  while (cursor !== null && !seen.has(cursor)) {
    seen.add(cursor);
    const parent: string | null = edges.get(cursor) ?? null;
    if (parent === folderId) return false;
    cursor = parent;
  }
  return true;
}

/** Every category that is a legal new parent for folderId (the Move-to picker's option list). */
export function legalParents(
  categories: readonly LorebookCategory[],
  edges: ParentEdges,
  folderId: string,
): LorebookCategory[] {
  const known = new Set(categories.map((c) => c.id));
  return categories.filter((c) => c.id !== folderId && canReparentFolder(edges, folderId, c.id, known));
}

/**
 * Engine buildFolderForest: roots + each sibling group sorted by sortOrder; a dangling parent
 * (unknown id) or a cyclic chain falls back to the root so nothing becomes uneditable.
 */
export function buildFolderForest(
  categories: readonly LorebookCategory[],
  edges: ParentEdges,
): FolderNode[] {
  const known = new Set(categories.map((c) => c.id));
  const parentOf = (id: string): string | null => {
    const p = edges.get(id) ?? null;
    if (p === null || !known.has(p)) return null;
    // cycle walk: if following parents from p ever returns to id, treat id as a root
    let cursor: string | null = p;
    const seen = new Set<string>([id]);
    while (cursor !== null) {
      if (seen.has(cursor)) return null;
      seen.add(cursor);
      cursor = edges.get(cursor) ?? null;
      if (cursor !== null && !known.has(cursor)) break;
    }
    return p;
  };
  const nodes = new Map<string, FolderNode>(
    categories.map((c) => [c.id, { category: c, children: [] }]),
  );
  const roots: FolderNode[] = [];
  for (const c of categories) {
    const parent = parentOf(c.id);
    const node = nodes.get(c.id)!;
    if (parent === null) roots.push(node);
    else nodes.get(parent)!.children.push(node);
  }
  const bySort = (a: FolderNode, b: FolderNode): number => a.category.sortOrder - b.category.sortOrder;
  const sortDeep = (list: FolderNode[]): void => {
    list.sort(bySort);
    for (const n of list) sortDeep(n.children);
  };
  sortDeep(roots);
  return roots;
}

/**
 * Engine collectEffectivelyDisabledFolderIds: a folder is gated when it or ANY ancestor is
 * disabled. Entries keep their own enabled flag untouched; the gate is re-derived, never stored.
 */
export function effectivelyDisabledFolderIds(
  categories: readonly LorebookCategory[],
  edges: ParentEdges,
): Set<string> {
  const known = new Map(categories.map((c) => [c.id, c]));
  const gated = new Set<string>();
  for (const c of categories) {
    let cursor: string | null = c.id;
    const seen = new Set<string>();
    while (cursor !== null && !seen.has(cursor)) {
      seen.add(cursor);
      const cat = known.get(cursor);
      if (!cat) break;
      if (cat.enabled === false) {
        gated.add(c.id);
        break;
      }
      cursor = edges.get(cursor) ?? null;
    }
  }
  return gated;
}

/** Per-folder direct counts for the "entries + subfolders" chip. */
export function folderCounts(
  categories: readonly LorebookCategory[],
  edges: ParentEdges,
  entries: readonly LorebookEntry[],
): Map<string, { entries: number; folders: number }> {
  const known = new Set(categories.map((c) => c.id));
  const counts = new Map<string, { entries: number; folders: number }>(
    categories.map((c) => [c.id, { entries: 0, folders: 0 }]),
  );
  for (const e of entries) {
    if (e.categoryId !== null && known.has(e.categoryId)) counts.get(e.categoryId)!.entries += 1;
  }
  for (const c of categories) {
    const p = edges.get(c.id) ?? null;
    if (p !== null && known.has(p)) counts.get(p)!.folders += 1;
  }
  return counts;
}

/** Add a folder at the root, sorted after every current root sibling. */
export function addFolder(
  body: LorebookBody,
  edges: ParentEdges,
  name: string,
): { body: LorebookBody; edges: Map<string, string | null>; id: string } {
  const id = newUiId("folder_");
  const categories = body.categories ?? [];
  const maxSort = categories.reduce((m, c) => Math.max(m, c.sortOrder), 0);
  const next = new Map(edges);
  next.set(id, null);
  return {
    body: { ...body, categories: [...categories, { id, name, sortOrder: maxSort + 10, enabled: true }] },
    edges: next,
    id,
  };
}

/** Patch one category's flat fields (rename, enable, sortOrder). */
export function patchCategory(
  body: LorebookBody,
  id: string,
  patch: Partial<Omit<LorebookCategory, "id">>,
): LorebookBody {
  const categories = (body.categories ?? []).map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c));
  return { ...body, categories };
}

/**
 * Engine removeFolder default (promote): member entries drop to the root (categoryId null),
 * DIRECT child folders lift to the root (a one-level lift, not a flatten), only the folder row
 * itself is removed. Nothing inside is lost.
 */
export function deleteFolderPromote(
  body: LorebookBody,
  edges: ParentEdges,
  id: string,
): { body: LorebookBody; edges: Map<string, string | null> } {
  const categories = (body.categories ?? []).filter((c) => c.id !== id);
  const entries = body.entries.map((e) => (e.categoryId === id ? { ...e, categoryId: null } : e));
  const next = new Map<string, string | null>();
  for (const [child, parent] of edges) {
    if (child === id) continue;
    next.set(child, parent === id ? null : parent);
  }
  return { body: { ...body, categories, entries }, edges: next };
}

/**
 * Engine cloneFolder: deep-copy the subtree as a SIBLING of the original, the copied root renamed
 * "(Copy)"; member entries of every copied folder are duplicated into their copies.
 */
export function cloneFolder(
  body: LorebookBody,
  edges: ParentEdges,
  id: string,
): { body: LorebookBody; edges: Map<string, string | null> } {
  const categories = body.categories ?? [];
  const source = categories.find((c) => c.id === id);
  if (!source) return { body, edges: new Map(edges) };

  const childrenOf = (parent: string): LorebookCategory[] =>
    categories.filter((c) => (edges.get(c.id) ?? null) === parent);

  const idMap = new Map<string, string>();
  const copies: LorebookCategory[] = [];
  const next = new Map(edges);
  const copySubtree = (cat: LorebookCategory, parentCopyId: string | null, rename: boolean): void => {
    const copyId = newUiId("folder_");
    idMap.set(cat.id, copyId);
    copies.push({ ...cat, id: copyId, name: rename ? `${cat.name} (Copy)` : cat.name });
    next.set(copyId, parentCopyId ?? (edges.get(cat.id) ?? null));
    for (const child of childrenOf(cat.id)) copySubtree(child, copyId, false);
  };
  copySubtree(source, null, true);

  const copiedEntries: LorebookEntry[] = [];
  for (const e of body.entries) {
    if (e.categoryId !== null && idMap.has(e.categoryId)) {
      copiedEntries.push({ ...structuredClone(e), id: newUiId("entry_"), categoryId: idMap.get(e.categoryId)! });
    }
  }
  return {
    body: { ...body, categories: [...categories, ...copies], entries: [...body.entries, ...copiedEntries] },
    edges: next,
  };
}

/** Reparent (guarded by the cycle rule; an illegal move returns the edges untouched). */
export function reparentFolder(
  edges: ParentEdges,
  categories: readonly LorebookCategory[],
  folderId: string,
  newParentId: string | null,
): Map<string, string | null> {
  const next = new Map(edges);
  const known = new Set(categories.map((c) => c.id));
  if (!known.has(folderId)) return next;
  if (!canReparentFolder(edges, folderId, newParentId, known)) return next;
  next.set(folderId, newParentId);
  return next;
}

/**
 * Reorder folderId among its CURRENT siblings so it lands just before/after anchorId (which must
 * share the same parent). Sibling sortOrder values are renumbered 10, 20, 30... - order is per
 * container, so no other group shifts.
 */
export function reorderSiblingFolder(
  body: LorebookBody,
  edges: ParentEdges,
  folderId: string,
  anchorId: string,
  side: "above" | "below",
): LorebookBody {
  const categories = body.categories ?? [];
  const parent = edges.get(anchorId) ?? null;
  if ((edges.get(folderId) ?? null) !== parent || folderId === anchorId) return body;
  const siblings = categories
    .filter((c) => (edges.get(c.id) ?? null) === parent)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => c.id)
    .filter((cid) => cid !== folderId);
  const at = siblings.indexOf(anchorId);
  if (at < 0) return body;
  siblings.splice(side === "above" ? at : at + 1, 0, folderId);
  const rank = new Map(siblings.map((cid, i) => [cid, (i + 1) * 10]));
  return {
    ...body,
    categories: categories.map((c) => (rank.has(c.id) ? { ...c, sortOrder: rank.get(c.id)! } : c)),
  };
}
