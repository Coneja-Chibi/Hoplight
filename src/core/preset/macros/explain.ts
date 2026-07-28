/**
 * What a preset's logic IS, stated as conclusions rather than left as counts.
 *
 * WHY THIS EXISTS SEPARATELY FROM ./structure.ts. That module answers "what is in here" - four
 * arrays, twenty hooks, twenty-three closed value sets. All true, all parts. It does not say what
 * the parts add up to, and a conversion driven off parts alone can translate every piece correctly
 * and still produce something dead.
 *
 * The real preset that motivated this is the proof. All twenty of its hooks write variables named
 * `staging_*`; one hook, triggered on every passage, clears all twenty-one of them; seven places in
 * prompt text copy staging values into the live ones. Convert those hooks faithfully but emit the
 * reset last and it erases everything the others just wrote. Every piece correct, the whole thing
 * inert, and nothing in a parts list would have warned anyone.
 *
 * EVERY OBSERVATION IS COMPUTED, NEVER INFERRED AT RUNTIME. That is the point: Kit is driven by
 * whatever model the user brought, so an explanation that depends on the model being clever enough
 * to notice the pattern is not an explanation. A weak model must receive the same sentence a strong
 * one does, already decided, with the evidence that produced it attached.
 *
 * NOTHING HERE EVALUATES ANYTHING. Triggers are inspected as text and never compiled, so an authored
 * regex cannot run - deliberately, since compiling a stranger's pattern to learn about it is exactly
 * the kind of favour that becomes a denial-of-service.
 */
import { authoredTexts } from "./transfer-check";
import { readStateMachine, type StateHook, type StateMachine } from "./state-machine";

/** One stated conclusion about how a piece works, with the evidence that produced it. */
export interface Observation {
  /** Stable slug, so a caller can react to a specific finding without matching prose. */
  id: string;
  /**
   * `critical` marks something a conversion can silently destroy: order dependencies and logic with
   * no counterpart. `note` is orientation - true and useful, but nothing breaks if it is ignored.
   */
  severity: "critical" | "note";
  /** The conclusion, in plain words. */
  says: string;
  /** What was counted to reach it, so a reader can check the claim rather than trust it. */
  evidence: string;
}

/**
 * Does this trigger fire on every passage?
 *
 * Decided STRUCTURALLY, without compiling the pattern. `^` and `.*` and their anchored spellings
 * match anywhere, which makes a hook carrying one an every-turn hook rather than a reaction to
 * something in the text. Anything more elaborate is not classified: a wrong "fires always" claim
 * would be worse than staying quiet, so this only recognises the forms that are unambiguous.
 */
function firesOnEveryPassage(trigger: string): boolean {
  const bare = trigger.trim();
  return bare === "" || /^\^?(\.\*)?\$?$/.test(bare);
}

/** The prefix a variable name is grouped under, or null when it carries no prefix. */
const prefixOf = (name: string): string | null => {
  const at = name.indexOf("_");
  return at > 0 ? name.slice(0, at) : null;
};

/** Variables a hook writes, by the prefix family they belong to. */
function familiesWritten(hooks: readonly StateHook[]): Map<string, Set<string>> {
  const families = new Map<string, Set<string>>();
  for (const hook of hooks) {
    for (const action of hook.actions) {
      const prefix = prefixOf(action.key);
      if (!prefix) continue;
      families.set(prefix, (families.get(prefix) ?? new Set<string>()).add(action.key));
    }
  }
  return families;
}

/** Places where prompt text copies a prefixed variable into a differently-named one. */
function commitSites(texts: readonly { text: string }[], prefix: string): number {
  const pattern = new RegExp(
    `\\{\\{set(?:global)?var::([A-Za-z_]\\w*)::\\{\\{getvar::${prefix}_(\\w+)\\}\\}\\}\\}`,
    "g",
  );
  let count = 0;
  for (const { text } of texts) for (const _ of text.matchAll(pattern)) count += 1;
  return count;
}

