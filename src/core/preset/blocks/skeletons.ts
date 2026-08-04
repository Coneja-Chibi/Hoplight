/**
 * A starting block for each pattern: neutral, deliberately boring, meant to be edited.
 *
 * WHY SKELETONS AND NOT EXAMPLES. The catalog in patterns.ts tells a reader what a tracker is for and
 * how one is built. That is enough to judge a block and not enough to write one, because the part
 * people get wrong is mechanical: which macros, what role, whether it emits, where it sits. A
 * skeleton answers all four by being the thing itself.
 *
 * ORIGINAL AND NEUTRAL THROUGHOUT. Nothing here derives from the surveyed presets. The prose is
 * placeholder on purpose: a skeleton that sounds finished invites shipping it unedited, and a
 * roleplay preset written by somebody else's default voice is worse than one written badly on
 * purpose. Every skeleton says what to replace.
 *
 * Macro syntax is SillyTavern's, because that is the dialect the catalog was surveyed in. Crossing a
 * skeleton to another engine is the format layer's job, not this module's.
 */
import { ALL_PATTERNS, type BlockPattern } from "./patterns";

/** A prompt block in the shape a preset carries, before any platform's field names are applied. */
export interface BlockSkeleton {
  readonly identifier: string;
  readonly name: string;
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
  /** True for a reserved engine slot, whose content is meant to stay empty. */
  readonly marker?: boolean;
  /** What a person should change first. Shown by the tool, never sent to a model as prompt text. */
  readonly edit: string;
}

