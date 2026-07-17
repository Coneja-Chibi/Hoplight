/**
 * Plain-English rule summaries for Workshop. Pure: structured trigger rows -> one readable sentence.
 * Non-coders read this first; the When/If/Then builder stays editable underneath.
 */
import { classifyCondition, classifyEffect } from "../../../../entities/character/behavior";
import type { TriggerScript } from "../../../../entities/character/schema";
import type { WorkshopRecipe } from "./recipes/contract";

const EVENT_WORDS: Record<string, string> = {
  output: "after the model replies",
  input: "after you send a message",
  start: "when the chat starts",
  manual: "when you run it by hand",
};

const OP_WORDS: Record<string, string> = {
  "=": "is",
  "!=": "is not",
  ">": "is greater than",
  "<": "is less than",
  ">=": "is at least",
  "<=": "is at most",
};

const SETOP_WORDS: Record<string, string> = {
  "=": "set to",
  "+=": "add",
  "-=": "subtract",
  "*=": "multiply by",
  "/=": "divide by",
};

const quote = (s: string): string => (s.trim() === "" ? "(empty)" : s);

/** Human words for a trigger event id. */
export const eventWords = (event: string): string => EVENT_WORDS[event] ?? `on "${event}"`;

/** One condition row as English, or null when advanced/unfinished. */
export function summarizeCondition(row: unknown): string | null {
  const v = classifyCondition(row);
  if (v.kind !== "known") return null;
  const name = v.variable.trim() || "a variable";
  const op = OP_WORDS[v.operator] ?? v.operator ?? "is";
  return `${name} ${op} ${quote(v.value)}`;
}

/** One effect row as English, or null when advanced. */
export function summarizeEffect(row: unknown): string | null {
  const v = classifyEffect(row);
  if (v.kind === "setvar") {
    const name = v.variable.trim() || "a variable";
    const op = SETOP_WORDS[v.operator] ?? v.operator ?? "set to";
    return `${name} ${op} ${quote(v.value)}`;
  }
  if (v.kind === "impersonate") {
    const who = v.role === "char" ? "the character" : v.role === "user" ? "the user" : v.role || "someone";
    return `speak as ${who}: ${quote(v.value)}`;
  }
  if (v.kind === "command") return `run ${quote(v.value)}`;
  return null;
}

/**
 * Full trigger as plain English. Advanced rows note that the rule mixes code.
 * Always returns a string (never throws).
 */
export function summarizeTrigger(t: TriggerScript): string {
  const when = eventWords(t.event || "output");
  const conds = t.conditions.map(summarizeCondition).filter((s): s is string => s !== null);
  const effects = t.effects.map(summarizeEffect).filter((s): s is string => s !== null);
  const advanced =
    t.conditions.some((c) => classifyCondition(c).kind !== "known") ||
    t.effects.some((e) => classifyEffect(e).kind === "advanced");

  const bits: string[] = [`When ${when}`];
  if (conds.length > 0) bits.push(`if ${conds.join(" and ")}`);
  else if (!advanced) bits.push("if (no conditions yet)");
  if (effects.length > 0) bits.push(`then ${effects.join("; ")}`);
  else if (!advanced) bits.push("then (no action yet)");
  if (advanced) bits.push("(this rule also has advanced code rows)");
  const label = (t.label ?? "").trim();
  const core = bits.join(", ") + ".";
  return label ? `"${label}": ${core}` : core;
}

/** Multi-line preview for a starter recipe (When/If/Then + seeded vars). */
export function summarizeRecipe(recipe: WorkshopRecipe): string {
  const lines = recipe.triggers.map((t) => summarizeTrigger(t));
  if (recipe.vars.length > 0) {
    const seeds = recipe.vars.map((v) => `${v.name}=${quote(v.value)}`).join(", ");
    lines.push(`Seeds variables: ${seeds}`);
  }
  return lines.join("\n");
}
