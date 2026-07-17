/**
 * Dark glass: translucent dark surface + blur.
 */
import type { CssRecipe } from "../contract";

const recipe: CssRecipe = {
  id: "dark-glass",
  order: 20,
  title: "Dark glass",
  blurb: "Frosted dark panel. Hosts may ignore backdrop-filter.",
  packs: ["universal", "chub-card", "risu-backdrop", "janitor-profile"],
  css: `/* dark glass */
.page, .chub-root, .risu-stage, .jai-page {
  background: radial-gradient(ellipse at top, #2a2040 0%, #0c0a12 70%);
}

.card, .chub-bubble, .risu-panel, .jai-profile-card, .jai-bot-card {
  background: rgba(18, 16, 28, 0.72);
  color: #efeaf8;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
}`,
};

export default recipe;
