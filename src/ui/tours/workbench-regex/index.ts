/**
 * The regex set walkthrough - served by the workbench "?" when a regex set is the active piece.
 * Copy checked against the editor: rule rail, the three authoring modes (guided quiz, plain words,
 * by example), the try-it bench, the starters gallery, travel health.
 */
import type { Tour } from "../tour-contract";

const regexTour: Tour = {
  manifest: { appId: "workbench-regex", title: "The regex workshop" },
  steps: [
    {
      id: "welcome",
      title: "This is the regex workshop",
      body: "Regex rules rewrite chat text on the fly: strip OOC notes, calm exclamations, fix quotes. This set is a list of rules that travel together.",
    },
    {
      id: "rules",
      title: "The rule list",
      body: "Each rule is find-this, replace-with-that, plus when it runs. Click one to open its page; drag to reorder, since rules run top to bottom.",
    },
    {
      id: "modes",
      title: "You never have to write regex",
      body: "Build a rule three ways: Guided asks you questions like a quiz, Plain Words turns a sentence into a pattern, By Example learns from a before-and-after you type. The raw pattern stays visible for the curious.",
    },
    {
      id: "bench",
      title: "Try it before you trust it",
      body: "The bench takes a sample line and shows exactly what every rule does to it, step by step. If a rule misbehaves, you see it here, not mid-chat.",
    },
    {
      id: "gallery",
      title: "Start from a starter",
      body: "The gallery holds ready-made recipes: remove asterisk actions, straighten curly quotes, tidy ellipses. Every example shown is computed by the real engine, never mocked.",
    },
    {
      id: "done",
      title: "That is the workshop",
      body: "The health check warns when a rule cannot travel to a platform you target. The ? replays this any time.",
    },
  ],
};

export default regexTour;
