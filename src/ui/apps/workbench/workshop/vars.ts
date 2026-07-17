/**
 * Pure variable-board helpers for Workshop (parse card defaultVariables, seed from triggers).
 */
import { classifyCondition, classifyEffect } from "../../../../entities/character/behavior";
import type { TriggerScript } from "../../../../entities/character/schema";

export type VarRow = { name: string; value: string };

/** Parse defaultVariables text (name=value lines) into board rows. */
export const parseVarLines = (text: string): VarRow[] =>
  text
    .split(/\r?\n/)
    .map((line) => {
      const i = line.indexOf("=");
      if (i < 0) return { name: line.trim(), value: "" };
      return { name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() };
    })
    .filter((r) => r.name.length > 0);

export const formatVarLines = (rows: readonly VarRow[]): string =>
  rows.filter((r) => r.name).map((r) => `${r.name}=${r.value}`).join("\n");

/** Union trigger-referenced names with card defaultVariables text. */
export function seedVars(triggers: readonly TriggerScript[], fromText: string): VarRow[] {
  const names = new Set<string>();
  for (const r of parseVarLines(fromText)) names.add(r.name);
  for (const t of triggers) {
    for (const c of t.conditions) {
      const v = classifyCondition(c);
      if (v.kind === "known" && v.variable) names.add(v.variable);
    }
    for (const e of t.effects) {
      const v = classifyEffect(e);
      if (v.kind === "setvar" && v.variable) names.add(v.variable);
    }
  }
  const fromFile = new Map(parseVarLines(fromText).map((r) => [r.name, r.value]));
  return [...names].map((name) => ({ name, value: fromFile.get(name) ?? "" }));
}
