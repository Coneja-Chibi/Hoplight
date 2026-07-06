/**
 * Stamp - the ink-bordered button with the hard offset shadow (transcribed 1:1 from
 * src/ui/index.html's .topbtn rule: 3px ink border, 3px hard offset shadow, hover-lift to -2,-2
 * with the shadow growing to 5px, active press flattens to 0). This is the shell's one button skin;
 * every top-strip and dialog action renders through it.
 */
import { useMemo } from "react";
import type { JSX, ReactNode } from "react";
import styles from "./styles.module.css";

export interface StampProps {
  children: ReactNode;
  onClick?: () => void;
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
      className={styles.stamp}
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
