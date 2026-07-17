/**
 * Starter pack: dice check then branch.
 */
import type { WorkshopRecipe } from "../contract";

const recipe: WorkshopRecipe = {
  id: "dice-branch",
  order: 50,
  title: "Dice check then branch",
  blurb: "After a reply, roll 1-20 into check. If check is at least 10, set result to pass.",
  vars: [
    { name: "check", value: "0" },
    { name: "result", value: "" },
  ],
  triggers: [
    {
      label: "roll check",
      event: "output",
      conditions: [],
      effects: [{ type: "setvar", var: "check", operator: "=", value: "{{roll::20}}" }],
    },
    {
      label: "pass if high",
      event: "output",
      conditions: [{ type: "var", var: "check", operator: ">=", value: "10" }],
      effects: [{ type: "setvar", var: "result", operator: "=", value: "pass" }],
    },
    {
      label: "fail if low",
      event: "output",
      conditions: [{ type: "var", var: "check", operator: "<", value: "10" }],
      effects: [{ type: "setvar", var: "result", operator: "=", value: "fail" }],
    },
  ],
};

export default recipe;
