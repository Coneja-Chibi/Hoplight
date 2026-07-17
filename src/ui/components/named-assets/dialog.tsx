/**
 * NamedAssetsDialog - Card assets (Risu multipurpose bag).
 */
import { useState, type JSX } from "react";
import {
  normalizeNamed,
  type AssetFileMap,
  type NamedAssetsValue,
} from "../../../core/media";
import { InkDialog } from "../ink-dialog";
import { NamedAssets } from "./index";
import styles from "./styles.module.css";

export interface NamedAssetsDialogProps {
  characterName: string;
  value: NamedAssetsValue;
  assetFiles?: AssetFileMap;
  onApply(value: NamedAssetsValue): void;
  onClose(): void;
}

export function NamedAssetsDialog({
  characterName,
  value,
  assetFiles,
  onApply,
  onClose,
}: NamedAssetsDialogProps): JSX.Element {
  const [draft, setDraft] = useState(() => normalizeNamed(value));

  return (
    <InkDialog onDismiss={onClose} ariaLabel="Card assets" sheetClassName={styles.sheet}>
      <div className={styles.head}>
        <h2 className={styles.title}>{`Card assets · ${characterName || "Character"}`}</h2>
        <button type="button" className={styles.closeX} onClick={onClose} aria-label="Close">
          X
        </button>
      </div>
      <NamedAssets value={draft} onChange={setDraft} assetFiles={assetFiles} />
      <div className={styles.foot}>
        <button type="button" className={styles.btn} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPri}`}
          onClick={() => {
            onApply(normalizeNamed(draft));
            onClose();
          }}
        >
          Apply
        </button>
      </div>
    </InkDialog>
  );
}
