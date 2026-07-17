/**
 * VariantStrip - the portrait card's variant selector (RC-style): a Base tile plus one tile per
 * character variant, a + to add one, and (when a variant is active) a small row to rename it, pick its
 * merge mode (mirror vs full override), and remove it. Selecting a tile drives the editor's active
 * variant; the merge itself is applyVariant. Tokens only.
 */
import type { JSX } from "react";
import type { CharacterVariant } from "../../../entities/character/schema";
import styles from "./styles.module.css";

export interface VariantStripProps {
  variants: CharacterVariant[];
  activeId: string | null;
  /** the base portrait, for the Base tile background */
  artUrl: string | null;
  /** per-variant own art (only when that variant overrides media.portrait) */
  variantArt?: Readonly<Record<string, string | null>>;
  onSelect(id: string | null): void;
  onAdd(): void;
  onRemove(id: string): void;
  onRename(id: string, label: string): void;
  onMode(id: string, mirrorBase: boolean): void;
}

export function VariantStrip({
  variants,
  activeId,
  artUrl,
  variantArt = {},
  onSelect,
  onAdd,
  onRemove,
  onRename,
  onMode,
}: VariantStripProps): JSX.Element {
  const active = activeId ? variants.find((v) => v.id === activeId) ?? null : null;
  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.thumb}${activeId === null ? ` ${styles.on}` : ""}`}
          style={artUrl ? { backgroundImage: `url("${artUrl}")` } : undefined}
          onClick={() => onSelect(null)}
          title="The base character"
        >
          <i>Base</i>
        </button>
        {variants.map((v) => {
          const own = variantArt[v.id] ?? null;
          return (
            <button
              type="button"
              key={v.id}
              className={`${styles.thumb}${activeId === v.id ? ` ${styles.on}` : ""}`}
              style={own ? { backgroundImage: `url("${own}")` } : undefined}
              onClick={() => onSelect(v.id)}
              title={
                own
                  ? `${v.label || "Variant"} · own art`
                  : `${v.label || "Variant"} · inherits base art (change art while this variant is selected)`
              }
            >
              <i>{v.label || "Variant"}</i>
            </button>
          );
        })}
        <button type="button" className={styles.add} onClick={onAdd} title="Add a variant">
          +
        </button>
      </div>
      {active && (
        <div className={styles.editRow}>
          <input
            className={styles.name}
            value={active.label ?? ""}
            placeholder="Variant name"
            onChange={(e) => onRename(active.id, e.target.value)}
          />
          <label className={styles.mode} title="Full override replaces each section you edit; mirror overlays onto the base">
            <input type="checkbox" checked={active.mirrorBase === false} onChange={(e) => onMode(active.id, !e.target.checked)} />
            full
          </label>
          <button type="button" className={styles.rm} onClick={() => onRemove(active.id)} title="Remove this variant">
            remove
          </button>
        </div>
      )}
    </div>
  );
}
