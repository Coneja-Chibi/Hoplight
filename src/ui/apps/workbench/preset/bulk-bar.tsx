/**
 * BulkBar - the selection action bar (a port of RC's PromptListV4 bulk actions). Appears only when
 * rows are checked: "N selected", Clear, then enable / disable / duplicate / delete. RC hides these
 * behind an "Actions" dropdown; there are only four, so they sit inline here rather than behind an
 * extra click. Delete is separated and styled as the destructive one.
 */
import type { JSX } from "react";
import { Check, Copy, Trash2, X } from "lucide-react";
import s from "./toolbar.module.css";

export interface BulkBarProps {
  count: number;
  onClear: () => void;
  onEnable: () => void;
  onDisable: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function BulkBar({ count, onClear, onEnable, onDisable, onDuplicate, onDelete }: BulkBarProps): JSX.Element | null {
  if (count === 0) return null;
  return (
    <div className={s.bulk} role="toolbar" aria-label="Bulk actions">
      <span className={s.bulkCount}>{count} selected</span>
      <button type="button" className={s.bulkBtn} onClick={onClear}>
        Clear
      </button>
      <span className={s.bulkSep} />
      <button type="button" className={s.bulkBtn} onClick={onEnable}>
        <Check size={13} />
        Enable
      </button>
      <button type="button" className={s.bulkBtn} onClick={onDisable}>
        <X size={13} />
        Disable
      </button>
      <button type="button" className={s.bulkBtn} onClick={onDuplicate}>
        <Copy size={13} />
        Duplicate
      </button>
      <button type="button" className={`${s.bulkBtn} ${s.bulkDanger}`} onClick={onDelete}>
        <Trash2 size={13} />
        Delete
      </button>
    </div>
  );
}
