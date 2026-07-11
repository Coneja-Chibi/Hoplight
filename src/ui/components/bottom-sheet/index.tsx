/**
 * BottomSheet - a sheet that slides up from the bottom edge of its pane, over a scrim.
 * The narrow-pane sibling of InkDialog (design/vs-mobile-editors.html frames 2 and 4).
 * Positions absolutely, so the hosting pane (.paneWrap) must be a positioned ancestor.
 */
import type { JSX, ReactNode } from "react";
import styles from "./styles.module.css";

export interface BottomSheetProps {
  title: string;
  ariaLabel?: string;
  onDismiss(): void;
  /** Optional control rendered at the right edge of the title row (e.g. a Select toggle). */
  titleAction?: ReactNode;
  /** Optional full-width action pinned above the sheet's bottom edge (e.g. + New entry). */
  footerAction?: ReactNode;
  children: ReactNode;
}

/** A scrim + grab-handle sheet docked to the pane's bottom; clicking the scrim dismisses. */
export function BottomSheet({ title, ariaLabel, onDismiss, titleAction, footerAction, children }: BottomSheetProps): JSX.Element {
  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onDismiss}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className={styles.grab} aria-hidden="true" />
        <div className={styles.titleRow}>
          <b className={styles.title}>{title}</b>
          {titleAction}
          <button type="button" className={styles.closeX} aria-label="Close" onClick={onDismiss}>
            &times;
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footerAction !== undefined && <div className={styles.footer}>{footerAction}</div>}
      </div>
    </div>
  );
}
