/**
 * Flat solid surfaces (common JAI "no gradient" ask).
 */
import type { CssRecipe } from "../contract";

const recipe: CssRecipe = {
  id: "no-gradient",
  order: 30,
  title: "Flat solids",
  blurb: "Kill fancy fills. Solid backgrounds only.",
  packs: ["universal", "janitor-profile", "chub-card"],
  css: `/* flat solids */
.card, .jai-profile-card, .jai-bot-card, .chub-bubble {
  background: #141218 !important;
  background-image: none !important;
  border-radius: 8px;
  border: 1px solid #3a3545;
  color: #ece8f4;
}`,
};

export default recipe;
