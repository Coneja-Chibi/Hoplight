/**
 * FolderInspector - the folder's controls on the page column (locked wireframe
 * vs-lore-mari-folders, section C, 1:1): rename, the cycle-rule-filtered Move-to picker, the
 * subtree gate switch, clone + collapse, and promote-delete. Cascade delete exists in the Marinara
 * engine but no engine UI reaches it, so per the locked wireframe promote is the only delete here.
 */
import type { JSX } from "react";
import type { LorebookCategory } from "../../../../entities/lorebook/schema";
import { legalParents, type ParentEdges } from "./folder-tree";

export interface FolderInspectorProps {
  category: LorebookCategory;
  categories: readonly LorebookCategory[];
  edges: ParentEdges;
  collapsed: boolean;
  styles: Readonly<Record<string, string>>;
  onRename: (name: string) => void;
  onMove: (parent: string | null) => void;
  onToggleEnabled: (on: boolean) => void;
  onClone: () => void;
  onToggleCollapse: () => void;
  onDeletePromote: () => void;
}

export function FolderInspector({
  category,
  categories,
  edges,
  collapsed,
  styles,
  onRename,
  onMove,
  onToggleEnabled,
  onClone,
  onToggleCollapse,
  onDeletePromote,
}: FolderInspectorProps): JSX.Element {
  const parentId = edges.get(category.id) ?? null;
  const parent = parentId !== null ? categories.find((c) => c.id === parentId) : undefined;
  const targets = legalParents(categories, edges, category.id);
  const enabled = category.enabled !== false;

  return (
    <div className={styles.mfCard}>
      <div className={styles.mfCardHead}>
        <b>Folder</b>
        <i>
          {category.name || "(unnamed)"} · {parent ? `child of ${parent.name}` : "top level"}
        </i>
      </div>
      <div className={styles.mfCardBody}>
        <span className={styles.mfK}>Name</span>
        <input
          className={styles.mfIn}
          value={category.name}
          aria-label="Folder name"
          onChange={(ev) => onRename(ev.target.value)}
        />

        <span className={styles.mfK}>Move to</span>
        <select
          className={styles.mfSel}
          value={parentId ?? ""}
          aria-label="Move folder to"
          onChange={(ev) => onMove(ev.target.value === "" ? null : ev.target.value)}
        >
          <option value="">(top level)</option>
          {targets.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || "(unnamed)"}
            </option>
          ))}
        </select>
        <p className={styles.mfSubhint}>
          Only legal parents are listed - the folder itself, its own subfolders, and anything that
          would loop are filtered out.
        </p>

        <div className={styles.mfRuleRow}>
          <div>
            <span>Folder enabled</span>
            <p className={styles.mfSubhint}>
              Off gates every entry inside, and inside its subfolders. Each entry&apos;s own On/Off
              is kept for when you switch it back.
            </p>
          </div>
          <button
            type="button"
            className={enabled ? styles.mfSw : `${styles.mfSw} ${styles.mfSwOff}`}
            role="switch"
            aria-checked={enabled}
            aria-label={enabled ? "Folder enabled" : "Folder disabled"}
            onClick={() => onToggleEnabled(!enabled)}
          />
        </div>

        <div className={styles.mfActRow}>
          <button type="button" className={styles.mfAct} onClick={onClone}>
            Clone folder
          </button>
          <button type="button" className={styles.mfAct} onClick={onToggleCollapse}>
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>

        <div className={styles.mfDanger}>
          <button type="button" className={styles.mfDbtn} onClick={onDeletePromote}>
            Delete (promote)
          </button>
          <p className={styles.mfDangerHint}>
            Removes only this folder. Its entries drop to the root and its direct subfolders lift up
            one level. Nothing inside is lost.
          </p>
        </div>
      </div>
    </div>
  );
}
