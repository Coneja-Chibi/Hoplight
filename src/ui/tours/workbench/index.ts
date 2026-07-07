/**
 * The Workbench tour - the first drop-in over the tutorial framework, and the proof of the pattern:
 * a folder with an index that default-exports a Tour, discovered by the same loader apps and setup
 * steps use. Pure data.
 *
 * It DRIVES the user, not just talks: the second step opens one of their characters (and forces Grid)
 * so the editor populates, then the following steps highlight the real controls. Picking a layout or
 * mode means clicking the actual highlighted toggle, so the editor responds live - a real preview
 * beats a mockup. Anchors: portrait, layout, mode, lens, save.
 */
import type { Tour } from "../tour-contract";

const workbenchTour: Tour = {
  manifest: { appId: "workbench", title: "Getting started" },
  steps: [
    {
      id: "welcome",
      title: "This is the Workbench",
      body: "Where you build and edit a character. Everything about them lives on this one page. Let me open one of yours so you can see it.",
    },
    {
      id: "open",
      act: { setPref: { key: "editor.mode", value: "grid" }, open: "piece" },
      title: "Here's the editor",
      body: "I opened one of your characters. This is where every detail lives, laid out as cards you can fill in.",
    },
    {
      id: "layout",
      anchor: "layout",
      title: "Pick your layout",
      body: "Click Bento or Playbill up here (highlighted) and watch the fields rearrange. Bento shows them all at once; Playbill turns them into acts you page through.",
    },
    {
      id: "mode",
      anchor: "mode",
      title: "Fill it in your way",
      body: "Grid shows every field to edit directly. Steps walks you through like a quiz. Give the toggle a click to feel the difference, your choice sticks.",
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
      body: "Poke around, nothing here can break. Need it again? The ? in the corner replays this any time.",
    },
  ],
};

export default workbenchTour;
