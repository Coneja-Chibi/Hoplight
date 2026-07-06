/**
 * Focus mode - the reusable editor fullscreen (CONTRACT V2 port of the deleted _shared/focus.ts).
 * useFocusMode owns the body.focus-editor class and its Esc-to-exit listener; the shell's own css
 * hides the chrome (dock, top strip, tab strip) whenever that class is set, so the active pane
 * fills the window. FocusToggle is the icon button any editing surface can mount (a crumb bar, a
 * toolbar). Session-scoped by design: focus is a gesture, not a setting, so it is never persisted
 * and unmounting always exits focus - no surface can leave the shell chrome hidden behind it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import styles from "./styles.module.css";

const FOCUS_CLASS = "focus-editor";

const EXPAND_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"/></svg>';
const SHRINK_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M3 9h6V3M21 9h-6V3M3 15h6v6M21 15h-6v6"/></svg>';

const isFocused = (): boolean => document.body.classList.contains(FOCUS_CLASS);

/** Owns the body class + its Esc listener; unmounting always exits focus. */
export function useFocusMode(): { focused: boolean; toggle(): void } {
  const [focused, setFocused] = useState(isFocused);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || !isFocused()) return;
      document.body.classList.remove(FOCUS_CLASS);
      setFocused(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove(FOCUS_CLASS); // never leave the shell chrome hidden on unmount
    };
  }, []);

  const toggle = useCallback((): void => {
    const next = !isFocused();
    document.body.classList.toggle(FOCUS_CLASS, next);
    setFocused(next);
  }, []);

  return { focused, toggle };
}

export interface FocusToggleProps {
  /** current focus state (read via useFocusMode - lifted to the caller so a room's own layout can
   * react to the same value without a second, desynced hook instance) */
  focused: boolean;
  onToggle(): void;
}

/** The expand/shrink icon button. Static first-party markup parsed via DOMParser + importNode
 * (the house rule: no innerHTML/dangerouslySetInnerHTML). Controlled: pair it with useFocusMode. */
export function FocusToggle({ focused, onToggle }: FocusToggleProps): JSX.Element {
  const iconHostRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = iconHostRef.current;
    if (!host) return;
    host.replaceChildren();
    const root = new DOMParser().parseFromString(focused ? SHRINK_SVG : EXPAND_SVG, "image/svg+xml").documentElement;
    host.append(document.importNode(root, true));
  }, [focused]);

  const label = focused ? "Exit focus (Esc)" : "Focus: hide the chrome, fill the window";
  return (
    <button
      type="button"
      className={styles.btn}
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={focused}
    >
      <span ref={iconHostRef} aria-hidden="true" />
    </button>
  );
}
