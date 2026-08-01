/**
 * A RoleCall hook machine, rendered as the regex scripts an engine without hooks uses instead.
 *
 * THIS IS A TRANSLATION, NOT A SUGGESTION, and the reason it can be is that the two are the same
 * mechanism wearing different names. A RoleCall hook is a trigger regex plus actions on variables.
 * A SillyTavern regex script is a find pattern plus a replacement - and a replacement is macro-
 * substituted AFTER its capture groups are filled in, so a replacement containing `{{setvar::k::$1}}`
 * really does write state. Verified in that project's own source (`public/scripts/extensions/regex/
 * engine.js`, where runRegexScript calls substituteParams on the completed replacement).
 *
 * The shape was learned from a real hand-written preset that already does this, which is the only
 * reason it is worth trusting: an author solved it by hand, in exactly this form, before anyone
 * tried to generate it.
 *
 *   hook trigger            -> findRegex, verbatim; the dialects are the same regex syntax
 *   placement user_input    -> 1
 *   placement ai_output     -> 2
 *   strip: true             -> the replacement omits the match, so the tag stops being visible
 *   strip: false            -> the replacement re-emits the match with {{match}} before writing
 *   action set              -> {{setvar::key::$1}}
 *   action unset            -> {{setvar::key::}}
 *   action append           -> {{addvar::key::$1}}
 *   action push             -> refused; see below
 *
 * PUSH IS NOT RENDERED AND THAT IS DELIBERATE. Appending to a list needs as many numbered variables
 * as the list has slots, so one hook becomes several rules whose count comes from how the preset
 * READS the array - information that lives in the structure report, not in the hook. Emitting a
 * plausible single rule would produce something that runs and quietly keeps only one value. It is
 * reported as unrendered instead, with the reason.
 *
 * ORDER IS PRESERVED because it is load-bearing: a reset hook that clears state must run before the
 * hooks that write it, and regex scripts execute in the order the array holds them.
 *
 * CHAT SCOPE, NOT GLOBAL, AND THAT IS A CHOICE. SillyTavern keeps two variable stores: chat-local,
 * and global values that outlive the conversation. A replacement can reach either, so a regex rule
 * really can set a global - which is a genuinely useful trick and the wrong default here. RoleCall
 * hooks carry no scope of their own, and the machine these were built for stages values within a
 * single passage and commits them in the same render. Emitting globals would leak that state into
 * every other chat and leave stale values behind after starting over. An author who wants a value to
 * persist can widen a rendered rule; a converter cannot widen it back down once it has escaped.
 */
import type { HookAction, StateHook, StateMachine } from "./state-machine";

/** One emitted rule, in the canonical regex-rule shape a codec can serialize. */
export interface RenderedRule {
  id: string;
  label: string;
  find: string;
  flags: string;
  replace: string;
  /** Canonical phases: which side of the exchange this runs on. */
  phases: string[];
  enabled: boolean;
  sortOrder: number;
}

/** A hook that could not be rendered, with the reason, so nothing is dropped in silence. */
export interface UnrenderedHook {
  id: string;
  reason: string;
}

export interface HookRendering {
  rules: RenderedRule[];
  unrendered: UnrenderedHook[];
  /** Caveats that travel with the result. Never dropped by a caller. */
  limits: string[];
}

/**
 * How the target names "everything that matched".
 *
 * NOT `$&`, and the difference is invisible until it reaches a real chat. SillyTavern does NOT hand
 * the replacement to JavaScript's String.replace. It expands the string itself, matching only
 * `$<digits>` and `$<name>`, and returns a finished string from the callback, so the engine never
 * performs its own dollar expansion. `$&` therefore survives as two literal characters.
 *
 * The failure that costs is not the stray characters. A rule that re-emits the match to avoid
 * deleting authored text instead CONSUMES it, so any later rule matching the same tag never fires:
 * a catcher writes its variable, the flag rule that commits it never sees the tag, and the value is
 * staged and never committed. Everything looks like it ran.
 *
 * Verified against public/scripts/extensions/regex/engine.js, which maps `{{match}}` to `$0` before
 * expanding. Do not "simplify" this to `$&` on the reasoning that it is standard JavaScript; it is,
 * and that is exactly why the mistake is easy to make twice.
 */
const WHOLE_MATCH = "{{match}}";

const PHASE_BY_PLACEMENT: Record<string, string> = {
  user_input: "user_input",
  ai_output: "response",
};

