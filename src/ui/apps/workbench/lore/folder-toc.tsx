/**
 * MarinaraFolderToc - the binder TOC with real folders (locked wireframe vs-lore-mari-folders,
 * sections A + B, 1:1). Renders the folder forest projected from canonical categories + escrowed
 * parent edges: collapse hides a subtree, a disabled folder dims everything under it (the approved
 * proposed view), drag re-parents with the engine's three-band split (top third = sibling above,
 * middle = nest, low third = sibling below), and the bottom strip un-nests to the root. Entry rows
 * reuse the shared trow furniture so the lens adds containers, not new row vocabulary.
 */
import { useState, type DragEvent, type JSX } from "react";
import type { LorebookCategory, LorebookEntry } from "../../../../entities/lorebook/schema";
import { estimateEntryTokens, fieldVisible, type LoreWriteForProfile } from "../../../../core/lore";
import { entryFireMode, fireModePatch } from "./entry-fire-mode";
import { ModeSelect } from "./entry-toc-mode";
import {
  buildFolderForest,
  canReparentFolder,
  effectivelyDisabledFolderIds,
  folderCounts,
  type FolderNode,
  type ParentEdges,
} from "./folder-tree";

type DragPayload = { kind: "entry" | "folder"; id: string } | null;
type Band = "above" | "nest" | "below";

export interface FolderTocProps {
  entries: readonly LorebookEntry[];
  categories: readonly LorebookCategory[];
  edges: ParentEdges;
  focusedId: string | null;
  selectedFolderId: string | null;
  collapsed: ReadonlySet<string>;
  writeFor: LoreWriteForProfile;
  styles: Readonly<Record<string, string>>;
  bookName: string;
  onSelectEntry: (id: string) => void;
  onSelectFolder: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onPatchEntry: (id: string, patch: Partial<LorebookEntry>) => void;
  onToggleFolderEnabled: (id: string, on: boolean) => void;
  onReparentFolder: (id: string, parent: string | null) => void;
  /** Sibling drop (top/low band): reparent to the anchor's container AND reorder, as one op. */
  onDropFolderSibling: (id: string, anchorId: string, side: "above" | "below") => void;
  onMoveEntryToFolder: (entryId: string, folderId: string | null) => void;
  onAddFolder: () => void;
  onAddEntry: () => void;
}

/** The three-band split the engine reads from the cursor offset on a folder header. */
function bandOf(ev: DragEvent<HTMLElement>): Band {
  const rect = ev.currentTarget.getBoundingClientRect();
  const y = (ev.clientY - rect.top) / Math.max(rect.height, 1);
  return y < 1 / 3 ? "above" : y > 2 / 3 ? "below" : "nest";
}

