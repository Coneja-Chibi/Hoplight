/**
 * Overlay editors + vocabulary for CharacterBehavior (Risu scripts as DATA). The ONE law here: every
 * edit to a condition/effect row is an OVERLAY on the original object ({...original, [key]: value}), never
 * a rebuild from known fields, so dialect keys we do not model (triggerlua/cjs variants, extra flags,
 * macro-built `type:"value"` conditions) survive a round-trip verbatim. Dropping unknown keys is the
 * central failure mode (design/RISU-CARD-DEEP.md); this module is the functional core that prevents it,
 * proven by behavior-edit.test.ts against the real cherry card through the actual adapter.
 *
 * Nothing here executes anything - scripts are parsed, classified, and re-serialized as data (the
 * CharacterBehavior security line). Classifiers split each row into a KNOWN shape (friendly structured
 * controls) or an ADVANCED shape (the assisted-code editor); the raw object rides along either way.
 */
import type { RegexScript, TriggerScript } from "../../../entities/character/schema";

type Rec = Record<string, unknown>;

/** read any value as a plain object (never mutate the result); non-objects become {}. */
export const asRec = (v: unknown): Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Rec) : {};

// -- immutable list ops (shared by every repeating-row control) --
export const setAt = <T>(list: readonly T[], i: number, v: T): T[] => list.map((x, j) => (j === i ? v : x));
export const removeAt = <T>(list: readonly T[], i: number): T[] => list.filter((_, j) => j !== i);
export const appendTo = <T>(list: readonly T[], v: T): T[] => [...list, v];

/** Overlay a single field onto a row object, preserving every other (including unmodeled) key. */
export const overlayField = (row: unknown, key: string, value: unknown): Rec => ({ ...asRec(row), [key]: value });

// -- open vocabularies (real values seen in card DATA; OPEN so unknown values still render + round-trip) --

/** regex pipeline phase (Risu `type`). */
export const REGEX_PHASES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "edittrans", label: "On translate" },
  { value: "editoutput", label: "On model output" },
  { value: "editinput", label: "On your input" },
  { value: "editdisplay", label: "On display only" },
  { value: "editprocess", label: "On process" },
];

/** trigger firing event (Risu `type`). */
export const TRIGGER_EVENTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "output", label: "After the model replies" },
  { value: "input", label: "After you send" },
  { value: "start", label: "When the chat starts" },
  { value: "manual", label: "Run manually" },
];

/** comparison operators for a condition. */
export const CONDITION_OPERATORS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "=", label: "is" },
  { value: "!=", label: "is not" },
  { value: ">", label: "is greater than" },
  { value: "<", label: "is less than" },
  { value: ">=", label: "is at least" },
  { value: "<=", label: "is at most" },
];

/** setvar assignment operators. */
export const SETVAR_OPS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "=", label: "set to" },
  { value: "+=", label: "add" },
  { value: "-=", label: "subtract" },
  { value: "*=", label: "multiply by" },
  { value: "/=", label: "divide by" },
];

/** effect kinds. `setvar`/`impersonate`/`command` render structured; anything else is advanced. */
export const EFFECT_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "setvar", label: "Change a variable" },
  { value: "impersonate", label: "Speak as" },
  { value: "command", label: "Run a command" },
];

export const IMPERSONATE_ROLES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "user", label: "the user" },
  { value: "char", label: "the character" },
];

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
  if (type === "var" && variable !== "" && !hasMacro(variable)) {
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

// -- blank rows for the "add" buttons (structured authoring from scratch) --

export const blankCondition = (): Rec => ({ type: "var", var: "", value: "", operator: "=" });
export const blankSetvarEffect = (): Rec => ({ type: "setvar", var: "", value: "", operator: "=" });
export const blankRegexScript = (): RegexScript => ({ label: "", find: "", replace: "", phase: "editdisplay" });
export const blankTrigger = (): TriggerScript => ({ label: "", event: "output", conditions: [], effects: [] });

/** whether a whole trigger is renderable structured (all condition/effect rows are known shapes). */
export const triggerIsStructured = (t: TriggerScript): boolean =>
  t.conditions.every((c) => classifyCondition(c).kind === "known") &&
  t.effects.every((e) => classifyEffect(e).kind !== "advanced");
