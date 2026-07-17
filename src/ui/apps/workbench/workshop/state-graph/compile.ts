/**
 * Compile a lite state graph into TriggerScript rows (and reverse for structured rules).
 */
import type { TriggerScript } from "../../../../../entities/character/schema";
import { classifyCondition, classifyEffect } from "../../../../../entities/character/behavior";
import { STATE_VAR, type GraphState, type GraphTransition, type StateGraph, blankGraph } from "./model";

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Graph -> triggers. Each transition: IF state=from (+ optional cond) THEN state=to (+ optional effect). */
export function compileGraph(graph: StateGraph): TriggerScript[] {
  const byId = new Map(graph.states.map((s) => [s.id, s]));
  return graph.transitions.map((t) => {
    const from = byId.get(t.from)?.label ?? t.from;
    const to = byId.get(t.to)?.label ?? t.to;
    const conditions: unknown[] = [
      { type: "var", var: STATE_VAR, operator: "=", value: t.from },
    ];
    if (t.whenVar?.trim()) {
      conditions.push({
        type: "var",
        var: t.whenVar.trim(),
        operator: t.whenOp || "=",
        value: t.whenValue ?? "",
      });
    }
    const effects: unknown[] = [
      { type: "setvar", var: STATE_VAR, operator: "=", value: t.to },
    ];
    if (t.effectVar?.trim()) {
      effects.push({
        type: "setvar",
        var: t.effectVar.trim(),
        operator: t.effectOp || "=",
        value: t.effectValue ?? "",
      });
    }
    return {
      label: `${from} -> ${to}`,
      event: t.event || "output",
      conditions,
      effects,
    };
  });
}

/**
 * Best-effort reverse: only structured triggers that gate on `state` and set `state`.
 * Advanced / non-state rules are ignored (stay on the Triggers pane).
 */
export function decompileTriggers(triggers: readonly TriggerScript[]): StateGraph {
  const stateIds = new Set<string>();
  const transitions: GraphTransition[] = [];

  for (const [i, t] of triggers.entries()) {
    const conds = t.conditions.map(classifyCondition);
    const effects = t.effects.map(classifyEffect);
    if (conds.some((c) => c.kind !== "known") || effects.some((e) => e.kind === "advanced")) continue;

    const stateCond = conds.find(
      (c) => c.kind === "known" && c.variable === STATE_VAR && (c.operator === "=" || c.operator === ""),
    );
    const stateEff = effects.find(
      (e) => e.kind === "setvar" && e.variable === STATE_VAR && (e.operator === "=" || e.operator === ""),
    );
    if (!stateCond || stateCond.kind !== "known" || !stateEff || stateEff.kind !== "setvar") continue;

    const from = stateCond.value || "idle";
    const to = stateEff.value || from;
    stateIds.add(from);
    stateIds.add(to);

    const extraCond = conds.find(
      (c) => c.kind === "known" && c.variable !== STATE_VAR,
    );
    const extraEff = effects.find(
      (e) => e.kind === "setvar" && e.variable !== STATE_VAR,
    );

    transitions.push({
      id: `t${i}`,
      from,
      to,
      event: t.event || "output",
      whenVar: extraCond && extraCond.kind === "known" ? extraCond.variable : undefined,
      whenOp: extraCond && extraCond.kind === "known" ? extraCond.operator : undefined,
      whenValue: extraCond && extraCond.kind === "known" ? extraCond.value : undefined,
      effectVar: extraEff && extraEff.kind === "setvar" ? extraEff.variable : undefined,
      effectOp: extraEff && extraEff.kind === "setvar" ? extraEff.operator : undefined,
      effectValue: extraEff && extraEff.kind === "setvar" ? extraEff.value : undefined,
    });
  }

  if (stateIds.size === 0 && transitions.length === 0) return blankGraph();

  const states: GraphState[] = [...stateIds].map((id) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
  }));
  return { states, transitions };
}

/** Seed defaultVariables with state=firstState if missing. */
export function seedStateVar(
  defaultVarsText: string,
  firstStateId: string,
): string {
  const lines = defaultVarsText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.some((l) => l.startsWith(`${STATE_VAR}=`) || l.trim() === STATE_VAR)) {
    return defaultVarsText;
  }
  return [...lines, `${STATE_VAR}=${firstStateId}`].join("\n");
}

/** Labels that look graph-compiled (for merge strategies). */
export const looksLikeGraphTrigger = (t: TriggerScript): boolean => {
  const conds = t.conditions.map(classifyCondition);
  const effects = t.effects.map(classifyEffect);
  const hasStateIf = conds.some(
    (c) => c.kind === "known" && c.variable === STATE_VAR,
  );
  const hasStateThen = effects.some(
    (e) => e.kind === "setvar" && e.variable === STATE_VAR,
  );
  return hasStateIf && hasStateThen;
};

/** Replace graph-owned triggers; keep non-graph rules. */
export function mergeCompiledTriggers(
  existing: TriggerScript[],
  compiled: TriggerScript[],
): TriggerScript[] {
  const keep = existing.filter((t) => !looksLikeGraphTrigger(t));
  return [...keep, ...compiled.map((t) => structuredClone(t))];
}

export const transitionSummary = (t: GraphTransition, states: readonly GraphState[]): string => {
  const from = states.find((s) => s.id === t.from)?.label ?? t.from;
  const to = states.find((s) => s.id === t.to)?.label ?? t.to;
  const bits = [`When ${t.event || "output"}`, `if in ${from}`];
  if (t.whenVar?.trim()) {
    bits.push(`and ${t.whenVar} ${t.whenOp || "is"} ${str(t.whenValue)}`);
  }
  bits.push(`then go to ${to}`);
  if (t.effectVar?.trim()) {
    bits.push(`and ${t.effectVar} ${t.effectOp || "="} ${str(t.effectValue)}`);
  }
  return bits.join(", ") + ".";
};
