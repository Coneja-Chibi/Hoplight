/**
 * ExpressionGroups - Lumiverse multi-character expression packs.
 * Wire: extensions.expression_groups Record<charName, Record<label, imageId>>.
 */
import type { JSX } from "react";
import { ExpressionMap, normalizeExpressionMap, type ExpressionMapValue } from "./index";
import styles from "./groups.module.css";

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : "");

export interface ExpressionGroupsProps {
  value: unknown;
  onChange(next: Record<string, Record<string, string>>): void;
}

interface GroupRow {
  name: string;
  map: ExpressionMapValue;
}

function toRows(value: unknown): GroupRow[] {
  const v = rec(value);
  return Object.entries(v).map(([name, mappings]) => ({
    name,
    map: normalizeExpressionMap({ enabled: true, mappings }),
  }));
}

function fromRows(rows: GroupRow[]): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    out[name] = row.map.mappings ?? {};
  }
  return out;
}

export function ExpressionGroups({ value, onChange }: ExpressionGroupsProps): JSX.Element {
  const rows = toRows(value);

  const write = (next: GroupRow[]): void => onChange(fromRows(next));

  return (
    <div className={styles.wrap}>
      {rows.map((row, i) => (
        <div className={styles.group} key={i}>
          <div className={styles.head}>
            <input
              className={styles.name}
              value={row.name}
              placeholder="Character name"
              onChange={(e) => {
                const next = rows.map((r, ix) => (ix === i ? { ...r, name: e.target.value } : r));
                write(next);
              }}
            />
            <button
              type="button"
              className={styles.rm}
              onClick={() => write(rows.filter((_, ix) => ix !== i))}
            >
              remove
            </button>
          </div>
          <ExpressionMap
            hideEnabled
            value={row.map}
            onChange={(map) => {
              const next = rows.map((r, ix) => (ix === i ? { ...r, map } : r));
              write(next);
            }}
          />
        </div>
      ))}
      <button
        type="button"
        className={styles.add}
        onClick={() => write([...rows, { name: "", map: { enabled: true, mappings: {} } }])}
      >
        + add character group
      </button>
    </div>
  );
}
