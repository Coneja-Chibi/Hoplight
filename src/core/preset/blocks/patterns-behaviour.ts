/**
 * The behaviour and policy patterns: blocks that shape what the model writes rather than how the
 * preset assembles itself.
 *
 * SEPARATE FROM patterns.ts FOR A REASON THAT IS NOT FILE LENGTH. The structural patterns carry
 * ordering rules, because getting them in the wrong sequence silently breaks the preset. These do
 * not: they emit text, they sit where the author puts them, and moving one changes emphasis rather
 * than correctness. The coherence checker learns nothing from this file, and that is the honest
 * distinction between the two halves of the catalog.
 *
 * Same discipline as the structural half: these are structural descriptions written from a survey of
 * 22 community presets, not anyone's prompt text, and the skeletons are original and deliberately
 * plain.
 */
import type { BlockPattern } from "./patterns";

export const BEHAVIOUR_PATTERNS: readonly BlockPattern[] = [
  {
    id: "persona-frame",
    name: "Persona and narrator frame",
    purpose:
      "Establish who is writing: what the model is, who it may never speak for, and what turn-taking"
      + " rules apply. The session's operating contract.",
    mechanics:
      "Usually one long block flagged as the engine's own system prompt and placed first, internally"
      + " subdivided by named sections so later blocks can refer to those names. A separate narrator"
      + " identity, distinct from any played character, is a common second shape.",
    emits: "text",
    macros: ["{{char}}", "{{user}}"],
    prevalence: 10,
    hazards: [{
      failure: "The contract says one thing and a later block quietly contradicts it.",
      silent: "Both blocks render, and the model resolves the conflict however it likes.",
    }],
  },
  {
    id: "voice-style",
    name: "Voice, style and genre",
    purpose: "Set the prose register: the texture and conventions the writing should follow.",
    mechanics:
      "Three distinguishable jobs that the corpus keeps conflating. A passive catalogue of voices the"
      + " model may draw on, always on and selecting nothing. An imposed register, one small block per"
      + " option under whatever exclusivity mechanism the preset uses. And genre framing, which sets"
      + " conventions rather than sentence texture.",
    emits: "conditional",
    macros: ["{{setvar::name::value}}", "{{trim}}"],
    prevalence: 9,
  },
  {
    id: "content-gate",
    name: "Content ceiling",
    purpose:
      "State how far the fiction may go, and how such material is handled once permitted. A ceiling"
      + " the author sets for their own story.",
    mechanics:
      "Exclusive tiers, commonly coupling permission to description quality rather than leaving it"
      + " standalone. The strongest tier often sets a flag other modules test, so a single choice"
      + " changes behaviour in several places at once.",
    emits: "conditional",
    macros: ["{{setvar::name::value}}", "{{trim}}"],
    prevalence: 10,
    hazards: [{
      failure: "A tier that sets a flag other blocks read couples two settings that look independent.",
      silent: "Changing the tier changes behaviour somewhere the user was not looking.",
    }],
  },
  {
    id: "compliance-shaping",
    name: "Compliance shaping",
    purpose:
      "Argue the model into proceeding, as distinct from declaring a ceiling. Present in a minority of"
      + " the surveyed presets and effectively always shipped disabled.",
    mechanics:
      "Distinguished from a content ceiling by mechanism rather than topic: it addresses the model's"
      + " willingness rather than the story's limits, and the surveyed implementations lean on role"
      + " and placement to do it. Catalogued here because someone importing a stranger's preset should"
      + " be able to find out whether it contains one; Hoplight ships no starting block for it.",
    emits: "text",
    macros: [],
    prevalence: 6,
    hazards: [{
      failure: "It is the block class most likely to be present in an imported preset without the importer noticing.",
      silent: "It is normally disabled on arrival, so it does not show up in a rendered prompt until enabled.",
    }],
  },
  {
    id: "rendered-output",
    name: "Rendered output and markup",
    purpose:
      "Shape how the reply is displayed rather than what it says: per-speaker colouring, styled"
      + " in-world artifacts, collapsible widgets, target language.",
    mechanics:
      "The only blocks whose payload is markup rather than instruction. Colour assignments are stable"
      + " for a whole story and usually come with legibility constraints and a legend. Artifact blocks"
      + " are trigger-scoped: they describe when the styling applies, not just what it looks like.",
    emits: "text",
    macros: ["{{setvar::name::value}}", "{{getvar::name}}", "{{char}}"],
    prevalence: 9,
  },
  {
    id: "memory-handoff",
    name: "Memory, recap and handoff",
    purpose:
      "Produce a portable summary so a chat that has outgrown its context can move to a fresh one, and"
      + " give the model a consolidated statement of durable facts.",
    mechanics:
      "Commonly ships enabled but inert: it lists the phrasings that trigger it and states plainly"
      + " that nothing is produced unless asked. The body defines an output contract, typically a"
      + " structured state summary plus a ready-to-paste opening, with a stated length budget so the"
      + " result actually fits somewhere else.",
    emits: "conditional",
    macros: ["{{user}}", "{{char}}", "{{getvar::name}}", "{{trim}}"],
    prevalence: 5,
  },
  {
    id: "variety",
    name: "Variety injection",
    purpose: "Stop successive turns converging on the same beat or the same register.",
    mechanics:
      "Two opposite approaches. Engine-side, a dice macro draws at prompt-build time and a numbered"
      + " table in the same block indexes into it, so each turn gets a fresh draw and no state is"
      + " kept. Model-side, the block asks the model to vary its own choices, which is cheaper and"
      + " less reliable.",
    emits: "text",
    macros: ["{{roll:1d6}}", "{{setvar::name::value}}"],
    prevalence: 4,
    hazards: [{
      failure: "The engine-side form resolves at build time, so the same value cannot be referred to later.",
      silent: "A later block reading it gets a different number, not an error.",
    }],
  },
  {
    id: "scope-override",
    name: "Scope override",
    purpose:
      "Switch the preset into a different mode by revoking part of what an earlier block granted,"
      + " rather than by adding new instruction. Most visibly, dropping from narrator-with-cast into"
      + " strict single-character mode.",
    mechanics:
      "States the revocation directly and ends with a hard stop instruction. Commonly framed as an"
      + " out-of-character request, which is how a later block overrides an earlier one without"
      + " editing it. Always shipped disabled.",
    emits: "text",
    macros: ["{{char}}", "{{user}}"],
    prevalence: 4,
    hazards: [{
      failure: "It contradicts the persona frame on purpose, so enabling it with the wrong frame produces incoherent instructions.",
      silent: "Both blocks render and the model picks one.",
    }],
  },
  {
    id: "annotation",
    name: "Annotation",
    purpose:
      "Carry UI metadata and maintenance notes inside the preset without spending a token, so a long"
      + " block list stays navigable and its dependencies are discoverable.",
    mechanics:
      "Everything rides inside comment macros chased by trim, so it renders to nothing. The developed"
      + " form is a key-value schema covering category, tooltip, exclusivity family, sibling conflicts,"
      + " warnings and model recommendations. It is an undeclared schema living in comments, which is"
      + " also the most promising thing to read when classifying somebody else's preset.",
    emits: "nothing",
    macros: ["{{// comment}}", "{{trim}}"],
    prevalence: 7,
  },
];
