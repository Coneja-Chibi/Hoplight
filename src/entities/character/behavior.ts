/**
 * Pure classification of CharacterBehavior rows (Risu scripts as DATA) - the neutral core BOTH the editor
 * (ui/apps/workbench/behavior-edit) and the trigger runner (sandbox/triggers) read, so neither layer
 * depends on the other (inward-only layering). Classifiers split a condition/effect row into a KNOWN shape
 * (a plain, renderable + runnable comparison or effect) or an ADVANCED shape (macro-built or foreign - the
 * raw object rides along either way, never dropped). Nothing here executes anything; rows are data.
 */
import type { TriggerScript } from "./schema";

type Rec = Record<string, unknown>;

/** read any value as a plain object (never mutate the result); non-objects become {}. */
export const asRec = (v: unknown): Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Rec) : {};

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const hasMacro = (v: unknown): boolean => typeof v === "string" && v.includes("{{");

// -- CONDITION classification --

/** A condition whose shape we can render as a friendly "if X is Y" row. */
export interface KnownCondition {
  kind: "known";
  variable: string;
  operator: string;
  value: string;
  raw: Rec;
}
/** A macro-built or foreign condition: shown in the assisted-code editor, never forced into inputs. */
export interface AdvancedCondition {
  kind: "advanced";
  raw: Rec;
}
export type ConditionView = KnownCondition | AdvancedCondition;

/**
 * Classify a condition row. KNOWN only when it is a plain variable comparison with no macro in the
 * variable name (Risu's `type:"value"` rows carry a macro EXPRESSION in `var`, e.g.
 * `^{{greater_equal::{{getvar::dep}}::10000}}` - those are the code escape hatch, kept advanced).
 */
export function classifyCondition(row: unknown): ConditionView {
  const raw = asRec(row);
  const type = str(raw.type);
  const variable = str(raw.var);
  // KNOWN = a plain variable comparison; the discriminator is macro-vs-plain, NOT filled-vs-empty (a blank
  // var is an unfinished known row the editor must let you fill, not a foreign row shown read-only).
  if (type === "var" && !hasMacro(variable)) {
    return { kind: "known", variable, operator: str(raw.operator), value: str(raw.value), raw };
  }
  return { kind: "advanced", raw };
}

// -- EFFECT classification --

export interface SetvarEffect {
  kind: "setvar";
  variable: string;
  operator: string;
  value: string;
  raw: Rec;
}
export interface ImpersonateEffect {
  kind: "impersonate";
  role: string;
  value: string;
  raw: Rec;
}
export interface CommandEffect {
  kind: "command";
  value: string;
  raw: Rec;
}
export interface AdvancedEffect {
  kind: "advanced";
  raw: Rec;
}
export type EffectView = SetvarEffect | ImpersonateEffect | CommandEffect | AdvancedEffect;

/** Classify an effect row by its `type`; unknown types stay advanced (assisted-code), never dropped. */
export function classifyEffect(row: unknown): EffectView {
  const raw = asRec(row);
  switch (str(raw.type)) {
    case "setvar":
      return { kind: "setvar", variable: str(raw.var), operator: str(raw.operator), value: str(raw.value), raw };
    case "impersonate":
      return { kind: "impersonate", role: str(raw.role), value: str(raw.value), raw };
    case "command":
      return { kind: "command", value: str(raw.value), raw };
    default:
      return { kind: "advanced", raw };
  }
}

/** whether a whole trigger is renderable structured (all condition/effect rows are known shapes). */
export const triggerIsStructured = (t: TriggerScript): boolean =>
  t.conditions.every((c) => classifyCondition(c).kind === "known") &&
  t.effects.every((e) => classifyEffect(e).kind !== "advanced");
