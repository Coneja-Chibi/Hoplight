/**
 * LinkOut - a reusable selector/link to ANOTHER editor. Lorebooks and regex are their own content
 * types in Hoplight, so on a character card they appear as this: a chip that shows what's attached and
 * jumps to the dedicated editor (wired via onAction once that editor exists; until then it renders a
 * quiet "opens here soon" stub, never a fake button). An empty state offers to attach one.
 */
import type { JSX, ReactNode } from "react";
import styles from "./styles.module.css";

export interface LinkOutProps {
  /** an optional leading line-icon (JSX SVG only - no emoji per house rule) */
  icon?: ReactNode;
  /** the attached thing's name / summary ("Aldergrove Chronicle", "3 scripts") */
  title: string;
  /** secondary line ("embedded - 12 entries") */
  meta?: string;
  /** the action label ("Open in Lorebook editor"); the click is onAction */
  action?: string;
  /** wired when the target editor exists; absent = the action renders as a pending stub */
  onAction?(): void;
  /** nothing attached yet */
  empty?: boolean;
  emptyLabel?: string;
}

export function LinkOut({ icon, title, meta, action, onAction, empty, emptyLabel }: LinkOutProps): JSX.Element {
  if (empty) {
    return <div className={styles.empty}>{emptyLabel ?? "Nothing attached"}</div>;
  }
  return (
    <div className={styles.row}>
      {icon ? (
        <span className={styles.ic} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className={styles.body}>
        <div className={styles.title}>{title}</div>
        {meta ? <div className={styles.meta}>{meta}</div> : null}
      </div>
      {action ? (
        onAction ? (
          <button type="button" className={styles.go} onClick={onAction}>
            {action} &rarr;
          </button>
        ) : (
          <span className={styles.pending} title="Opens here when that editor lands">
            {action}
          </span>
        )
      ) : null}
    </div>
  );
}
