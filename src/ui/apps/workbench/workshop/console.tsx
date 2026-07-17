/**
 * Workshop Test Bench: event picker, Run rules / package scripts, vars board, log.
 */
import type { JSX } from "react";
import { EMPTY_VARS_MESSAGE } from "./board";
import { MiniSelect, WORKSHOP_EVENTS } from "./mini-select";
import { WorkshopNotice } from "./notice";
import type { VarRow } from "./vars";
import styles from "./styles.module.css";

export type ConsoleLogLine = { cls: string; text: string };
export type ConsoleDelta = { name: string; before: string; after: string; moved: boolean };

export interface WorkshopConsoleProps {
  event: string;
  onEvent(v: string): void;
  vars: VarRow[];
  onVars(rows: VarRow[]): void;
  delta: ConsoleDelta[];
  moved: ReadonlySet<string>;
  log: ConsoleLogLine[];
  luaBusy: boolean;
  hasPackage: boolean;
  onRunRules(): void;
  onRunPackage(): void;
}

export function WorkshopConsole(props: WorkshopConsoleProps): JSX.Element {
  const {
    event, onEvent, vars, onVars, delta, moved, log, luaBusy, hasPackage, onRunRules, onRunPackage,
  } = props;

  const setAt = (i: number, row: VarRow): void =>
    onVars(vars.map((v, j) => (j === i ? row : v)));

  return (
    <aside className={styles.console} data-tour="ws-bench">
      <div className={styles.conhead}>
        <span className={styles.dot} /> Test Bench
        <MiniSelect opts={WORKSHOP_EVENTS} value={event} onChange={onEvent} />
        <button
          type="button"
          className={styles.runBtn}
          data-tour="ws-run"
          onClick={onRunRules}
          disabled={luaBusy}
        >
          Run rules
        </button>
        {hasPackage && (
          <button
            type="button"
            className={`${styles.runBtn} ${styles.runBtnSec}`}
            onClick={onRunPackage}
            disabled={luaBusy}
            title="Advanced: load package scripts in the sealed room"
          >
            {luaBusy ? "Loading..." : "Run package scripts"}
          </button>
        )}
      </div>
      <div className={styles.vars} data-tour="ws-vars">
        <div className={styles.vlabel}>Variables · world before Run</div>
        {vars.length === 0 ? (
          <WorkshopNotice kind="empty" role="note">{EMPTY_VARS_MESSAGE}</WorkshopNotice>
        ) : (
          vars.map((v, i) => (
            <div
              className={`${styles.varRow}${v.name && moved.has(v.name) ? ` ${styles.varRowMoved}` : ""}`}
              key={i}
            >
              <input
                className={`${styles.vin} ${styles.vinName}`}
                value={v.name}
                placeholder="name"
                onChange={(e) => setAt(i, { ...v, name: e.target.value })}
              />
              <input
                className={styles.vin}
                value={v.value}
                placeholder="value"
                onChange={(e) => setAt(i, { ...v, value: e.target.value })}
              />
              <button
                type="button"
                className={styles.rm}
                onClick={() => onVars(vars.filter((_, j) => j !== i))}
              >
                &times;
              </button>
            </div>
          ))
        )}
        <button
          type="button"
          className={styles.addmini}
          style={{ width: "100%" }}
          onClick={() => onVars([...vars, { name: "", value: "" }])}
        >
          + add variable
        </button>
        {delta.length > 0 && (
          <>
            <div className={styles.vlabel} style={{ marginTop: "0.7rem" }}>After Run · moved first</div>
            <div className={styles.delta}>
              {delta.map((d) => (
                <span
                  key={d.name}
                  className={`${styles.vpill}${d.moved ? ` ${styles.vpillMoved}` : ""}`}
                >
                  <b>{d.name}</b> {d.moved ? `${d.before || "0"} -> ` : ""}{d.after}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
      <div className={styles.log}>
        {log.length === 0
          ? "> press Run rules to fire the current event."
          : log.map((l, i) => (
            <div key={i} className={l.cls}>{l.text}</div>
          ))}
      </div>
    </aside>
  );
}
