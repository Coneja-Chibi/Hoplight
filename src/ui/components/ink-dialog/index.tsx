/**
 * InkDialog - the modal overlay + ink-bordered sheet (transcribed 1:1 from src/ui/index.html's
 * .vdialog-overlay / .vdialog rules: dark scrim, centered sheet, 3px ink border, 6px hard offset
 * shadow). The shell's follow dialog (boot.ts's askFollow) is the reference instance this replaces.
 */
import type { JSX, MouseEvent, ReactNode } from "react";
import styles from "./styles.module.css";

export interface InkDialogProps {
  children: ReactNode;
  /** fires on a click on the scrim itself (not a click bubbling up from the sheet) */
  onDismiss: () => void;
  ariaLabel: string;
  /** extra class on the sheet (e.g. "vdialog" so a consumer's existing global descendant rules,
   * like ".vdialog .actions button", keep applying without this seed knowing their names) */
  sheetClassName?: string;
}

/** A centered modal sheet over a dark scrim; clicking the scrim calls onDismiss. */
export function InkDialog({ children, onDismiss, ariaLabel, sheetClassName }: InkDialogProps): JSX.Element {
  const onOverlayClick = (e: MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onDismiss();
  };
  return (
    <div className={styles.overlay} onClick={onOverlayClick}>
      <div
        className={sheetClassName ? `${styles.sheet} ${sheetClassName}` : styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>
  );
}
