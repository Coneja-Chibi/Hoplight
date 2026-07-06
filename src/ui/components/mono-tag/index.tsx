/**
 * MonoTag - the tiny mono uppercase meta label (transcribed from src/ui/index.html's .docklabel
 * rule and the same look at workbench/editor.ts's .ed-k: JetBrains Mono, small size, wide
 * letter-spacing, uppercase, dim ink). Used for section headers and field keys across the shell.
 */
import type { JSX, ReactNode } from "react";
import styles from "./styles.module.css";

export interface MonoTagProps {
  children: ReactNode;
  /** drop to the fainter ink step (a quieter label among louder ones) */
  dim?: boolean;
}

/** A mono, uppercase, letter-spaced meta label. */
export function MonoTag({ children, dim }: MonoTagProps): JSX.Element {
  return <span className={dim ? styles.tagDim : styles.tag}>{children}</span>;
}
