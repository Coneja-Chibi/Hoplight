/**
 * Workshop pane header: title + mono sub + optional trailing action (undo).
 */
import type { JSX, ReactNode } from "react";
import styles from "./styles.module.css";

export interface WorkshopEheadProps {
  title: string;
  sub: string;
  trailing?: ReactNode;
}

export function WorkshopEhead({ title, sub, trailing }: WorkshopEheadProps): JSX.Element {
  return (
    <div className={styles.ehead}>
      <h2>{title}</h2>
      <span className={styles.sub}>{sub}</span>
      {trailing}
    </div>
  );
}
