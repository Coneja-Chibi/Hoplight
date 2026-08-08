/**
 * ExpandBox - the fullscreen affordance every multi-line editor in the Studio wears. Collapsed it is
 * the editor exactly as its own stylesheet drew it, plus a corner control; expanded, the SAME editor
 * element moves into a full-viewport modal sheet so a long prompt can be read without a 3-line well.
 *
 * The editor moves rather than duplicates (two live textareas over one value is a data-loss bug
 * waiting to happen), so the DOM node is recreated by the swap and the caret has to be carried across
 * by hand - that is what expand-core's caret helpers are for. ExpandTextarea is the drop-in for the
 * common case: a plain textarea whose value lives in its parent.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { JSX, ReactNode, TextareaHTMLAttributes } from "react";
import { applyCaret, isEscapeClose, readCaret, trapTarget, type Caret } from "./expand-core";
import styles from "./styles.module.css";

/** everything a Tab can land on inside the sheet, in document order. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** the text control the box is wrapping: the first one inside the frame, either side of the swap. */
const editorIn = (root: HTMLElement | null): HTMLTextAreaElement | null => root?.querySelector("textarea") ?? null;

export interface ExpandBoxProps {
  /** names the editor on the control and as the dialog's title ("Block content") */
  label: string;
  children: ReactNode;
  /** fires on every toggle; editors with caret-anchored popovers use it to drop stale overlays */
  onExpandedChange?: (expanded: boolean) => void;
}

/** Wraps one editor with an expand control and the fullscreen sheet it expands into. */
export function ExpandBox({ label, children, onExpandedChange }: ExpandBoxProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const inlineRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const caretRef = useRef<Caret | null>(null);
  const everOpened = useRef(false);
  const titleId = useId();

  const open = useCallback((): void => {
    const ta = editorIn(inlineRef.current);
    caretRef.current = ta ? readCaret(ta) : null;
    setExpanded(true);
    onExpandedChange?.(true);
  }, [onExpandedChange]);

  const close = useCallback((): void => {
    const ta = editorIn(sheetRef.current);
    caretRef.current = ta ? readCaret(ta) : null;
    setExpanded(false);
    onExpandedChange?.(false);
  }, [onExpandedChange]);

  // The swap has happened by the time this runs, so the ref points at the new element.
  useEffect(() => {
    const caret = caretRef.current;
    caretRef.current = null;
    if (expanded) {
      everOpened.current = true;
      const ta = editorIn(sheetRef.current);
      if (!ta) return;
      ta.focus();
      if (caret) applyCaret(ta, caret);
      return;
    }
    if (!everOpened.current) return; // first render: nothing was open, so nothing may steal focus
    everOpened.current = false;
    // Closing owes two things at once: the caret goes back to the inline editor, but FOCUS goes back
    // to the control the user pressed, which is where a keyboard user expects to be standing. So set
    // the range without focusing - the caret is already correct the moment they click or tab back in.
    const ta = editorIn(inlineRef.current);
    if (ta && caret) applyCaret(ta, caret);
    triggerRef.current?.focus();
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent): void => {
      if (isEscapeClose(e)) {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const items = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const active = document.activeElement;
      const next = trapTarget(items, active instanceof HTMLElement ? active : null, e.shiftKey);
      if (!next) return;
      e.preventDefault();
      next.focus();
    };
    // Bubble phase on document, so an editor that already handled the press (CodeEditor's macro
    // popover) has marked it defaultPrevented before the close rule sees it.
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded, close]);

  return (
    <div ref={inlineRef} className={styles.frame}>
      {expanded ? <div className={styles.away}>Editing fullscreen</div> : children}
      <button
        type="button"
        ref={triggerRef}
        className={`${styles.toggle} ${styles.inlineToggle}`}
        onClick={open}
        aria-expanded={expanded}
        aria-label={`Expand ${label}`}
      >
        Expand
      </button>
      {expanded &&
        createPortal(
          // Portalled to the body: rendered in place, a fixed overlay is trapped inside whatever
          // stacking context or overflow clip the editor's card creates.
          <div className={styles.scrim}>
            <div ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId}>
              <div className={styles.head}>
                <span className={styles.title} id={titleId}>
                  {label}
                </span>
                <span className={styles.hint}>Esc closes</span>
                <button type="button" className={styles.toggle} onClick={close} aria-label={`Collapse ${label}`}>
                  Collapse
                </button>
              </div>
              <div className={styles.body}>{children}</div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export interface ExpandTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** names the editor on the control and as the dialog's title */
  label: string;
}

/** A textarea that can go fullscreen: drop-in for a raw one, same props, same value ownership. */
export function ExpandTextarea({ label, ...rest }: ExpandTextareaProps): JSX.Element {
  return (
    <ExpandBox label={label}>
      <textarea {...rest} />
    </ExpandBox>
  );
}
