/**
 * StructuredPersona - Agnai persona kind + attribute map editor (approved vs-agnai-components).
 */
import { useState, type JSX, type KeyboardEvent } from "react";
import {
  PERSONA_KINDS,
  addAttribute,
  normalizePersona,
  removeAttribute,
  setAttributeKey,
  setAttributeValues,
  setKind,
  toWire,
  type PersonaKind,
} from "./core";
import styles from "./styles.module.css";

export interface StructuredPersonaProps {
  value: unknown;
  onChange(next: Record<string, unknown>): void;
}

export function StructuredPersona({ value, onChange }: StructuredPersonaProps): JSX.Element {
  const persona = normalizePersona(value);
  const commit = (next: ReturnType<typeof normalizePersona>): void => onChange(toWire(next));

  return (
    <div className={styles.wrap}>
      <div className={styles.kinds} role="group" aria-label="Persona format">
        {PERSONA_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className={persona.kind === k ? `${styles.kind} ${styles.kindOn}` : styles.kind}
            onClick={() => commit(setKind(persona, k))}
          >
            {k}
          </button>
        ))}
      </div>

      {persona.kind === "text" ? (
        <p className={styles.hint}>
          Plain text lives in the Personality field. Pick attributes, W++, SBF, or boostyle for a trait map.
        </p>
      ) : (
        <>
          {Object.entries(persona.attributes).map(([key, vals]) => (
            <AttrRow
              key={key}
              attrKey={key}
              values={vals}
              onKeyChange={(nk) => commit(setAttributeKey(persona, key, nk))}
              onValuesChange={(vs) => commit(setAttributeValues(persona, key, vs))}
              onRemove={() => commit(removeAttribute(persona, key))}
            />
          ))}
          <button type="button" className={styles.add} onClick={() => commit(addAttribute(persona))}>
            + attribute row
          </button>
        </>
      )}
    </div>
  );
}

function AttrRow(props: {
  attrKey: string;
  values: string[];
  onKeyChange(k: string): void;
  onValuesChange(v: string[]): void;
  onRemove(): void;
}): JSX.Element {
  const { attrKey, values, onKeyChange, onValuesChange, onRemove } = props;
  const [draft, setDraft] = useState("");

  const add = (): void => {
    const t = draft.trim();
    if (!t) return;
    onValuesChange([...values.filter(Boolean), t]);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  return (
    <div className={styles.attr}>
      <div className={styles.top}>
        <input
          className={styles.key}
          value={attrKey}
          onChange={(e) => onKeyChange(e.target.value)}
          aria-label="Attribute name"
        />
        <button type="button" className={styles.rm} onClick={onRemove}>
          remove
        </button>
      </div>
      <div className={styles.chips}>
        {values.filter(Boolean).map((v, i) => (
          <span className={styles.chip} key={`${v}-${i}`}>
            {v}
            <button
              type="button"
              className={styles.chipX}
              aria-label={`Remove ${v}`}
              onClick={() => onValuesChange(values.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className={styles.chipInput}
          value={draft}
          placeholder="+ value"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={add}
        />
      </div>
    </div>
  );
}

export type { PersonaKind };
