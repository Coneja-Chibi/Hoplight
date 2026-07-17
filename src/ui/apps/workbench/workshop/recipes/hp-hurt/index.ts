/**
 * Starter pack: HP drops when hurt is mentioned.
 */
import type { WorkshopRecipe } from "../contract";

const recipe: WorkshopRecipe = {
  id: "hp-hurt",
  order: 10,
  title: "HP drops when hurt is mentioned",
  blurb: "After the model replies, if the status variable is Hurt, subtract from hp.",
  vars: [
    { name: "hp", value: "100" },
    { name: "status", value: "ok" },
  ],
  triggers: [
    {
      label: "hurt costs HP",
      event: "output",
      conditions: [{ type: "var", var: "status", operator: "=", value: "Hurt" }],
      effects: [{ type: "setvar", var: "hp", operator: "-=", value: "10" }],
    },
  ],
};

export default recipe;