/**
 * Read a stored preset and say how it works.
 *
 * Takes the ENTITY because the hook machine lives only in escrow. Returns an empty list rather than
 * a guess when there is nothing derivable: silence is honest, invented architecture is not.
 */
export function explainPreset(entity: unknown): Observation[] {
  const body = (entity as { body?: unknown })?.body ?? entity;
  const original = (entity as { original?: Record<string, { raw?: unknown }> })?.original ?? {};
  let yaml: unknown;
  for (const slot of Object.values(original)) {
    const raw = slot?.raw;
    if (raw && typeof raw === "object" && "macro_engine_yaml" in raw) {
      yaml = (raw as { macro_engine_yaml?: unknown }).macro_engine_yaml;
      break;
    }
  }

  const machine: StateMachine = readStateMachine(yaml);
  if (machine.hooks.length === 0) return [];

  const observations: Observation[] = [];
  const texts = authoredTexts(body);
  const families = familiesWritten(machine.hooks);
  const resets = machine.hooks.filter((hook) => firesOnEveryPassage(hook.trigger));

  for (const [prefix, variables] of families) {
    const clearing = resets.filter((hook) => hook.actions.some((a) => prefixOf(a.key) === prefix));
    const commits = commitSites(texts, prefix);
    if (clearing.length === 0 || commits === 0) continue;

    const writers = machine.hooks.filter(
      (hook) => !clearing.includes(hook) && hook.actions.some((a) => prefixOf(a.key) === prefix),
    );
    observations.push({
      id: `staging-cycle:${prefix}`,
      severity: "critical",
      says:
        `This preset stages its state before committing it. ${writers.length} hooks collect values `
        + `into \`${prefix}_*\` variables, a reset hook clears all ${variables.size} of them at the `
        + `start of every passage, and ${commits} places in prompt text copy them into the live `
        + "variables. THE RESET MUST RUN BEFORE THE WRITERS. Emit it after them on the target and it "
        + "erases what they just wrote: every hook converts correctly and the preset does nothing.",
      evidence:
        `hook "${clearing[0]!.id}" has the always-matching trigger /${clearing[0]!.trigger}/ and `
        + `clears ${clearing[0]!.actions.length} ${prefix}_* variables; ${writers.length} other `
        + `hooks write into the same family; ${commits} commit sites read it back.`,
    });
  }

  const pushes = machine.hooks.flatMap((hook) =>
    hook.actions.filter((a) => a.type === "push").map((a) => ({ hook, key: a.key })),
  );
  if (pushes.length > 0) {
    observations.push({
      id: "push-hooks",
      severity: "critical",
      says:
        `${pushes.length} hooks append to a list. An engine without lists cannot express that in one `
        + "rule: each becomes as many numbered variables as the list has slots, so one hook has to "
        + "become several catchers. The index range the reads actually use is in the structure "
        + "report, so the count is measured rather than guessed.",
      evidence: pushes.map((p) => `${p.hook.id} -> ${p.key}`).join(", "),
    });
  }

  const strippers = machine.hooks.filter((hook) => hook.strip);
  if (strippers.length > 0) {
    observations.push({
      id: "strip-hooks",
      severity: "note",
      says:
        `${strippers.length} hooks remove their matched text from the passage after reading it. `
        + "A target that keeps the text instead will show authoring tags to the reader, so the "
        + "equivalent rule has to replace the match rather than merely match it.",
      evidence: strippers.map((h) => h.id).join(", "),
    });
  }

  if (machine.unparsedLines > 0) {
    observations.push({
      id: "unparsed-hook-lines",
      severity: "note",
      says:
        `${machine.unparsedLines} lines of the hook machine were not understood, so this account of `
        + "it is incomplete. Treat the findings as a floor, not a full inventory.",
      evidence: `${machine.hooks.length} hooks parsed, ${machine.unparsedLines} lines unclassified.`,
    });
  }

  return observations;
}
