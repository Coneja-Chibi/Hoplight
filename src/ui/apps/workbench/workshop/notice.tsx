/**
 * Workshop stage notices: warn / package banner / empty coach (one visual language).
 */
import type { JSX, ReactNode } from "react";
import styles from "./styles.module.css";

export type NoticeKind = "warn" | "package" | "empty";

export interface WorkshopNoticeProps {
  kind: NoticeKind;
  children: ReactNode;
  role?: "status" | "note";
}

export function WorkshopNotice({ kind, children, role = "status" }: WorkshopNoticeProps): JSX.Element {
  const cls =
    kind === "warn" ? styles.warn : kind === "package" ? styles.pkgban : styles.empty;
  return (
    <div className={cls} role={role}>
      {children}
    </div>
  );
}
