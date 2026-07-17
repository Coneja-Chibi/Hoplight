/**
 * ExpressionMap - thin adapter over SpritePack for Lumi twin shape
 * { enabled, defaultExpression, mappings }. One pack UI; this only bridges wire form.
 */
import type { JSX } from "react";
import {
  expressionMapFromPack,
  packFromExpressionMap,
  type ExpressionMapValue,
  type SpritePackValue,
} from "../../../core/media";
import { SpritePack } from "../sprite-pack";
import styles from "./styles.module.css";

export type { ExpressionMapValue };

export interface ExpressionMapProps {
  value: unknown;
  onChange(next: ExpressionMapValue): void;
  /** When true, hide the pack enabled toggle (group row body). */
  hideEnabled?: boolean;
}

export function normalizeExpressionMap(value: unknown): ExpressionMapValue {
  return expressionMapFromPack(packFromExpressionMap(value));
}

/** Legacy row helpers kept for tests / any external callers. */
export function mappingsToRows(mappings: unknown): { label: string; imageId: string }[] {
  if (!mappings || typeof mappings !== "object" || Array.isArray(mappings)) return [];
  return Object.entries(mappings as Record<string, unknown>).map(([label, imageId]) => ({
    label,
    imageId: typeof imageId === "string" ? imageId : "",
  }));
}

export function rowsToMappings(rows: { label?: unknown; imageId?: unknown }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (!label) continue;
    out[label] = typeof row.imageId === "string" ? row.imageId : "";
  }
  return out;
}

export function ExpressionMap({ value, onChange, hideEnabled }: ExpressionMapProps): JSX.Element {
  const pack = packFromExpressionMap(value);

  const setPack = (next: SpritePackValue): void => {
    onChange(expressionMapFromPack(next));
  };

  return (
    <div className={styles.wrap}>
      <p className={styles.note}>
        Same pack editor as Manage Sprites. This field is the Lumi wire shape only.
      </p>
      <SpritePack
        value={pack}
        onChange={setPack}
        showEnabled={!hideEnabled}
        showDefault
      />
    </div>
  );
}
