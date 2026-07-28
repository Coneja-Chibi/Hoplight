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

const rows = (body: unknown, key: string): Record<string, unknown>[] => {
  const value = (body as Record<string, unknown> | null)?.[key];
  return Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => !!v && typeof v === "object") : [];
};

/**
 * What a lorebook DOES, which is decided by activation rules rather than by entry text.
 *
 * Two books with the same entries behave completely differently depending on whether an entry is
 * always-on, gated behind an inclusion group, or rolled for. Those rules are the first thing an
 * engine without the same machinery drops, and dropping them changes what the model sees every turn
 * while every entry still converts perfectly.
 */
export function explainLorebook(body: unknown): Observation[] {
  const entries = rows(body, "entries");
  if (entries.length === 0) return [];

  const observations: Observation[] = [];
  const constant = entries.filter((e) => e["constant"] === true).length;
  observations.push({
    id: "activation-mix",
    severity: "note",
    says:
      `${entries.length} entries: ${constant} always in context, ${entries.length - constant} `
      + "pulled in only when their keywords appear. An engine that cannot express always-on will "
      + "turn the first group into keyword entries that may never fire.",
    evidence: `constant=${constant}, keyword-triggered=${entries.length - constant}`,
  });

  const groups = new Map<string, number>();
  for (const e of entries) {
    const name = e["groupName"];
    if (typeof name === "string" && name.trim()) groups.set(name, (groups.get(name) ?? 0) + 1);
  }
  const contested = [...groups].filter(([, n]) => n > 1);
  if (contested.length > 0) {
    observations.push({
      id: "inclusion-groups",
      severity: "critical",
      says:
        `${contested.length} inclusion groups let only ONE of their members fire per turn. A target `
        + "without groups fires all of them together, which is not a smaller version of the same "
        + "behaviour - it is every alternative arriving at once.",
      evidence: contested.map(([name, n]) => `${name} (${n} entries)`).join(", "),
    });
  }

  const chance = entries.filter((e) => typeof e["probability"] === "number" && (e["probability"] as number) < 100);
  if (chance.length > 0) {
    observations.push({
      id: "probabilistic-entries",
      severity: "critical",
      says:
        `${chance.length} entries fire on a roll rather than every time they match. A target without `
        + "probability includes them always, so text meant to be occasional becomes constant.",
      evidence: chance.slice(0, 6).map((e) => `${String(e["title"] ?? e["id"])}=${String(e["probability"])}%`).join(", "),
    });
  }

  const timed = entries.filter((e) => e["sticky"] || e["cooldown"] || e["delay"]);
  if (timed.length > 0) {
    observations.push({
      id: "timed-entries",
      severity: "critical",
      says:
        `${timed.length} entries use timed activation - staying in context after firing, or refusing `
        + "to fire again for a while. Without it they revert to plain match-every-turn entries.",
      evidence: timed.slice(0, 6).map((e) => String(e["title"] ?? e["id"])).join(", "),
    });
  }

  const recursive = entries.filter(
    (e) => e["excludeRecursion"] || e["preventRecursion"] || e["delayUntilRecursion"],
  );
  if (recursive.length > 0) {
    observations.push({
      id: "recursion-control",
      severity: "note",
      says:
        `${recursive.length} entries control whether they can be triggered by other entries' text. `
        + "Losing that changes which entries pull each other in, so the book can cascade further "
        + "than it was written to.",
      evidence: recursive.slice(0, 6).map((e) => String(e["title"] ?? e["id"])).join(", "),
    });
  }
  return observations;
}

