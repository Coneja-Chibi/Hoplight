/**
 * Marinara's macro reference. TOKENS + SYNTAX + CATEGORIES transcribed from the Marinara Engine's
 * own exported capability table (packages/shared/src/utils/macro-engine.ts -> SUPPORTED_MACROS),
 * cross-checked against its resolveMacros() regexes. Descriptions written fresh (Marinara is
 * AGPL-3.0; clean-room doctrine says don't lift their prose). The group names are Marinara's own
 * `category` values, so this reference matches what its engine advertises.
 *
 * Separators differ from BOTH RoleCall and SillyTavern - do not "tidy" them:
 *   {{random:X:Y}} IS a min/max range here (single colon) - the same-looking ST macro is a list pick
 *   {{roll:XdY}} single colon · {{trim}} takes no argument · case transforms are BLOCK form
 *   {{uppercase}}...{{/uppercase}}, not {{upper::text}}
 *
 * Marinara also resolves any bare {{NAME}} from the preset's own variables (its choice blocks set
 * them), which is why {{NAME}} is listed under Variables.
 */
import type { MacroGroup } from "./types";

export const MARINARA_MACRO_GROUPS: MacroGroup[] = [
  {
    name: "Identity",
    description: "Who is in the scene",
    macros: [
      { macro: "{{user}}", description: "Current user or persona name" },
      { macro: "{{persona}}", description: "Active persona description, personality, backstory, appearance and scenario, joined by newlines" },
      { macro: "{{char}}", description: "Current character name" },
      { macro: "{{characters}}", description: "All character names, comma separated" },
    ],
  },
  {
    name: "Character",
    description: "Fields off the current character card",
    macros: [
      { macro: "{{description}}", description: "Current character description" },
      { macro: "{{personality}}", description: "Current character personality" },
      { macro: "{{backstory}}", description: "Current character backstory" },
      { macro: "{{appearance}}", description: "Current character appearance" },
      { macro: "{{scenario}}", description: "Current character scenario" },
      { macro: "{{example}}", description: "Current character example dialogue" },
    ],
  },
  {
    name: "Context",
    description: "Session and runtime state",
    macros: [
      { macro: "{{input}}", description: "Most recent user message" },
      { macro: "{{model}}", description: "Current model name" },
      { macro: "{{chatId}}", description: "Current chat id" },
      { macro: "{{agent::TYPE}}", description: "Cached output for an agent or tracker type" },
    ],
  },
  {
    name: "Time",
    description: "Real-world clock and calendar",
    macros: [
      { macro: "{{date}}", description: "Current real date, YYYY-MM-DD" },
      { macro: "{{time}}", description: "Current real time, HH:MM", op: "time.now" },
      { macro: "{{datetime}}", description: "Current ISO timestamp" },
      { macro: "{{isotime}}", description: "Current ISO timestamp" },
      { macro: "{{weekday}}", description: "Current weekday name" },
    ],
  },
  {
    name: "Random",
    description: "Dice and random numbers. Single colon, and the range form is real here",
    macros: [
      { macro: "{{random}}", description: "Random number from 0 to 100", op: "random.range" },
      { macro: "{{random:X:Y}}", description: "Random number between X and Y. Single colon", example: "{{random:1:20}}", op: "random.range" },
      { macro: "{{roll:XdY}}", description: "Dice roll total. Single colon", example: "{{roll:2d6}}", op: "dice.roll" },
    ],
  },
  {
    name: "Variables",
    description: "Dynamic variables, plus the preset's own choice-block variables",
    macros: [
      { macro: "{{getvar::name}}", description: "Read a dynamic variable" },
      { macro: "{{setvar::name::value}}", description: "Set a dynamic variable" },
      { macro: "{{addvar::name::value}}", description: "Append to a dynamic variable" },
      { macro: "{{incvar::name}}", description: "Increment a numeric variable" },
      { macro: "{{decvar::name}}", description: "Decrement a numeric variable" },
      { macro: "{{NAME}}", description: "Resolve a preset variable named NAME, e.g. one set by a choice block" },
    ],
  },
  {
    name: "Formatting",
    description: "Whitespace, case, and comments. Case transforms wrap a block",
    macros: [
      { macro: "{{newline}}", description: "Insert a literal newline" },
      { macro: "{{\\n}}", description: "Insert a literal newline" },
      { macro: "{{trim}}", description: "Trim the final output. Takes no argument", op: "text.trim-surrounding" },
      { macro: "{{trimStart}}", description: "Trim whitespace at the start of the output" },
      { macro: "{{trimEnd}}", description: "Trim whitespace at the end of the output" },
      { macro: "{{uppercase}}...{{/uppercase}}", description: "Uppercase a wrapped block" },
      { macro: "{{lowercase}}...{{/lowercase}}", description: "Lowercase a wrapped block" },
      { macro: "{{noop}}", description: "No-op placeholder, removed from output" },
      { macro: "{{// comment}}", description: "Author comment, removed from output" },
      { macro: '{{banned "text"}}', description: "Accepted, but currently stripped from output", op: "gen.banned" },
    ],
  },
];
