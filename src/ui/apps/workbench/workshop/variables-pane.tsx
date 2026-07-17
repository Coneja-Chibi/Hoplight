/**
 * Card variables pane (mirrors Test Bench board; writes defaultVariables).
 */
import type { JSX } from "react";
import { EMPTY_VARS_MESSAGE } from "./board";
import { WorkshopEhead } from "./ehead";
import { WorkshopNotice } from "./notice";
import type { VarRow } from "./vars";
import styles from "./styles.module.css";

export interface WorkshopVariablesPaneProps {
  vars: VarRow[];
  onChange(rows: VarRow[]): void;
}

export function WorkshopVariablesPane({ vars, onChange }: WorkshopVariablesPaneProps): JSX.Element {
  return (
    <>
      <WorkshopEhead
        title="Variables"
        sub="board of starting state (also used by Test Bench)"
      />
      {vars.length === 0 && (
        <WorkshopNotice kind="empty" role="note">{EMPTY_VARS_MESSAGE}</WorkshopNotice>
      )}
      {vars.map((v, i) => (
        <div className={styles.ruleRow} key={i}>
          <input
            className={styles.var}
            value={v.name}
            placeholder="name"
            onChange={(e) => onChange(vars.map((row, j) => (j === i ? { ...v, name: e.target.value } : row)))}
          />
          <span className={styles.kw}>=</span>
          <input
            className={styles.val}
            value={v.value}
            placeholder="value"
            onChange={(e) => onChange(vars.map((row, j) => (j === i ? { ...v, value: e.target.value } : row)))}
          />
          <button
            type="button"
            className={styles.rm}
            onClick={() => onChange(vars.filter((_, j) => j !== i))}
          >
            &times;
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.add}
        onClick={() => onChange([...vars, { name: "", value: "" }])}
      >
        + add variable
      </button>
    </>
  );
}