export function MarinaraFolderToc({
  entries,
  categories,
  edges,
  focusedId,
  selectedFolderId,
  collapsed,
  writeFor,
  styles,
  bookName,
  onSelectEntry,
  onSelectFolder,
  onToggleCollapse,
  onPatchEntry,
  onToggleFolderEnabled,
  onReparentFolder,
  onDropFolderSibling,
  onMoveEntryToFolder,
  onAddFolder,
  onAddEntry,
}: FolderTocProps): JSX.Element {
  const [drag, setDrag] = useState<DragPayload>(null);
  const [over, setOver] = useState<{ folderId: string; band: Band } | null>(null);
  const [rootLive, setRootLive] = useState(false);

  const forest = buildFolderForest(categories, edges);
  const gated = effectivelyDisabledFolderIds(categories, edges);
  const counts = folderCounts(categories, edges, entries);
  const knownIds = new Set(categories.map((c) => c.id));
  const vectorOk = fieldVisible(writeFor, "vectorized");
  const canMode = fieldVisible(writeFor, "constant");
  const rootEntries = entries.filter((e) => e.categoryId === null || !knownIds.has(e.categoryId));
  const inFolder = (id: string): LorebookEntry[] => entries.filter((e) => e.categoryId === id);

  const clearDrag = (): void => {
    setDrag(null);
    setOver(null);
    setRootLive(false);
  };

  const dropOnFolder = (folderId: string, band: Band): void => {
    if (!drag) return;
    if (drag.kind === "entry") {
      // an entry drop only ever changes membership; bands reorder folders, not entries
      onMoveEntryToFolder(drag.id, folderId);
    } else if (band === "nest") {
      if (canReparentFolder(edges, drag.id, folderId, knownIds)) onReparentFolder(drag.id, folderId);
    } else if (drag.id !== folderId) {
      onDropFolderSibling(drag.id, folderId, band === "above" ? "above" : "below");
    }
    clearDrag();
  };

  const entryRow = (e: LorebookEntry, dim: boolean): JSX.Element => {
    const focused = e.id === focusedId;
    const cls = [
      styles.trow,
      focused ? styles.trowOn : "",
      !e.enabled ? styles.trowOff : "",
      dim ? styles.mfDim : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <div
        key={e.id}
        draggable
        onDragStart={(ev) => {
          setDrag({ kind: "entry", id: e.id });
          ev.dataTransfer.effectAllowed = "move";
          ev.dataTransfer.setData("text/plain", e.id);
        }}
        onDragEnd={clearDrag}
      >
        <div
          role="button"
          tabIndex={0}
          className={cls}
          onClick={() => onSelectEntry(e.id)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              onSelectEntry(e.id);
            }
          }}
        >
          <button
            type="button"
            className={e.enabled ? styles.tSlide : `${styles.tSlide} ${styles.tSlideOff}`}
            role="switch"
            aria-checked={e.enabled}
            aria-label={e.enabled ? "Entry on" : "Entry off"}
            onClick={(ev) => {
              ev.stopPropagation();
              onPatchEntry(e.id, { enabled: !e.enabled });
            }}
          />
          <div className={styles.tMain}>
            <div className={styles.tTitleRow}>
              <span className={styles.tnm}>{e.title || "(untitled)"}</span>
              <span className={styles.tokc}>~{estimateEntryTokens(e)}</span>
            </div>
            {canMode && (
              <ModeSelect
                mode={entryFireMode(e)}
                vectorOk={vectorOk}
                styles={styles}
                onChange={(m) => onPatchEntry(e.id, fireModePatch(m))}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  const folderBlock = (node: FolderNode): JSX.Element => {
    const c = node.category;
    const isCollapsed = collapsed.has(c.id);
    const isGated = gated.has(c.id);
    const own = inFolder(c.id);
    const count = counts.get(c.id) ?? { entries: 0, folders: 0 };
    const hidden = count.entries + count.folders;
    const overHere = over?.folderId === c.id ? over.band : null;
    const enabled = c.enabled !== false;

    return (
      <div key={c.id}>
        {overHere === "above" && <div className={styles.mfInsert} />}
        <div
          role="button"
          tabIndex={0}
          className={[
            styles.mfFolder,
            selectedFolderId === c.id ? styles.mfFolderSel : "",
            overHere === "nest" ? styles.mfFolderNest : "",
          ]
            .filter(Boolean)
            .join(" ")}
          draggable
          onDragStart={(ev) => {
            setDrag({ kind: "folder", id: c.id });
            ev.dataTransfer.effectAllowed = "move";
            ev.dataTransfer.setData("text/plain", c.id);
          }}
          onDragEnd={clearDrag}
          onDragOver={(ev) => {
            if (!drag || (drag.kind === "folder" && drag.id === c.id)) return;
            const band = drag.kind === "entry" ? "nest" : bandOf(ev);
            // an illegal nest target (own subtree) never lights up or accepts the drop
            if (
              drag.kind === "folder" &&
              band === "nest" &&
              !canReparentFolder(edges, drag.id, c.id, knownIds)
            ) {
              if (over?.folderId === c.id) setOver(null);
              return;
            }
            ev.preventDefault();
            ev.dataTransfer.dropEffect = "move";
            setOver({ folderId: c.id, band });
          }}
          onDragLeave={() => {
            if (over?.folderId === c.id) setOver(null);
          }}
          onDrop={(ev) => {
            ev.preventDefault();
            dropOnFolder(c.id, drag?.kind === "entry" ? "nest" : bandOf(ev));
          }}
          onClick={() => onSelectFolder(c.id)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              onSelectFolder(c.id);
            }
          }}
        >
          <button
            type="button"
            className={isCollapsed ? `${styles.mfChev} ${styles.mfChevClosed}` : styles.mfChev}
            aria-label={isCollapsed ? "Expand folder" : "Collapse folder"}
            aria-expanded={!isCollapsed}
            onClick={(ev) => {
              ev.stopPropagation();
              onToggleCollapse(c.id);
            }}
          >
            {isCollapsed ? "›" : "▾"}
          </button>
          <span className={styles.mfDragHandle} title="Drag to move or re-parent" aria-hidden="true">
            {"⠷"}
          </span>
          <span className={styles.mfName}>{c.name || "(unnamed folder)"}</span>
          <span className={styles.mfCount}>
            {isCollapsed ? `${hidden} hidden` : `${count.entries} + ${count.folders}`}
          </span>
          <button
            type="button"
            className={enabled ? styles.mfSw : `${styles.mfSw} ${styles.mfSwOff}`}
            role="switch"
            aria-checked={enabled}
            aria-label={enabled ? "Folder enabled" : "Folder disabled"}
            title={enabled ? "Folder enabled" : "Folder disabled"}
            onClick={(ev) => {
              ev.stopPropagation();
              onToggleFolderEnabled(c.id, !enabled);
            }}
          />
        </div>
        {!isCollapsed && (
          <div
            className={overHere === "nest" ? `${styles.mfBody} ${styles.mfBodyTarget}` : styles.mfBody}
          >
            {isGated && (
              <p className={styles.mfGateNote}>folder off - nothing inside fires, own toggles kept</p>
            )}
            {own.map((e) => entryRow(e, isGated))}
            {node.children.map(folderBlock)}
          </div>
        )}
        {overHere === "below" && <div className={styles.mfInsert} />}
      </div>
    );
  };

  return (
    <aside className={styles.toc} aria-label="Folders and entries">
      <p className={styles.tocTitle}>
        {bookName || "Contents"}
        <span className={styles.gcount} style={{ marginLeft: "auto" }}>
          {entries.length} {entries.length === 1 ? "entry" : "entries"} · {categories.length}{" "}
          {categories.length === 1 ? "folder" : "folders"}
        </span>
      </p>

      {rootEntries.length > 0 && <div className={styles.mfRootLab}>Loose at the root</div>}
      {rootEntries.map((e) => entryRow(e, false))}

      {forest.map(folderBlock)}

      <div
        className={rootLive ? `${styles.mfDropStrip} ${styles.mfDropStripLive}` : styles.mfDropStrip}
        onDragOver={(ev) => {
          if (!drag) return;
          ev.preventDefault();
          ev.dataTransfer.dropEffect = "move";
          setRootLive(true);
        }}
        onDragLeave={() => setRootLive(false)}
        onDrop={(ev) => {
          ev.preventDefault();
          if (drag?.kind === "entry") onMoveEntryToFolder(drag.id, null);
          else if (drag) onReparentFolder(drag.id, null);
          clearDrag();
        }}
      >
        Drop an entry or folder here to send it to the top level
      </div>

      <div className={styles.mfAddRow}>
        <button type="button" className={styles.mfAdd} onClick={onAddFolder}>
          + New folder
        </button>
        <button type="button" className={styles.mfAdd} onClick={onAddEntry}>
          + New entry
        </button>
      </div>
    </aside>
  );
}
