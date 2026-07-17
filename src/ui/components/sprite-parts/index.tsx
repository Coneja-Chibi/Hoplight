/**
 * SpriteParts - Agnai FullSprite editor (approved vs-agnai-components).
 * visualType is a sibling field; optional onVisualTypeChange when parent wires it.
 */
import type { JSX } from "react";
import { normalizeSprite, spriteToCanonical, type SpritePartsValue } from "./core";
import styles from "./styles.module.css";

export interface SpritePartsProps {
  value: unknown;
  /** media.visualKind when the control owns both sprite recipe and visual mode */
  visualType?: string;
  onChange(sprite: Record<string, unknown>): void;
  onVisualTypeChange?(visualType: string): void;
}

export function SpriteParts({
  value,
  visualType = "sprite",
  onChange,
  onVisualTypeChange,
}: SpritePartsProps): JSX.Element {
  const s = normalizeSprite(value);
  const commit = (next: SpritePartsValue): void => onChange(spriteToCanonical(next));

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        {onVisualTypeChange && (
        <div>
          <span className={styles.lbl}>Visual type</span>
          <select
            className={styles.sel}
            value={visualType || "sprite"}
            onChange={(e) => onVisualTypeChange(e.target.value)}
          >
            <option value="sprite">sprite</option>
            <option value="avatar">avatar</option>
            <option value="none">none</option>
          </select>
        </div>
        )}
        <div>
          <span className={styles.lbl}>Gender</span>
          <select
            className={styles.sel}
            value={s.gender || ""}
            onChange={(e) => commit({ ...s, gender: e.target.value })}
          >
            <option value="">-</option>
            <option value="female">female</option>
            <option value="male">male</option>
            <option value="other">other</option>
          </select>
        </div>
        <div>
          <span className={styles.lbl}>Eyes</span>
          <input
            className={styles.color}
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(s.eyeColor) ? s.eyeColor : "#6ea8ff"}
            onChange={(e) => commit({ ...s, eyeColor: e.target.value })}
            aria-label="Eye color"
          />
        </div>
        <div>
          <span className={styles.lbl}>Body</span>
          <input
            className={styles.color}
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(s.bodyColor) ? s.bodyColor : "#c9b8a6"}
            onChange={(e) => commit({ ...s, bodyColor: e.target.value })}
            aria-label="Body color"
          />
        </div>
        <div>
          <span className={styles.lbl}>Hair</span>
          <input
            className={styles.color}
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(s.hairColor) ? s.hairColor : "#3b2f2f"}
            onChange={(e) => commit({ ...s, hairColor: e.target.value })}
            aria-label="Hair color"
          />
        </div>
      </div>
      <div className={styles.parts}>
        {Object.entries(s.parts).map(([k, v]) => (
          <div className={styles.part} key={k}>
            <button
              type="button"
              className={styles.rm}
              aria-label={`Remove ${k}`}
              onClick={() => {
                const parts = { ...s.parts };
                delete parts[k];
                commit({ ...s, parts });
              }}
            >
              ×
            </button>
            <span className={styles.lbl}>{k}</span>
            <input
              className={styles.input}
              style={{ width: "100%" }}
              value={v}
              onChange={(e) => commit({ ...s, parts: { ...s.parts, [k]: e.target.value } })}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        className={styles.add}
        onClick={() => {
          let i = 1;
          let key = "part";
          while (Object.hasOwn(s.parts, key)) {
            i += 1;
            key = `part_${i}`;
          }
          commit({ ...s, parts: { ...s.parts, [key]: "" } });
        }}
      >
        + part key
      </button>
    </div>
  );
}
