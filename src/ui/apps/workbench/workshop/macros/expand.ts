/**
 * Macro expand preview against Test Bench vars (pure resolveCbs, no eval).
 */
import { resolveCbs, type TriggerVars } from "../../../../../sandbox/triggers/run-data-trigger";

export interface MacroChip {
  id: string;
  label: string;
  /** text inserted at caret / into the field */
  insert: string;
}

/** Snippet chips for non-coders (CBS macros the interpreter already supports). */
export const MACRO_CHIPS: readonly MacroChip[] = [
  { id: "getvar", label: "read var", insert: "{{getvar::name}}" },
  { id: "setvar", label: "store var", insert: "{{setvar::name::value}}" },
  { id: "roll", label: "dice 1-100", insert: "{{roll::100}}" },
  { id: "char", label: "character name", insert: "{{char}}" },
  { id: "user", label: "user name", insert: "{{user}}" },
  { id: "calc", label: "add numbers", insert: "{{calc::1+1}}" },
];

/** Expand a template string against board vars for a live "this becomes" preview. */
export function expandAgainstVars(
  text: string,
  rows: ReadonlyArray<{ name: string; value: string }>,
): string {
  if (!text.includes("{{")) return text;
  const vars: TriggerVars = {};
  for (const r of rows) if (r.name) vars[r.name] = r.value;
  try {
    return resolveCbs(text, vars, { rng: () => 0.5, char: "char", user: "you" });
  } catch {
    return text;
  }
}

/** Whether a string still has unresolved {{...}} after expand. */
export const stillHasMacro = (text: string): boolean => text.includes("{{");
