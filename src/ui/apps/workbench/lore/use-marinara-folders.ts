/**
 * useMarinaraFolders - binder state for the Marinara folder lens (locked vs-lore-mari-folders).
 * Parent edges live only in the escrowed envelope; canonical categories stay flat. Owns edge
 * dirty-tracking, TOC props, inspector handlers, and the save-time escrow rewrite.
 */
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { LorebookCategory, LorebookEntry } from "../../../../entities/lorebook/schema";
import type { LoreWriteForProfile } from "../../../../core/lore";
import {
  addEntry,
  selectEntry,
  updateEntry,
  type LoreSession,
} from "./session";
import type { FolderTocProps } from "./folder-toc";
import type { FolderInspectorProps } from "./folder-inspector";
import {
  addFolder,
  cloneFolder,
  deleteFolderPromote,
  patchCategory,
  readMarinaraEdges,
  reorderSiblingFolder,
  reparentFolder,
  writeMarinaraEdges,
} from "./folder-tree";

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export interface MarinaraFoldersApi {
  edgesDirty: boolean;
  /** Call after a successful save so the edge baseline tracks what was written. */
  markEdgesSaved: () => void;
  /**
   * Escrow rewrite for save. When no Marinara escrow exists and edges are clean, returns the
   * base original untouched (nesting has nowhere else to live, but we do not invent an envelope
   * until the user actually nests or an import already carried one).
   */
  originalForSave: (
    baseOriginal: Record<string, unknown>,
    categories: readonly LorebookCategory[],
  ) => Record<string, unknown>;
  folderLens: boolean;
  selectedFolder: LorebookCategory | undefined;
  folderProps: FolderTocProps;
  inspectorProps: FolderInspectorProps | null;
}

export function useMarinaraFolders(opts: {
  entity: unknown;
  session: LoreSession;
  setSession: Dispatch<SetStateAction<LoreSession>>;
  writeFor: LoreWriteForProfile;
  styles: Readonly<Record<string, string>>;
}): MarinaraFoldersApi {
  const { entity, session, setSession, writeFor, styles } = opts;

  const initEdges = useMemo(
    () => readMarinaraEdges(isRec(entity) ? entity.original : undefined),
    [entity],
  );
  const [edges, setEdges] = useState<Map<string, string | null>>(() => new Map(initEdges));
  const [edgesBaseline, setEdgesBaseline] = useState<Map<string, string | null>>(
    () => new Map(initEdges),
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());

  const edgesDirty = useMemo(() => {
    if (edges.size !== edgesBaseline.size) return true;
    for (const [k, v] of edges) {
      if (!edgesBaseline.has(k) || edgesBaseline.get(k) !== v) return true;
    }
    return false;
  }, [edges, edgesBaseline]);

  const folderLens = writeFor === "marinara";
  const categories = session.body.categories ?? [];
  const selectedFolder = selectedFolderId
    ? categories.find((c) => c.id === selectedFolderId)
    : undefined;

  const toggleCollapse = (id: string): void => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const folderProps: FolderTocProps = {
    entries: session.body.entries,
    categories,
    edges,
    focusedId: session.focusedId,
    selectedFolderId,
    collapsed: collapsedFolders,
    writeFor,
    styles,
    bookName: session.body.name,
    onSelectEntry: (id: string) => {
      setSelectedFolderId(null);
      setSession((s) => selectEntry(s, id));
    },
    onSelectFolder: (id: string) => setSelectedFolderId(id),
    onToggleCollapse: toggleCollapse,
    onPatchEntry: (id: string, patch: Partial<LorebookEntry>) =>
      setSession((s) => updateEntry(s, id, patch)),
    onToggleFolderEnabled: (id: string, on: boolean) =>
      setSession((s) => ({ ...s, body: patchCategory(s.body, id, { enabled: on }) })),
    onReparentFolder: (id: string, parent: string | null) =>
      setEdges((prev) => reparentFolder(prev, categories, id, parent)),
    onDropFolderSibling: (id: string, anchorId: string, side: "above" | "below") => {
      const anchorParent = edges.get(anchorId) ?? null;
      const nextEdges = reparentFolder(edges, categories, id, anchorParent);
      if ((nextEdges.get(id) ?? null) !== anchorParent) return;
      setEdges(nextEdges);
      setSession((s) => ({
        ...s,
        body: reorderSiblingFolder(s.body, nextEdges, id, anchorId, side),
      }));
    },
    onMoveEntryToFolder: (entryId: string, folderId: string | null) =>
      setSession((s) => updateEntry(s, entryId, { categoryId: folderId })),
    onAddFolder: () => {
      const out = addFolder(session.body, edges, "New folder");
      setEdges(out.edges);
      setSession((s) => ({ ...s, body: { ...s.body, categories: out.body.categories } }));
      setSelectedFolderId(out.id);
    },
    onAddEntry: () => {
      setSelectedFolderId(null);
      setSession((s) => addEntry(s));
    },
  };

  const inspectorProps: FolderInspectorProps | null = selectedFolder
    ? {
        category: selectedFolder,
        categories,
        edges,
        collapsed: collapsedFolders.has(selectedFolder.id),
        styles,
        onRename: (name: string) =>
          setSession((s) => ({
            ...s,
            body: patchCategory(s.body, selectedFolder.id, { name }),
          })),
        onMove: (parent: string | null) =>
          setEdges((prev) => reparentFolder(prev, categories, selectedFolder.id, parent)),
        onToggleEnabled: (on: boolean) =>
          setSession((s) => ({
            ...s,
            body: patchCategory(s.body, selectedFolder.id, { enabled: on }),
          })),
        onClone: () => {
          const out = cloneFolder(session.body, edges, selectedFolder.id);
          setEdges(out.edges);
          setSession((s) => ({ ...s, body: out.body }));
        },
        onToggleCollapse: () => toggleCollapse(selectedFolder.id),
        onDeletePromote: () => {
          const out = deleteFolderPromote(session.body, edges, selectedFolder.id);
          setEdges(out.edges);
          setSession((s) => ({ ...s, body: out.body }));
          setSelectedFolderId(null);
        },
      }
    : null;

  const markEdgesSaved = useCallback((): void => {
    setEdgesBaseline(new Map(edges));
  }, [edges]);

  const originalForSave = useCallback(
    (baseOriginal: Record<string, unknown>, cats: readonly LorebookCategory[]): Record<string, unknown> => {
      const escrowExisted = isRec(baseOriginal["marinara-lorebook"]);
      if (!escrowExisted && !edgesDirty) return baseOriginal;
      return writeMarinaraEdges(baseOriginal, edges, cats);
    },
    [edges, edgesDirty],
  );

  return {
    edgesDirty,
    markEdgesSaved,
    originalForSave,
    folderLens,
    selectedFolder,
    folderProps,
    inspectorProps,
  };
}