/** What a character carries beyond its description, and which layers a thinner target will drop. */
export function explainCharacter(body: unknown): Observation[] {
  const observations: Observation[] = [];
  const greetings = (body as { greetings?: { alternateGreetings?: unknown } } | null)?.greetings;
  const alternates = Array.isArray(greetings?.alternateGreetings) ? greetings.alternateGreetings.length : 0;
  if (alternates > 0) {
    observations.push({
      id: "alternate-greetings",
      severity: "note",
      says:
        `${alternates} alternate greetings beyond the first message. A format that keeps only one `
        + "opening keeps the first and silently drops the rest, which is authored work leaving.",
      evidence: `${alternates} alternates`,
    });
  }

  const prompts = (body as { prompts?: Record<string, unknown> } | null)?.prompts ?? {};
  const overrides = Object.entries(prompts).filter(([, v]) => typeof v === "string" && v.trim().length > 0);
  if (overrides.length > 0) {
    observations.push({
      id: "character-prompt-overrides",
      severity: "critical",
      says:
        "This character overrides prompt behaviour for any chat it enters, which is separate from "
        + "its description and easy to lose sight of: the card changes how the model is instructed, "
        + "not just who it plays.",
      evidence: overrides.map(([k]) => k).join(", "),
    });
  }

  const refs = (body as { knowledgeRefs?: unknown } | null)?.knowledgeRefs;
  if (Array.isArray(refs) && refs.length > 0) {
    observations.push({
      id: "linked-lorebook",
      severity: "critical",
      says:
        `${refs.length} lorebooks travel with this character. A target that cannot embed one leaves `
        + "the character intact and its world knowledge behind, which reads as the character "
        + "forgetting everything rather than as a failed conversion.",
      evidence: refs.map(String).join(", "),
    });
  }
  return observations;
}

/**
 * What a regex set does, and whether it is text cleanup or a state machine.
 *
 * A replacement containing a variable write is not formatting - it is how an engine without a hook
 * system stores state, by catching a tag the model emitted and writing what it captured. Such a set
 * is program logic whose ORDER matters, and treating it as cosmetic is how it gets reordered or
 * half-dropped.
 */
export function explainRegex(body: unknown): Observation[] {
  const rules = rows(body, "rules");
  if (rules.length === 0) return [];

  const observations: Observation[] = [];
  const writers = rules.filter((r) => /\{\{(set|add|inc|dec)(global)?var::/i.test(String(r["replace"] ?? "")));
  if (writers.length > 0) {
    observations.push({
      id: "stateful-regex",
      severity: "critical",
      says:
        `${writers.length} of ${rules.length} rules write variables in their replacement, so this is `
        + "state machinery rather than text cleanup: it catches what the model emitted and stores "
        + "it. Order and phases are load-bearing, and a rule dropped as cosmetic takes the state "
        + "it was keeping with it.",
      evidence: writers.slice(0, 6).map((r) => String(r["label"] ?? r["id"])).join(", "),
    });
  }

  const globals = rules.filter((r) => /\{\{(set|add|inc|dec)globalvar::/i.test(String(r["replace"] ?? "")));
  if (globals.length > 0) {
    observations.push({
      id: "global-state-regex",
      severity: "critical",
      says:
        `${globals.length} rules write GLOBAL variables, which outlive the conversation. State set in `
        + "one chat is still set in the next one and in every other character's chats, so these carry "
        + "further than chat-local rules and a stale value survives starting over. Whether that is "
        + "the intent is a decision; that it crosses chats is not in doubt.",
      evidence: globals.slice(0, 6).map((r) => String(r["label"] ?? r["id"])).join(", "),
    });
  }

  const erasers = rules.filter((r) => String(r["replace"] ?? "").trim() === "");
  if (erasers.length > 0) {
    observations.push({
      id: "erasing-regex",
      severity: "note",
      says:
        `${erasers.length} rules delete what they match rather than rewrite it, which is how `
        + "authoring tags are kept out of what the reader sees. Lose them and the tags become "
        + "visible in the chat.",
      evidence: erasers.slice(0, 6).map((r) => String(r["label"] ?? r["id"])).join(", "),
    });
  }
  return observations;
}

/**
 * Explain any stored piece. Unknown kinds return nothing rather than a generic paragraph: an
 * explanation that says nothing specific still reads as understanding, which is worse than silence.
 */
export function explainEntity(entity: unknown, kind: string): Observation[] {
  const body = (entity as { body?: unknown })?.body ?? entity;
  switch (kind) {
    case "preset": return explainPreset(entity);
    case "lorebook": return explainLorebook(body);
    case "character": return explainCharacter(body);
    case "regex": return explainRegex(body);
    default: return [];
  }
}
