/**
 * ResponseSchema - Agnai json ResponseSchema editor (approved wireframe).
 */
import type { JSX } from "react";
import {
  normalizeSchema,
  schemaToWire,
  type ResponseSchemaValue,
  type SchemaField,
} from "./core";
import styles from "./styles.module.css";

export interface ResponseSchemaProps {
  value: unknown;
  onChange(next: Record<string, unknown>): void;
}

export function ResponseSchema({ value, onChange }: ResponseSchemaProps): JSX.Element {
  const s = normalizeSchema(value);
  const commit = (next: ResponseSchemaValue): void => onChange(schemaToWire(next));

  const setField = (i: number, patch: Partial<SchemaField>): void => {
    const fields = s.fields.map((f, j) => (j === i ? { ...f, ...patch } : f));
    commit({ ...s, fields });
  };

  return (
    <div className={styles.wrap}>
      <span className={styles.lbl}>Fields</span>
      {s.fields.map((f, i) => (
        <div className={styles.row} key={i}>
          <input
            className={`${styles.input} ${styles.name}`}
            value={f.name}
            placeholder="name"
            onChange={(e) => setField(i, { name: e.target.value })}
          />
          <select
            className={styles.sel}
            value={f.type || "string"}
            onChange={(e) => setField(i, { type: e.target.value })}
          >
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
          </select>
          <input
            className={styles.input}
            value={f.description}
            placeholder="description"
            onChange={(e) => setField(i, { description: e.target.value })}
          />
          <button
            type="button"
            className={styles.rm}
            onClick={() => commit({ ...s, fields: s.fields.filter((_, j) => j !== i) })}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.add}
        onClick={() =>
          commit({
            ...s,
            fields: [...s.fields, { name: "", type: "string", description: "" }],
          })
        }
      >
        + field
      </button>
      <div className={styles.grid}>
        <div>
          <span className={styles.lbl}>System prompt</span>
          <textarea
            className={styles.ta}
            value={s.systemPrompt}
            onChange={(e) => commit({ ...s, systemPrompt: e.target.value })}
          />
        </div>
        <div>
          <span className={styles.lbl}>Jailbreak</span>
          <textarea
            className={styles.ta}
            value={s.jailbreak}
            onChange={(e) => commit({ ...s, jailbreak: e.target.value })}
          />
        </div>
        <div>
          <span className={styles.lbl}>History slot</span>
          <textarea
            className={styles.ta}
            value={s.history}
            onChange={(e) => commit({ ...s, history: e.target.value })}
          />
        </div>
        <div>
          <span className={styles.lbl}>Image caption</span>
          <textarea
            className={styles.ta}
            value={s.imageCaption}
            onChange={(e) => commit({ ...s, imageCaption: e.target.value })}
          />
        </div>
      </div>
      <div>
        <span className={styles.lbl}>Response slot</span>
        <textarea
          className={styles.ta}
          value={s.response}
          onChange={(e) => commit({ ...s, response: e.target.value })}
        />
      </div>
    </div>
  );
}
