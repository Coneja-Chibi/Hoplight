/**
 * Workshop left rail: Starters door, card parts, package parts + honesty banner.
 */
import type { JSX } from "react";
import { PACKAGE_BANNER } from "./board";
import { WorkshopNotice } from "./notice";
import type { RailPart, WorkshopPart } from "./part";
import styles from "./styles.module.css";

export interface WorkshopRailProps {
  parts: readonly RailPart[];
  part: WorkshopPart;
  onPart(id: WorkshopPart): void;
  hasPackage: boolean;
}

export function WorkshopRail({ parts, part, onPart, hasPackage }: WorkshopRailProps): JSX.Element {
  const starters = parts.filter((p) => p.id === "recipes");
  const card = parts.filter((p) => !p.id.startsWith("mod") && p.id !== "recipes");
  const pack = parts.filter((p) => p.id.startsWith("mod"));

  const btn = (p: RailPart): JSX.Element => (
    <button
      key={p.id}
      type="button"
      data-tour={p.tour}
      className={`${styles.part}${p.id === part ? ` ${styles.partOn}` : ""}${p.sealed ? ` ${styles.sealed}` : ""}`}
      onClick={() => onPart(p.id)}
    >
      <span className={styles.ico}>{p.ico}</span> {p.label}
      {p.count !== undefined && <span className={styles.ct}>{p.count}</span>}
    </button>
  );

  return (
    <nav className={styles.rail}>
      <div className={styles.railhead}>Start here</div>
      {starters.map(btn)}
      <div className={styles.railhead}>The card</div>
      {card.map(btn)}
      {hasPackage && (
        <>
          <div className={styles.railhead} data-tour="ws-package">From the package</div>
          <WorkshopNotice kind="package">{PACKAGE_BANNER}</WorkshopNotice>
          {pack.map(btn)}
        </>
      )}
    </nav>
  );
}
