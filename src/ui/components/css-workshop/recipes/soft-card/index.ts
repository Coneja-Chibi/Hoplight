/**
 * Soft card: rounded panel, quiet type, gentle shadow.
 */
import type { CssRecipe } from "../contract";

const recipe: CssRecipe = {
  id: "soft-card",
  order: 10,
  title: "Soft card",
  blurb: "Rounded panel, soft shadow, readable body type.",
  packs: ["universal", "chub-card"],
  css: `/* soft card */
.card, .chub-bubble {
  background: #1a1820;
  color: #e8e4ef;
  border-radius: 12px;
  padding: 12px 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  border: 1px solid #2e2a38;
}

.name, .chub-name {
  color: #f5f0ff;
  font-weight: 700;
  font-size: 1.05rem;
}

.body, .chub-text {
  color: #c9c2d6;
  font-size: 0.92rem;
  line-height: 1.45;
}`,
};

export default recipe;
