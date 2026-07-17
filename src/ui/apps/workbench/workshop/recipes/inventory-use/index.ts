/**
 * Starter pack: use an inventory item.
 */
import type { WorkshopRecipe } from "../contract";

const recipe: WorkshopRecipe = {
  id: "inventory-use",
  order: 40,
  title: "Use an inventory item",
  blurb: "After you send, if item is potion and stock is at least 1, subtract stock and heal hp.",
  vars: [
    { name: "item", value: "potion" },
    { name: "stock", value: "3" },
    { name: "hp", value: "50" },
  ],
  triggers: [
    {
      label: "use potion",
      event: "input",
      conditions: [
        { type: "var", var: "item", operator: "=", value: "potion" },
        { type: "var", var: "stock", operator: ">=", value: "1" },
      ],
      effects: [
        { type: "setvar", var: "stock", operator: "-=", value: "1" },
        { type: "setvar", var: "hp", operator: "+=", value: "15" },
      ],
    },
  ],
};

export default recipe;
