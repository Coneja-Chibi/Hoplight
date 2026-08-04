/**
 * What kinds of block a prompt preset is built from, as facts a model can be handed.
 *
 * THE SAME ARGUMENT AS THE MACRO CATALOGS. A model asked to "add a tracker" will produce something
 * that looks right and is architecturally wrong, because the shape of a tracker depends on whether
 * the preset renders inline or assembles from variables, and nothing in the file says which. Reasoned
 * from memory that gets answered confidently and plausibly. So the engine supplies the facts and the
 * model does the judging.
 *
 * WHERE THIS CAME FROM. A survey of 22 community SillyTavern presets, which yielded 270 block
 * observations across 24 categories. The `prevalence` field records how many of the 13 presets that
 * produced usable inventories carried each pattern, so a reader can tell a near-universal convention
 * from one author's idea. Nothing here reproduces anyone's prompt text; these are structural
 * descriptions and neutral skeletons written from scratch.
 */
import { BEHAVIOUR_PATTERNS } from "./patterns-behaviour";

/** Whether a block puts anything in the prompt at all. The single most load-bearing distinction. */
export type BlockEmission =
  /** Renders text into the prompt. */
  | "text"
  /** Renders nothing: it writes state, reserves a slot, or exists for the UI. */
  | "nothing"
  /** Renders only when a condition holds. */
  | "conditional";

/** How a pattern constrains its own position, which is evaluation order and therefore semantics. */
export interface OrderingRule {
  /**
   * Pattern ids that must evaluate BEFORE this one WHEN PRESENT. A pure ordering constraint: an
   * assembler must run after any option block, but a preset with no option blocks is not broken.
   */
  readonly after?: readonly string[];
  /**
   * Pattern ids that must EXIST and be enabled for this block to mean anything. Kept separate from
   * `after` because conflating them reports every optional sibling as a missing dependency.
   */
  readonly requires?: readonly string[];
  /** Pattern ids that must evaluate AFTER this one. */
  readonly before?: readonly string[];
  /** Why, in one sentence a reader can act on. */
  readonly because: string;
}

export interface BlockHazard {
  /** What goes wrong. */
  readonly failure: string;
  /** Why it is hard to notice, which is what makes it worth encoding. */
  readonly silent: string;
}

export interface BlockPattern {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  /** How it is built: role, placement, the macros it leans on. */
  readonly mechanics: string;
  readonly emits: BlockEmission;
  readonly macros: readonly string[];
  readonly ordering?: OrderingRule;
  readonly hazards?: readonly BlockHazard[];
  /** Of the 13 surveyed presets that produced a usable inventory. */
  readonly prevalence: number;
}

/**
 * The catalog.
 *
 * Ordered roughly as a preset evaluates: reserved slots, then state, then the writers, then the
 * renderer, then behaviour and policy. That is not an accident of listing; for the first four it is
 * the order they must actually run in.
 */
