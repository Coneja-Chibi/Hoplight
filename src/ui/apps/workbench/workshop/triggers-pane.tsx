/**
 * Triggers list pane: cards + add rule + optional undo trailing.
 */
import type { JSX, ReactNode } from "react";
import type { TriggerScript } from "../../../../entities/character/schema";
import { appendTo } from "../behavior-edit";
import { WorkshopEhead } from "./ehead";
import { WorkshopTriggerCard } from "./trigger-card";
import type { VarRow } from "./vars";
import styles from "./styles.module.css";

export interface WorkshopTriggersPaneProps {
  triggers: TriggerScript[];
  onWrite(next: TriggerScript[]): void;
  undo: ReactNode;
  vars?: readonly VarRow[];
}

export function WorkshopTriggersPane({
  triggers,
  onWrite,
  undo,
  vars = [],
}: WorkshopTriggersPaneProps): JSX.Element {
  return (
    <>
      <WorkshopEhead
        title="Triggers"
        sub="WHEN this happens, IF these hold, THEN do that"
        trailing={undo}
      />
      {triggers.map((t, ti) => (
        <WorkshopTriggerCard key={ti} trigger={t} index={ti} triggers={triggers} onWrite={onWrite} vars={vars} />
      ))}
      <button
        type="button"
        className={styles.add}
        onClick={() => onWrite(appendTo(triggers, {
          label: "new rule",
          event: "output",
          conditions: [{ type: "var", var: "", operator: "=", value: "" }],
          effects: [{ type: "setvar", var: "", operator: "=", value: "" }],
        }))}
      >
        + add a trigger rule
      </button>
    </>
  );
}
