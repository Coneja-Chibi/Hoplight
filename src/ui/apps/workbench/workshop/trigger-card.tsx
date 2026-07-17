/**
 * Structured When/If/Then trigger card (builder + English summary + macro chips).
 */
import type { JSX } from "react";
import { classifyCondition, classifyEffect } from "../../../../entities/character/behavior";
import type { TriggerScript } from "../../../../entities/character/schema";
import { setAt, appendTo, removeAt, overlayField } from "../behavior-edit";
import { summarizeTrigger } from "./explain";
import { MacroAssist } from "./macros/chips";
import { MiniSelect, WORKSHOP_EVENTS } from "./mini-select";
import type { VarRow } from "./vars";
import styles from "./styles.module.css";

const OPS: ReadonlyArray<readonly [string, string]> = [
  ["=", "is"], ["!=", "is not"], [">", "is greater than"], ["<", "is less than"],
  [">=", "is at least"], ["<=", "is at most"],
];
const SETOPS: ReadonlyArray<readonly [string, string]> = [
  ["=", "set to"], ["+=", "add"], ["-=", "subtract"], ["*=", "multiply by"], ["/=", "divide by"],
];
const EFFECTS: ReadonlyArray<readonly [string, string]> = [
  ["setvar", "Change a variable"], ["impersonate", "Speak as"], ["command", "Run a command"],
];
const ROLES: ReadonlyArray<readonly [string, string]> = [
  ["user", "the user"], ["char", "the character"],
];

const str = (v: unknown): string => (typeof v === "string" ? v : "");

const structured = (t: TriggerScript): boolean =>
  t.conditions.every((c) => classifyCondition(c).kind === "known") &&
  t.effects.every((e) => classifyEffect(e).kind !== "advanced");

export interface WorkshopTriggerCardProps {
  trigger: TriggerScript;
  index: number;
  triggers: TriggerScript[];
  onWrite(next: TriggerScript[]): void;
  /** board vars for macro expand preview */
  vars?: readonly VarRow[];
}

export function WorkshopTriggerCard({
  trigger: t,
  index: ti,
  triggers,
  onWrite,
  vars = [],
}: WorkshopTriggerCardProps): JSX.Element {
  const editTrigger = (patch: Partial<TriggerScript>): void =>
    onWrite(setAt(triggers, ti, { ...triggers[ti]!, ...patch }));
  const editCond = (ci: number, key: string, value: unknown): void =>
    editTrigger({
      conditions: setAt(t.conditions, ci, overlayField(t.conditions[ci], key, value)),
    });
  const editEffect = (ei: number, key: string, value: unknown): void =>
    editTrigger({
      effects: setAt(t.effects, ei, overlayField(t.effects[ei], key, value)),
    });

  const effectRow = (e: unknown, ei: number): JSX.Element => {
    const view = classifyEffect(e);
    const val = view.kind === "setvar" || view.kind === "impersonate" || view.kind === "command"
      ? view.value
      : "";
    return (
      <div key={ei} style={{ width: "100%" }}>
        <div className={styles.ruleRow}>
          <MiniSelect
            opts={EFFECTS}
            value={str((view.raw as { type?: string }).type) || "setvar"}
            onChange={(v) => editEffect(ei, "type", v)}
          />
          {view.kind === "setvar" && (
            <>
              <input className={styles.var} value={view.variable} placeholder="variable" onChange={(ev) => editEffect(ei, "var", ev.target.value)} />
              <MiniSelect opts={SETOPS} value={view.operator || "="} onChange={(v) => editEffect(ei, "operator", v)} />
              <input className={styles.val} value={view.value} placeholder="value or {{macro}}" onChange={(ev) => editEffect(ei, "value", ev.target.value)} />
            </>
          )}
          {view.kind === "impersonate" && (
            <>
              <MiniSelect opts={ROLES} value={view.role || "user"} onChange={(v) => editEffect(ei, "role", v)} />
              <input className={styles.val} value={view.value} placeholder="what they say" onChange={(ev) => editEffect(ei, "value", ev.target.value)} />
            </>
          )}
          {view.kind === "command" && (
            <input className={styles.val} value={view.value} placeholder="/command" onChange={(ev) => editEffect(ei, "value", ev.target.value)} />
          )}
          <button type="button" className={styles.rm} onClick={() => editTrigger({ effects: removeAt(t.effects, ei) })}>&times;</button>
        </div>
        {(view.kind === "setvar" || view.kind === "impersonate") && (
          <MacroAssist
            value={val}
            vars={vars}
            onInsert={(snippet) => editEffect(ei, "value", `${val}${snippet}`)}
          />
        )}
      </div>
    );
  };

  return (
    <div className={`${styles.trig}${structured(t) ? "" : ` ${styles.adv}`}`}>
      <div className={styles.th}>
        <input className={styles.name} value={str(t.label)} placeholder="name" onChange={(e) => editTrigger({ label: e.target.value })} />
        <span className={styles.kw}>WHEN</span>
        <MiniSelect opts={WORKSHOP_EVENTS} value={t.event || "output"} onChange={(v) => editTrigger({ event: v })} />
        <span style={{ marginLeft: "auto" }} />
        {!structured(t) && <span className={styles.advtag}>advanced &middot; code</span>}
        <button type="button" className={styles.rm} onClick={() => onWrite(removeAt(triggers, ti))}>&times;</button>
      </div>
      <div className={styles.body}>
        <p className={styles.summary}>{summarizeTrigger(t)}</p>
        {structured(t) ? (
          <>
            <div className={`${styles.block} ${styles.blockIf}`}>
              <span className={`${styles.kw} ${styles.kwIf}`}>IF</span>
              {t.conditions.map((c, ci) => {
                const v = classifyCondition(c);
                if (v.kind !== "known") return null;
                return (
                  <div className={styles.ruleRow} key={ci}>
                    <input className={styles.var} value={v.variable} placeholder="variable" onChange={(e) => editCond(ci, "var", e.target.value)} />
                    <MiniSelect opts={OPS} value={v.operator || "="} onChange={(val) => editCond(ci, "operator", val)} />
                    <input className={styles.val} value={v.value} placeholder="value" onChange={(e) => editCond(ci, "value", e.target.value)} />
                    <button type="button" className={styles.rm} onClick={() => editTrigger({ conditions: removeAt(t.conditions, ci) })}>&times;</button>
                  </div>
                );
              })}
              <button type="button" className={styles.addmini} onClick={() => editTrigger({ conditions: appendTo(t.conditions, { type: "var", var: "", operator: "=", value: "" }) })}>+ add condition</button>
            </div>
            <div className={`${styles.block} ${styles.blockThen}`}>
              <span className={`${styles.kw} ${styles.kwThen}`}>THEN</span>
              {t.effects.map((e, ei) => effectRow(e, ei))}
              <button type="button" className={styles.addmini} onClick={() => editTrigger({ effects: appendTo(t.effects, { type: "setvar", var: "", operator: "=", value: "" }) })}>+ add action</button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.hint}>this rule uses a macro expression, so it opens as code (never run)</p>
            <div className={styles.codeline}>
              {t.conditions.map((c) => `IF ${str((c as { var?: string }).var)} ${str((c as { operator?: string }).operator)} ${str((c as { value?: string }).value)}`).join("\n")}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
