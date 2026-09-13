/**
 * BottomSheet - a sheet that slides up from the bottom edge of its pane, over a scrim.
 * The narrow-pane sibling of InkDialog (design/vs-mobile-editors.html frames 2 and 4).
 * Positions absolutely, so the hosting pane (.paneWrap) must be a positioned ancestor.
 */
import { useEffect, useRef, type JSX, type ReactNode } from "react";
import styles from "./styles.module.css";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "summary",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const visibleIn = (element: HTMLElement, sheet: HTMLElement): boolean => {
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  const closedDetails = element.closest("details:not([open])");
  if (closedDetails && !closedDetails.querySelector(":scope > summary")?.contains(element)) return false;
  const view = element.ownerDocument.defaultView;
  for (let node: HTMLElement | null = element; node && sheet.contains(node); node = node.parentElement) {
    const style = view?.getComputedStyle(node);
    if (style && (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse")) return false;
  }
  return true;
};

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
  const sheetRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const sheet = sheetRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    sheet?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dismissRef.current();
        return;
      }
      if (event.key !== "Tab" || !sheet) return;
      const focusable = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter((element) => visibleIn(element, sheet));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        sheet.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === sheet)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (
        document.activeElement === last
        || document.activeElement === sheet
        || !sheet.contains(document.activeElement)
      )) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (!previous?.isConnected) return;
      previous.focus();
      queueMicrotask(() => {
        if (previous.isConnected) previous.focus();
      });
    };
  }, []);

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onDismiss}>
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        tabIndex={-1}
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
