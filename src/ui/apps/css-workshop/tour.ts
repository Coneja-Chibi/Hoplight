/**
 * CSS Workshop first-run tour. Seen key: tour.css-workshop.seen
 */
import type { Tour } from "../../tours/tour-contract";

const cssWorkshopTour: Tour = {
  manifest: { appId: "css-workshop", title: "CSS Workshop" },
  steps: [
    {
      id: "welcome",
      title: "This is the CSS Workshop",
      body: "Two modes: Simple (guided ladder) and Advanced (code plus rule breakdown). Flip the Simple / Advanced toggle anytime.",
    },
    {
      id: "mode",
      anchor: "css-mode",
      title: "Simple or Advanced",
      body: "Simple is Starters, Assist, and Source. Advanced is free coding with a live breakdown of your rules. Same CSS either way.",
    },
    {
      id: "preview",
      anchor: "css-preview",
      title: "Sealed preview",
      body: "The mock is sandboxed. Hoplight never applies this CSS to the app chrome. Hosts apply it when you paste.",
    },
    {
      id: "starters",
      anchor: "css-starters",
      title: "Start with a starter",
      body: "In Simple mode, open Starters, pick a pack, press Use this. Then tune in Assist or Source.",
    },
    {
      id: "advanced",
      anchor: "css-advanced",
      title: "Advanced is code plus breakdown",
      body: "Write on the left. Parsed rules appear on the right. Click a rule for knobs. Import a .css file to load a sheet and see it broken down.",
    },
    {
      id: "done",
      title: "You are set",
      body: "Drafts live in prefs. Card-bound CSS still lives on the piece in the Workbench under Platform · Chub.",
    },
  ],
};

export default cssWorkshopTour;
