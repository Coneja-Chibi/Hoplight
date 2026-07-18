/**
 * The preset editor walkthrough - served by the workbench "?" when a preset is the active piece.
 * Copy checked against the editor: the block list with its toolbar and filters, the edit panel,
 * the samplers bar, the live build pane, the per-platform macro reference.
 */
import type { Tour } from "../tour-contract";

const presetTour: Tour = {
  manifest: { appId: "workbench-preset", title: "The preset editor" },
  steps: [
    {
      id: "welcome",
      title: "This is a preset",
      body: "A preset is the instruction stack an app sends the model before your chat: system prompt, jailbreaks, formatting rules, in order. This editor is that stack, laid bare.",
    },
    {
      id: "blocks",
      title: "The blocks",
      body: "Each row is one prompt block. Toggle it on or off, drag to reorder, click to edit its text. The search and filter tabs up top tame long imported stacks.",
    },
    {
      id: "edit",
      title: "Inside a block",
      body: "The edit panel shows the block's text, role, and placement. Character and token counts keep you honest about size as you write.",
    },
    {
      id: "samplers",
      title: "The dials",
      body: "The settings bar holds the sampler knobs a preset can carry: temperature and friends. Clearing one removes it from the file entirely instead of writing a zero.",
    },
    {
      id: "build",
      title: "The live build",
      body: "The build pane assembles your enabled blocks in order, exactly as they would leave for the model. It updates as you type; what you see is the real output.",
    },
    {
      id: "macros",
      title: "Macros speak per platform",
      body: "The macro reference lists what {{curly}} tokens the platform you are writing for actually runs, with honest separators. Switch the Write-for lens and the list changes with it; click any macro to copy.",
    },
    {
      id: "done",
      title: "That is the preset",
      body: "Export hands the stack to your platform in its own format. The ? replays this any time.",
    },
  ],
};

export default presetTour;
