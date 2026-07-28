/**
 * Reading a RoleCall preset's state layer: the declarative hook machine in `macro_engine_yaml`, and
 * the conditional text that consumes it.
 *
 * WHY THIS IS ITS OWN CONCERN. A RoleCall preset can carry a second program beside its prompts: a
 * list of regex-triggered hooks that write variables as text passes through, and prompt bodies full
 * of conditionals that read them back. Neither survives a conversion to an engine without
 * conditionals, and neither is visible in a field-level loss report, which counts dropped keys and
 * has nothing to say about a preset whose logic stopped working. This module makes that logic
 * legible so a report can name it.
 *
 * NOTHING HERE EVALUATES ANYTHING. It parses a hook's declaration and scans text for tokens. It does
 * not run a hook, resolve a condition, or expand a macro, so it is untouched by the evaluation
 * question ADR-012 governs.
 *
 * The YAML is read with a deliberately small line reader rather than a YAML dependency. The hook
 * grammar is a fixed shape RoleCall emits, this only needs the fields that decide convertibility,
 * and a malformed block is reported as unparsed rather than throwing.
 */
import { macroName, scanMacroTokens } from "./support";

/** What a hook does to one variable when its trigger matches. */
export type HookActionType = "set" | "unset" | "append" | "push";

export interface HookAction {
  type: HookActionType;
  key: string;
  /**
   * The authored template for what gets written, verbatim.
   *
   * NOT OPTIONAL DECORATION. RoleCall writes `value: "$1 = $2 /// "` - literal text woven around
   * capture groups - and a reset writes `value: ""` to clear. Reading only the type and the key
   * dropped every one of those and left anything rendering these hooks guessing at `$1`, which is
   * wrong for a two-group template and wrong for a deliberate clear. Absent when the source omitted
   * it, which is different from an authored empty string.
   */
  value?: string;
}

export interface StateHook {
  id: string;
  /** The regex source as authored. Kept verbatim; never compiled here. */
  trigger: string;
  flags: string;
  /** True when the matched text is removed from the passage. */
  strip: boolean;
  /** Where the hook runs: user_input, ai_output, or both. */
  placement: string[];
  actions: HookAction[];
}

export interface StateMachine {
  hooks: StateHook[];
  /** Dashboard rows, which are readouts rather than logic. */
  dashboardRows: number;
  /** Dashboard rows gated on a condition, which no conditional-free engine can honour. */
  dashboardConditionalRows: number;
  /** Lines the reader could not classify, so a caller can say so instead of implying completeness. */
  unparsedLines: number;
}

const HOOK_ID = /^\s{2,}-\s+id:\s*(\S+)/;
const FIELD = /^\s+(trigger|flags|strip|placement):\s*(.*)$/;
// The trailing `value:` is what actually gets written. Capturing it is the difference between
// replaying an author's template and inventing one: `value: "$1 = $2 /// "` is literal text woven
// around two capture groups, and no amount of guessing reconstructs that from the key alone.
const ACTION =
  /\{\s*type:\s*(set|unset|append|push)\s*,\s*key:\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:,\s*value:\s*(.*?))?\s*\}/;

/** Strip one layer of matching quotes from a scalar. */
const unquote = (raw: string): string => {
  const v = raw.trim();
  if (v.length >= 2 && ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"')))) {
    return v.slice(1, -1);
  }
  return v;
};

/**
 * Read the hook machine out of a `macro_engine_yaml` payload. Returns an empty machine for absent or
 * unreadable input rather than throwing: an unreadable state layer is a finding, not a crash.
 */
