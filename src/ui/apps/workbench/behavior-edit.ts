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
import { asRec } from "../../../entities/character/behavior";

// the pure row classification lives in the entity layer (both this editor and the sandbox runner read it);
// re-exported here so the controls keep importing it from one place.
export {
  asRec,
  classifyCondition,
  classifyEffect,
  triggerIsStructured,
} from "../../../entities/character/behavior";
export type {
  KnownCondition,
  AdvancedCondition,
  ConditionView,
  SetvarEffect,
  ImpersonateEffect,
  CommandEffect,
  AdvancedEffect,
  EffectView,
} from "../../../entities/character/behavior";

type Rec = Record<string, unknown>;

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

// -- blank rows for the "add" buttons (structured authoring from scratch) --

export const blankCondition = (): Rec => ({ type: "var", var: "", value: "", operator: "=" });
export const blankSetvarEffect = (): Rec => ({ type: "setvar", var: "", value: "", operator: "=" });
export const blankRegexScript = (): RegexScript => ({ label: "", find: "", replace: "", phase: "editdisplay" });
export const blankTrigger = (): TriggerScript => ({ label: "", event: "output", conditions: [], effects: [] });