const SKELETONS: Readonly<Record<string, BlockSkeleton>> = {
  "variable-init": {
    identifier: "hp_init",
    name: "00 | Initialize state",
    role: "system",
    content:
      "{{// Blank every variable this preset writes. Must run before any block that sets one. }}"
      + "{{setvar::hp_pov::}}{{setvar::hp_tense::}}{{setvar::hp_length::}}{{trim}}",
    edit: "Add one setvar per variable your preset uses. Every writer needs a line here or its value survives a rebuild.",
  },
  "option-exclusive": {
    identifier: "hp_pov_third",
    name: "POV | Third person",
    role: "system",
    content: "{{setvar::hp_pov::Write in third person, past tense.}}{{trim}}",
    edit:
      "Copy this once per alternative, changing the identifier, the name and the written value. Keep"
      + " the variable the same across the group: that is what makes them exclusive.",
  },
  "option-additive": {
    identifier: "hp_module_example",
    name: "Module | Example",
    role: "system",
    content: "{{setvar::hp_modules::{{getvar::hp_modules}}\nKeep scene transitions explicit.}}{{trim}}",
    edit:
      "Appends to a shared accumulator rather than replacing it, so several may be enabled at once."
      + " Replace the sentence; keep the read-then-write shape or each module erases the last.",
  },
  assembler: {
    identifier: "hp_assemble",
    name: "Assemble the prompt",
    role: "system",
    content:
      "## Style\n{{getvar::hp_pov}}\n{{getvar::hp_tense}}\n\n"
      + "## Length\n{{getvar::hp_length}}\n\n"
      + "## Modules\n{{getvar::hp_modules}}",
    edit:
      "One getvar per slot, under stable headings. Unselected slots collapse to nothing because the"
      + " initializer blanked them, so the headings stay put whatever is enabled.",
  },
  tracker: {
    identifier: "hp_tracker",
    name: "Tracker | Scene state",
    role: "system",
    content:
      "At the end of each reply, output a short state block:\n"
      + "Time: {{getvar::hp_time}}\nPlace: {{getvar::hp_place}}\nPresent: {{getvar::hp_present}}",
    edit:
      "Replace the fields with what your story actually tracks. Place this late, near the transcript,"
      + " so it is not buried behind the rule stack.",
  },
  "settings-mirror": {
    identifier: "hp_mirror",
    name: "Reminder | Active settings",
    role: "system",
    content: "Reminder of the settings for this reply: {{getvar::hp_pov}} {{getvar::hp_length}}",
    edit: "Repeat only the few settings that drift. Must sit after the assembler and after chat history.",
  },
  "reasoning-scaffold": {
    identifier: "hp_plan",
    name: "Plan before writing",
    role: "system",
    content:
      "Before writing, think through: what changed since the last reply, where everyone is, what this"
      + " scene needs to accomplish. Then write the reply.",
    edit: "Replace the three checks with the ones your story needs. Keep it short; a long checklist is skimmed.",
  },
  "anti-slop": {
    identifier: "hp_prose",
    name: "Prose constraints",
    role: "system",
    content:
      "Avoid: naming an emotion instead of showing it, filter verbs before perception, and the"
      + " construction that negates one thing to assert another.",
    edit: "Add the specific habits you want gone. Place late, close to the generation.",
  },
  "continuity-bounds": {
    identifier: "hp_continuity",
    name: "Knowledge boundaries",
    role: "system",
    content:
      "Characters know only what they have witnessed or been told. Do not narrate another party's"
      + " private thoughts, and do not react to events that happened off screen.",
    edit: "Usually keep as written. This is one of the few rules that is checkable against the transcript.",
  },
  "output-dials": {
    identifier: "hp_length_standard",
    name: "Length | Standard",
    role: "system",
    content: "{{setvar::hp_length::Write two to four paragraphs.}}{{trim}}",
    edit:
      "One block per band, all writing the same variable so they behave as an exclusive group."
      + " Length drift is the most visible failure over a long session.",
  },
  "card-suppression": {
    identifier: "charPrompt",
    name: "Card system prompt (suppressed)",
    role: "system",
    content: "{{// Deliberately empty: the card's own instructions do not override this preset. }}{{trim}}",
    edit:
      "Keep it if this preset should outrank whatever a character card carries. Delete the block"
      + " entirely to let card instructions through. The absence is the opposite policy.",
  },
  divider: {
    identifier: "hp_divider_style",
    name: "===== STYLE =====",
    role: "system",
    content: "{{// Section header. Renders nothing. }}{{trim}}",
    edit: "Rename to label the region below it. Safe to leave permanently enabled since it emits nothing.",
  },
  "self-validation": {
    identifier: "hp_check",
    name: "Check this preset is wired correctly",
    role: "system",
    content:
      "{{// Emits only when something is misconfigured. }}"
      + "{{if {{getvar::hp_pov}}}}{{else}}Setup: no point of view option is enabled.{{/if}}{{trim}}",
    edit:
      "Add one test per thing that can silently go wrong. This must run after every block it checks,"
      + " so keep it last.",
  },
  "engine-slot": {
    identifier: "chatHistory",
    name: "Chat History",
    role: "system",
    content: "",
    marker: true,
    edit:
      "Leave the content empty; the engine fills it. The only decision is where it sits, which"
      + " determines whether your rules frame the transcript or the transcript frames your rules.",
  },
};

/** The starting block for a pattern, or null when the pattern has no single sensible shape. */
export const skeletonFor = (patternId: string): BlockSkeleton | null =>
  SKELETONS[patternId.trim().toLowerCase()] ?? null;

/** Patterns that ship a starting block. */
export const patternsWithSkeletons = (): readonly BlockPattern[] =>
  ALL_PATTERNS.filter((pattern) => skeletonFor(pattern.id) !== null);

/**
 * A whole starter preset: every skeleton, in an order that satisfies the catalog's own rules.
 *
 * Emitted in dependency order rather than catalog order, so what comes out passes checkCoherence.
 * A starter kit that fails our own check would be a poor advertisement for the check.
 */
export function starterBlocks(): readonly BlockSkeleton[] {
  const order = [
    "variable-init",
    "divider",
    "option-exclusive",
    "output-dials",
    "option-additive",
    "assembler",
    "engine-slot",
    "reasoning-scaffold",
    "continuity-bounds",
    "anti-slop",
    "tracker",
    "settings-mirror",
    "self-validation",
  ];
  return order.map(skeletonFor).filter((block): block is BlockSkeleton => block !== null);
}