export const BLOCK_PATTERNS: readonly BlockPattern[] = [
  {
    id: "engine-slot",
    name: "Engine slot marker",
    purpose:
      "Reserve the point where the host splices in its own content: character description, personality,"
      + " scenario, persona, world info, example dialogue, chat history.",
    mechanics:
      "Empty content with the marker flag set, reusing the engine's reserved identifier. The author"
      + " writes nothing. The entire payload is where it sits relative to their own blocks, which"
      + " decides whether card data frames the rules or the rules frame the card.",
    emits: "nothing",
    macros: [],
    prevalence: 13,
    hazards: [{
      failure: "Moving a marker silently changes whether the model reads the card before or after the rules.",
      silent: "The block is empty either way, so a diff of its content shows nothing changed.",
    }],
  },
  {
    id: "variable-init",
    name: "Variable initializer",
    purpose:
      "Blank every configuration variable before anything else runs, so a value left by a previously"
      + " enabled option cannot leak into this build.",
    mechanics:
      "One enabled block at or near index 0: a run of setvar assignments to empty, each chased with"
      + " trim so the block emits nothing. Surveyed presets carry between three dozen and two hundred.",
    emits: "nothing",
    macros: ["{{setvar::name::}}", "{{trim}}"],
    prevalence: 5,
    ordering: {
      before: ["option-exclusive", "option-additive", "assembler", "tracker"],
      because:
        "It clears state, so anything that writes or reads state after it is fine and anything before"
        + " it is erased. This is the one block whose index is a correctness requirement.",
    },
    hazards: [{
      failure: "A variable a later block writes but this one never blanks keeps its value across rebuilds.",
      silent: "The stale value is a plausible one, because it was chosen deliberately last time.",
    }],
  },
  {
    id: "option-exclusive",
    name: "Exclusive option group",
    purpose:
      "A set of alternatives under one question where exactly one should be active: point of view,"
      + " tense, register, response length, difficulty, narrator identity.",
    mechanics:
      "Each member writes the same variable, or guards itself on a pick flag still being unset. The"
      + " group is usually announced by a divider whose name warns that only one may be enabled.",
    emits: "nothing",
    macros: ["{{setvar::name::value}}", "{{trim}}"],
    prevalence: 10,
    ordering: {
      after: ["variable-init"],
      before: ["assembler"],
      because: "It writes a slot the assembler reads, so it must run after the reset and before the render.",
    },
    hazards: [{
      failure:
        "Two members enabled at once resolve differently depending on the preset's family:"
        + " first-enabled-wins where members guard on an unset flag, last-write-wins where they all"
        + " write the same variable.",
      silent:
        "Both produce a complete, plausible prompt. No surveyed preset declares which rule it follows,"
        + " so a reader's intuition transfers exactly backwards between the two families.",
    }],
  },
  {
    id: "option-additive",
    name: "Additive module",
    purpose:
      "Independent slices of guidance where any number may be active at once, each contributing its"
      + " own fragment.",
    mechanics:
      "Either appends its own text directly, or writes into a shared accumulator that an assembler"
      + " reads. Which of the two decides whether ordering among siblings matters.",
    emits: "conditional",
    macros: ["{{setvar::name::value}}", "{{trim}}"],
    prevalence: 11,
    ordering: {
      after: ["variable-init"],
      because: "When it writes state rather than text, the reset must have run first.",
    },
  },
  {
    id: "assembler",
    name: "Assembler",
    purpose:
      "The block that actually renders. In a variable-driven preset almost nothing else emits"
      + " anything: the option blocks write silently and this pulls the selected values into one"
      + " passage with a stable heading structure.",
    mechanics:
      "A manifest of getvar calls interleaved with headings. Because the initializer blanked"
      + " everything, unselected slots collapse to nothing and the headings stay stable whatever the"
      + " configuration. Surveyed assemblers carry between a dozen and 126 reads.",
    emits: "text",
    macros: ["{{getvar::name}}"],
    prevalence: 4,
    ordering: {
      after: ["option-exclusive", "option-additive"],
      requires: ["variable-init"],
      because: "It reads what the option blocks wrote, so every writer must evaluate before it.",
    },
    hazards: [{
      failure: "A module ordered after the assembler is enabled and never read.",
      silent:
        "The preset renders completely and the module simply is not in it. Exactly one surveyed"
        + " preset detects this; four other mechanisms carry the same hazard with no detection.",
    }],
  },
  {
    id: "tracker",
    name: "Tracker",
    purpose:
      "A per-reply state readout so continuity survives a long scene without the user restating it:"
      + " time, location, who is present, condition, inventory, relationship meters, open threads.",
    mechanics:
      "Either an instruction to emit a formatted readout each turn, or a variable manifest rendered"
      + " like a small assembler. Usually placed late, near the transcript, so it is not buried"
      + " behind the rule stack.",
    emits: "text",
    macros: ["{{getvar::name}}", "{{setvar::name::value}}"],
    prevalence: 8,
  },
  {
    id: "reasoning-scaffold",
    name: "Reasoning scaffold",
    purpose:
      "Force an explicit planning pass before prose: recall context, state character position, design"
      + " the scene, then hand off to the narrative.",
    mechanics:
      "A structured checklist the model works through in a reasoning block. In the most developed"
      + " presets it is the load-bearing compliance mechanism rather than a quality aid.",
    emits: "text",
    macros: [],
    prevalence: 9,
  },
  {
    id: "anti-slop",
    name: "Anti-slop",
    purpose:
      "Suppress the recognisable texture of machine-written fiction: filter verbs, named emotions in"
      + " narration, stock gestures, intensifier padding, the not-this-but-that construction.",
    mechanics: "A list of prohibitions, usually late in the stack so it is close to the generation.",
    emits: "text",
    macros: [],
    prevalence: 10,
  },
  {
    id: "continuity-bounds",
    name: "Continuity and knowledge bounds",
    purpose:
      "Stop information leaking between scenes and characters: no knowing what was never observed, no"
      + " reacting to off-screen events, no narrating another party's private interior.",
    mechanics:
      "A short rule block. Unlike style guidance this one is checkable against the transcript, which"
      + " is why it survives into otherwise minimal presets.",
    emits: "text",
    macros: [],
    prevalence: 7,
  },
  {
    id: "output-dials",
    name: "Output-shape dials",
    purpose:
      "Bound the mechanical surface of the reply: length band, narrative person, tense, dialogue to"
      + " narration ratio.",
    mechanics: "Usually an exclusive group per dial, written to variables and rendered by the assembler.",
    emits: "conditional",
    macros: ["{{setvar::name::value}}"],
    prevalence: 8,
    hazards: [{
      failure: "Length drift over a long session is the most visible failure across the corpus.",
      silent: "Each individual reply looks reasonable; only the trend is wrong.",
    }],
  },
  {
    id: "settings-mirror",
    name: "Settings mirror",
    purpose:
      "Reflect the active configuration back near the end of the context, so options declared in a"
      + " long preamble are not lost behind the transcript.",
    mechanics: "A compact restatement of the same variables the assembler read, placed after chat history.",
    emits: "text",
    macros: ["{{getvar::name}}"],
    prevalence: 4,
    ordering: {
      after: ["assembler"],
      requires: ["assembler"],
      because: "It repeats what was already assembled, so it is meaningless before the values exist.",
    },
  },
  {
    id: "card-suppression",
    name: "Card-override suppression",
    purpose:
      "Neutralise the character card's own injected fields so arbitrary card text cannot compete with"
      + " the preset's rules.",
    mechanics:
      "Claims the engine's reserved identifier for a card-overridable slot and renders it empty. A"
      + " deliberate suppression device, not an unfinished block.",
    emits: "nothing",
    macros: ["{{trim}}"],
    prevalence: 6,
    hazards: [{
      failure:
        "Whether card-supplied instructions win or lose against the preset is decided by an empty"
        + " string in a magic-named slot.",
      silent: "Nothing states the policy; the absence of the block is the opposite policy.",
    }],
  },
  {
    id: "divider",
    name: "Section divider",
    purpose:
      "Group a long toggle list into named regions so a human can navigate it. Surveyed lists run from"
      + " 29 to 316 entries.",
    mechanics:
      "An empty or comment-only block whose name carries the label. Contributes nothing to the model"
      + " in most implementations, which is why it is safe to leave permanently enabled.",
    emits: "nothing",
    macros: ["{{// comment}}", "{{trim}}"],
    prevalence: 10,
  },
  {
    id: "self-validation",
    name: "Self-validation",
    purpose:
      "Detect the preset's own misconfiguration and report it to the user: wrong ordering, a required"
      + " block disabled, a module enabled without its structural counterpart, an option group unpicked.",
    mechanics:
      "A block that tests flags written by other blocks and emits a diagnostic when an expectation"
      + " fails. Requires every checked block to have written its marker first.",
    emits: "conditional",
    macros: ["{{getvar::name}}"],
    prevalence: 1,
    ordering: {
      after: ["variable-init", "option-exclusive", "option-additive", "assembler"],
      because: "It can only report on state that has already been written.",
    },
    hazards: [{
      failure: "One author in thirteen built this. The rest ship a program with no compile step.",
      silent: "Every defect it would catch renders as a complete and plausible preset.",
    }],
  },
];

/**
 * The whole catalog: the structural patterns above plus the behaviour and policy ones.
 *
 * Split across two files because the halves answer to different rules, not because either got long.
 * Only the structural half carries ordering constraints, so only it feeds the coherence checker.
 */
export const ALL_PATTERNS: readonly BlockPattern[] = [...BLOCK_PATTERNS, ...BEHAVIOUR_PATTERNS];

const BY_ID = new Map(ALL_PATTERNS.map((pattern) => [pattern.id, pattern]));

export const findPattern = (id: string): BlockPattern | undefined => BY_ID.get(id.trim().toLowerCase());

/** Patterns that render nothing, which is most of them in a variable-driven preset. */
export const silentPatterns = (): readonly BlockPattern[] =>
  BLOCK_PATTERNS.filter((pattern) => pattern.emits === "nothing");
