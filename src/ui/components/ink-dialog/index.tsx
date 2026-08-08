/**
 * InkDialog - the modal overlay + ink-bordered sheet (transcribed 1:1 from src/ui/index.html's
 * .vdialog-overlay / .vdialog rules: dark scrim, centered sheet, 3px ink border, 6px hard offset
 * shadow). The shell's follow dialog (boot.ts's askFollow) is the reference instance this replaces.
 */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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

/** A centered modal sheet over a dark scrim; clicking the scrim or pressing Escape calls onDismiss. */
export function InkDialog({ children, onDismiss, ariaLabel, sheetClassName }: InkDialogProps): JSX.Element {
  const sheetRef = useRef<HTMLDivElement>(null);
  // Escape closes every dialog built on this seed (Menu already had its own handler; the primitive
  // under every other dialog never did, leaving scrim-click as the only way out).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      // The innermost MODAL dialog owns the press. An editor inside this sheet expanded to fullscreen
      // is its own role="dialog" over the top, and collapsing it must not also dismiss what is
      // beneath. Non-modal dialog roles (the tour rail) are deliberately not counted: they sit beside
      // this sheet rather than over it, and never owned this key.
      const inner = e.target instanceof Element ? e.target.closest('[role="dialog"][aria-modal="true"]') : null;
      if (inner && inner !== sheetRef.current) return;
      onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);
  const onOverlayClick = (e: MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onDismiss();
  };
  // Portal to the body: rendered inline, the fixed overlay is trapped inside whatever stacking
  // context its ancestor editor card creates, and page chrome paints THROUGH the modal.
  return createPortal(
    <div className={styles.overlay} onClick={onOverlayClick}>
      <div
        ref={sheetRef}
        className={sheetClassName ? `${styles.sheet} ${sheetClassName}` : styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
