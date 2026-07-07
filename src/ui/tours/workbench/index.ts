/**
 * The Workbench tour - the first drop-in over the tutorial framework, and the proof of the pattern:
 * a folder with an index that default-exports a Tour, discovered by the same loader apps and setup
 * steps use. Pure data. Each step points at a `data-tour` anchor in the editor; the layout and mode
 * steps offer the real preferences inline (writing editor.layout / editor.mode through ctx.prefs).
 */
import type { Tour } from "../tour-contract";

const workbenchTour: Tour = {
  manifest: { appId: "workbench", title: "Getting started" },
  steps: [
    {
      id: "welcome",
      title: "This is the Workbench",
      body: "Where you build and edit a character. Everything about them lives on this one page.",
    },
    {
      id: "layout",
      anchor: "layout",
      title: "Pick your layout",
      body: "Bento packs every field into cards you see at once. Playbill turns it into acts you page through. Change it whenever.",
      choice: {
        prefKey: "editor.layout",
        options: [
          { value: "bento", label: "Bento", sub: "All fields, at once" },
          { value: "playbill", label: "Playbill", sub: "Acts you page through" },
        ],
      },
    },
    {
      id: "mode",
      anchor: "mode",
      title: "Fill it in your way",
      body: "Grid shows every field to edit directly. Steps walks you through like a quiz. This choice sticks, so you are not dropped back into the quiz next time.",
      choice: {
        prefKey: "editor.mode",
        options: [
          { value: "grid", label: "Grid", sub: "Everything visible" },
          { value: "interview", label: "Steps", sub: "Guided, quiz-like" },
        ],
      },
    },
    {
      id: "portrait",
      anchor: "portrait",
      title: "Their face",
      body: "Drop art in here, or skip it and add it later. The card even borrows its accent color from the picture.",
    },
    {
      id: "lens",
      anchor: "lens",
      title: "Aim at a platform",
      body: "Tap the platforms you are building for. Fields that platform cannot carry dim out, so you always know what will travel.",
    },
    {
      id: "save",
      anchor: "save",
      title: "Saved as you go",
      body: "Your work is kept on this computer the moment you make it. There is no save button to remember.",
    },
    {
      id: "done",
      title: "That is the whole tour",
      body: "Poke around, nothing here can break. Need it again? The ? up top replays this any time.",
    },
  ],
};

export default workbenchTour;
