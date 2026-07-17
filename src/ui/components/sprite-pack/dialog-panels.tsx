/**
 * Attach / sprite-sheet tool panels for SpritePackDialog.
 * Extracted so dialog.tsx stays under the line cap.
 */
import type { JSX, RefObject } from "react";
import styles from "./styles.module.css";

export type PackCatalogEntry = {
  id: string;
  name: string;
};

export function AttachPanel({
  packCatalog,
  attachId,
  attachBusy,
  onAttachId,
  onAttach,
}: {
  packCatalog: readonly PackCatalogEntry[];
  attachId: string;
  attachBusy: boolean;
  onAttachId(id: string): void;
  onAttach(): void;
}): JSX.Element {
  return (
    <div className={styles.attach}>
      <span className={styles.attachLbl}>Copy pack from card</span>
      <select
        className={styles.attachSel}
        value={attachId}
        onChange={(e) => onAttachId(e.target.value)}
        aria-label="Source character"
      >
        <option value="">Pick a card…</option>
        {packCatalog.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={styles.toolBtn}
        disabled={!attachId || attachBusy}
        onClick={onAttach}
      >
        {attachBusy ? "Loading…" : "Attach"}
      </button>
    </div>
  );
}

export function SheetSlicePanel({
  sheetCols,
  sheetRows,
  sheetRef,
  onCols,
  onRows,
  onPick,
  onFile,
}: {
  sheetCols: number;
  sheetRows: number;
  sheetRef: RefObject<HTMLInputElement | null>;
  onCols(n: number): void;
  onRows(n: number): void;
  onPick(): void;
  onFile(file: File | undefined): void;
}): JSX.Element {
  return (
    <div className={styles.attach}>
      <span className={styles.attachLbl}>Sprite sheet</span>
      <label className={styles.attachLbl}>
        cols
        <input
          className={styles.sheetNum}
          type="number"
          min={1}
          max={16}
          value={sheetCols}
          onChange={(e) => onCols(Number(e.target.value) || 1)}
          aria-label="Sheet columns"
        />
      </label>
      <label className={styles.attachLbl}>
        rows
        <input
          className={styles.sheetNum}
          type="number"
          min={1}
          max={16}
          value={sheetRows}
          onChange={(e) => onRows(Number(e.target.value) || 1)}
          aria-label="Sheet rows"
        />
      </label>
      <button
        type="button"
        className={styles.toolBtn}
        onClick={onPick}
        title="Slice a grid sheet into pack faces"
      >
        Slice sheet
      </button>
      <input
        ref={sheetRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        className={styles.hidden}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
