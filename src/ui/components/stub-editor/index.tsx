/**
 * StubEditor - a placeholder for a content-type editor that does not exist yet (Lorebook, Regex).
 * A LinkOut opens this: it shows what's attached, read-only, with an honest "full editor coming"
 * note, so the flow is real instead of a dead label. Swap the body for the real editor when it lands;
 * the LinkOut wiring stays the same. Composes the house InkDialog.
 */
import type { JSX, ReactNode } from "react";
import { InkDialog } from "../ink-dialog";
import styles from "./styles.module.css";

export interface StubEditorProps {
  title: string;
  /** the honest "coming" line */
  note: string;
  onClose(): void;
  /** a read-only view of the attached data */
  children?: ReactNode;
}

export function StubEditor({ title, note, onClose, children }: StubEditorProps): JSX.Element {
  return (
    <InkDialog onDismiss={onClose} ariaLabel={title}>
      <div className={styles.head}>{title}</div>
      <div className={styles.note}>{note}</div>
      {children ? <div className={styles.body}>{children}</div> : null}
      <button type="button" className={styles.close} onClick={onClose}>
        Close
      </button>
    </InkDialog>
  );
}
