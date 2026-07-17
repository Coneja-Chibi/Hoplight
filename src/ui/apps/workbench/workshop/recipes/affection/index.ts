/**
 * Starter pack: affection tracker.
 */
import type { WorkshopRecipe } from "../contract";

const recipe: WorkshopRecipe = {
  id: "affection",
  order: 20,
  title: "Affection tracker",
  blurb: "After a reply, if mood is warm, add to affection.",
  vars: [
    { name: "affection", value: "0" },
    { name: "mood", value: "neutral" },
  ],
  triggers: [
    {
      label: "warm mood raises affection",
      event: "output",
      conditions: [{ type: "var", var: "mood", operator: "=", value: "warm" }],
      effects: [{ type: "setvar", var: "affection", operator: "+=", value: "5" }],
    },
  ],
};

export default recipe;
