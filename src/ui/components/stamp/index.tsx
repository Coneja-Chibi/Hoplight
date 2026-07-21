/**
 * Stamp - the shell's one button skin: the canonical global `.stamp` (theme/tokens.css) supplies the
 * ink border, the hard offset shadow cast in --ink, and the beloved rest/hover-lift/press interaction;
 * this module adds only the typography and fill. Composed, not duplicated - the shadow stays theme-true
 * (cream on the dark forge, ink on paper) so the button never flattens into an invisible rectangle.
 * Every top-strip and dialog action renders through it.
 */
import { useMemo } from "react";
import type { JSX, MouseEventHandler, ReactNode } from "react";
import styles from "./styles.module.css";

export interface StampProps {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  /** background paint override (defaults to the chrome token); never the brand rose except CTAs */
  accent?: string;
  title?: string;
  type?: "button" | "submit" | "reset";
  /** passthrough for a consumer's own id-scoped CSS (e.g. index.html's `#themeBtn` square sizing) */
  id?: string;
  "aria-label"?: string;
}

/** The stamp button: rest sits flush, hover lifts and grows its shadow, active presses flat. */
export function Stamp({
  children,
  onClick,
  disabled,
  accent,
  title,
  type = "button",
  id,
  "aria-label": ariaLabel,
}: StampProps): JSX.Element {
  const style = useMemo(() => (accent ? { background: accent } : undefined), [accent]);
  return (
    <button
      id={id}
      type={type}
      className={`stamp ${styles.topbtn}`}
      style={style}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