/**
 * The macro that performs one action.
 *
 * THE AUTHORED VALUE IS USED VERBATIM WHEREVER THERE IS ONE, and this is the whole reason hook
 * actions had to start carrying it. RoleCall writes templates like `"$1 = $2 /// "` - literal text
 * woven around two capture groups - and a reset writes `""` on purpose. Guessing `$1` would silently
 * discard the second group and the joining text; guessing the whole match would turn a deliberate
 * clear into a write of whatever matched. Capture-group syntax is identical in both engines, so the
 * template needs no rewriting.
 *
 * The fallback only applies when the source omitted a value entirely, which is different from an
 * authored empty string and is treated as "store what matched".
 */
function macroFor(action: HookAction, fallback: string): string | null {
  const value = action.value ?? fallback;
  switch (action.type) {
    case "set": return `{{setvar::${action.key}::${value}}}`;
    case "unset": return `{{setvar::${action.key}::}}`;
    case "append": return `{{addvar::${action.key}::${value}}}`;
    default: return null; // push: see the header
  }
}

/** Does this trigger declare at least one capturing group? */
const capturesSomething = (trigger: string): boolean =>
  /\((?!\?[:=!<])/.test(trigger) || /\(\?<[A-Za-z_]/.test(trigger);

/**
 * Render one hook. Returns null when nothing about it can be expressed, so the caller reports it
 * rather than emitting a rule that looks right and does less than the original.
 */
function renderHook(hook: StateHook, sortOrder: number): RenderedRule | UnrenderedHook {
  if (hook.actions.length === 0) {
    return { id: hook.id, reason: "the hook performs no actions, so there is nothing to write" };
  }
  const pushes = hook.actions.filter((a) => a.type === "push");
  if (pushes.length > 0) {
    return {
      id: hook.id,
      reason:
        `appends to the list "${pushes[0]!.key}". A target without lists needs one rule per slot, and `
        + "the slot count comes from how the preset reads the array, not from the hook. Rendering a "
        + "single rule would keep only one value while appearing to work.",
    };
  }

  const fallback = capturesSomething(hook.trigger) ? "$1" : WHOLE_MATCH;
  const writes = hook.actions.map((a) => macroFor(a, fallback)).filter((m): m is string => m !== null);
  if (writes.length === 0) {
    return { id: hook.id, reason: "no action in this hook has a counterpart that writes state" };
  }

  const phases = hook.placement.length > 0
    ? [...new Set(hook.placement.map((p) => PHASE_BY_PLACEMENT[p]).filter((p): p is string => !!p))]
    : ["user_input", "response"];

  return {
    id: `hook-${hook.id}`,
    label: hook.id,
    find: hook.trigger,
    flags: hook.flags || "g",
    // strip drops the matched text; keeping it means re-emitting the match before the writes, or
    // the rule would silently delete authored text as a side effect of storing it.
    replace: (hook.strip ? "" : WHOLE_MATCH) + writes.join(""),
    phases: phases.length > 0 ? phases : ["user_input", "response"],
    enabled: true,
    sortOrder,
  };
}

const isRule = (value: RenderedRule | UnrenderedHook): value is RenderedRule => "find" in value;

/**
 * Render a whole hook machine, preserving declaration order.
 *
 * Order is carried into `sortOrder` rather than left to chance: the machine this was built for
 * depends on a reset hook running before the hooks that write, and reordering it produces a set of
 * individually-correct rules that erase each other.
 */
export function renderHooksAsRegex(machine: StateMachine): HookRendering {
  const rules: RenderedRule[] = [];
  const unrendered: UnrenderedHook[] = [];

  machine.hooks.forEach((hook, index) => {
    const result = renderHook(hook, index);
    if (isRule(result)) rules.push(result);
    else unrendered.push(result);
  });

  const limits = [
    "Declaration order is preserved in sortOrder and is load-bearing: a hook that clears state must "
    + "run before the hooks that write it, or it erases them.",
    "Triggers are carried across verbatim because both engines use the same regex syntax. They were "
    + "not compiled or validated here, so a pattern the source engine tolerated may still be "
    + "rejected by the target.",
  ];
  if (machine.unparsedLines > 0) {
    limits.push(
      `${machine.unparsedLines} lines of the hook machine were not understood, so this rendering `
      + "covers only what parsed.",
    );
  }
  return { rules, unrendered, limits };
}