export function readStateMachine(yaml: unknown): StateMachine {
  const empty: StateMachine = {
    hooks: [],
    dashboardRows: 0,
    dashboardConditionalRows: 0,
    unparsedLines: 0,
  };
  if (typeof yaml !== "string" || yaml.trim().length === 0) return empty;

  const lines = yaml.split("\n");
  const hooks: StateHook[] = [];
  let current: StateHook | null = null;
  let section: "dashboard" | "hooks" | "none" = "none";
  let dashboardRows = 0;
  let conditionalRows = 0;
  let unparsed = 0;

  const commit = (): void => {
    if (current) hooks.push(current);
    current = null;
  };

  for (const line of lines) {
    if (/^dashboard:/.test(line)) { commit(); section = "dashboard"; continue; }
    if (/^hooks:/.test(line)) { commit(); section = "hooks"; continue; }
    if (line.trim().length === 0 || line.trim().startsWith("#")) continue;

    if (section === "dashboard") {
      if (/^\s+-\s+label:/.test(line)) dashboardRows += 1;
      if (/^\s+show_if:/.test(line)) conditionalRows += 1;
      continue;
    }
    if (section !== "hooks") continue;

    const id = HOOK_ID.exec(line);
    if (id) {
      commit();
      current = { id: id[1]!, trigger: "", flags: "", strip: false, placement: [], actions: [] };
      continue;
    }
    if (!current) continue;

    const field = FIELD.exec(line);
    if (field) {
      const [, key, rawValue] = field;
      const value = unquote(rawValue ?? "");
      if (key === "trigger") current.trigger = value;
      else if (key === "flags") current.flags = value;
      else if (key === "strip") current.strip = value === "true";
      else if (key === "placement") {
        current.placement = value.replace(/[[\]]/g, "").split(",").map((p) => p.trim()).filter(Boolean);
      }
      continue;
    }

    const action = ACTION.exec(line);
    if (action) {
      const raw = action[3];
      current.actions.push({
        type: action[1] as HookActionType,
        key: action[2]!,
        ...(raw === undefined ? {} : { value: unquote(raw) }),
      });
      continue;
    }
    if (/^\s+(action|- \{)/.test(line)) continue;
    unparsed += 1;
  }
  commit();
  return { hooks, dashboardRows, dashboardConditionalRows: conditionalRows, unparsedLines: unparsed };
}

/** Every variable a hook machine writes, with the actions that write it. */
export function variablesWritten(machine: StateMachine): Map<string, HookActionType[]> {
  const written = new Map<string, HookActionType[]>();
  for (const hook of machine.hooks) {
    for (const action of hook.actions) {
      const key = action.key.toLowerCase();
      written.set(key, [...(written.get(key) ?? []), action.type]);
    }
  }
  return written;
}

export interface ConditionalCensus {
  /** Block openers: `{{if ...}}`. Closers and `{{else}}` are counted separately. */
  openers: number;
  closers: number;
  elses: number;
  /** Variables read inside conditions, and how often. */
  readsByVariable: Map<string, number>;
}

/** Count the conditional structure in prompt text and the variables its conditions read. */
export function censusConditionals(texts: readonly string[]): ConditionalCensus {
  const reads = new Map<string, number>();
  let openers = 0;
  let closers = 0;
  let elses = 0;

  for (const text of texts) {
    for (const token of scanMacroTokens(text)) {
      const inner = token.slice(2, -2);
      const name = macroName(token);
      if (name === "else") { elses += 1; continue; }
      if (name !== "if") continue;
      if (/^\s*\//.test(inner)) { closers += 1; continue; }
      openers += 1;
      // RoleCall conditions read state two ways: {{getvar::x}} and the {{.x}} dot shorthand.
      for (const match of inner.matchAll(/getvar(?:key)?::\s*([A-Za-z_][A-Za-z0-9_]*)/gi)) {
        const key = match[1]!.toLowerCase();
        reads.set(key, (reads.get(key) ?? 0) + 1);
      }
      for (const match of inner.matchAll(/\{\{\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
        const key = match[1]!.toLowerCase();
        reads.set(key, (reads.get(key) ?? 0) + 1);
      }
    }
  }
  return { openers, closers, elses, readsByVariable: reads };
}
