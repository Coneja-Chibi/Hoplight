/**
 * Workshop first-run tour data. Mounted inside WorkshopView (not the shell app tour loader)
 * so Fields-only users never see it. Seen key: tour.workshop.seen (cleared by Replay tutorials).
 */
import type { Tour } from "../../../tours/tour-contract";

const workshopTour: Tour = {
  manifest: { appId: "workshop", title: "Workshop" },
  steps: [
    {
      id: "welcome",
      title: "This is the Workshop",
      body: "Where the card's rules live. Starters drop a finished pack. Triggers edit When / If / Then. The Test Bench on the right runs those rules safely.",
    },
    {
      id: "starters",
      anchor: "ws-starters",
      title: "Start with a starter",
      body: "If you have no rules yet, Starters opens first. Preview a pack, press Use this, then tweak the rows. Undo brings the last starter back out.",
    },
    {
      id: "bench",
      anchor: "ws-bench",
      title: "Press Run rules",
      body: "Pick an event, set variables, press Run rules. Values that moved float to the top. Nothing here talks to a model or the network.",
    },
    {
      id: "graph",
      anchor: "ws-graph",
      title: "Or draw a state map",
      body: "State map is for game loops: Idle to Combat, Dating, and so on. Apply turns moves into normal trigger rules you can still edit.",
    },
    {
      id: "package",
      anchor: "ws-package",
      title: "Package parts are optional",
      body: "Some cards bring scripts inside a package. Those re-export fully only as Risu. Run package scripts is advanced and always sealed.",
    },
    {
      id: "done",
      title: "You are set",
      body: "Build a rule, run it, save. Need this again? Replay tutorials from the shell menu, or open Starters any time.",
    },
  ],
};

export default workshopTour;
