/**
 * Starter pack: day counter on chat start.
 */
import type { WorkshopRecipe } from "../contract";

const recipe: WorkshopRecipe = {
  id: "day-start",
  order: 30,
  title: "Day counter on chat start",
  blurb: "When the chat starts, set day to 1 if it is empty.",
  vars: [{ name: "day", value: "" }],
  triggers: [
    {
      label: "seed day",
      event: "start",
      conditions: [{ type: "var", var: "day", operator: "=", value: "" }],
      effects: [{ type: "setvar", var: "day", operator: "=", value: "1" }],
    },
  ],
};

export default recipe;
