/**
 * Neon outline accents on cards and tags.
 */
import type { CssRecipe } from "../contract";

const recipe: CssRecipe = {
  id: "neon-outline",
  order: 40,
  title: "Neon outline",
  blurb: "Hot border glow on cards and tags.",
  packs: ["universal", "chub-card", "janitor-profile"],
  css: `/* neon outline */
.card, .chub-bubble, .jai-bot-card {
  border: 2px solid #c084fc;
  box-shadow: 0 0 0 1px rgba(192, 132, 252, 0.25), 0 0 18px rgba(192, 132, 252, 0.35);
  background: #100e16;
  color: #f3e8ff;
}

.tag, .jai-bot-tag {
  border: 1px solid #a78bfa;
  color: #e9d5ff;
  border-radius: 999px;
  padding: 2px 8px;
  background: rgba(88, 28, 135, 0.35);
}`,
};

export default recipe;
