/**
 * PackStrip - compact expression thumbs under the portrait.
 * Click = preview face. Double-click = open Manage Sprites focused on that label.
 */
import type { JSX } from "react";
import { normalizePack, type SpritePackValue } from "../../../core/media";
import styles from "./styles.module.css";

export interface PackStripProps {
  pack: SpritePackValue;
  activeLabel?: string | null;
  onSelect?(label: string): void;
  onOpenPack?(focusLabel?: string): void;
}

export function PackStrip({
  pack,
  activeLabel,
  onSelect,
  onOpenPack,
}: PackStripProps): JSX.Element | null {
  const p = normalizePack(pack);
  if (p.items.length === 0 && !onOpenPack) return null;

  return (
    <div className={styles.strip} aria-label="Expression pack">
      {p.items.map((it) => {
        const on =
          activeLabel !== undefined &&
          activeLabel !== null &&
          it.label.toLowerCase() === activeLabel.toLowerCase();
        return (
          <button
            key={it.id}
            type="button"
            className={`${styles.thumb}${on ? ` ${styles.on}` : ""}`}
            title={`${it.label} · double-click to edit in Manage Sprites`}
            onClick={() => onSelect?.(it.label)}
            onDoubleClick={(e) => {
              e.preventDefault();
              onOpenPack?.(it.label);
            }}
          >
            {it.ref ? <img src={it.ref} alt="" /> : <span className={styles.ph}>?</span>}
            <i>{it.label}</i>
          </button>
        );
      })}
      {onOpenPack ? (
        <button
          type="button"
          className={styles.add}
          title="Manage sprites"
          onClick={() => onOpenPack()}
        >
          +
        </button>
      ) : null}
    </div>
  );
}
