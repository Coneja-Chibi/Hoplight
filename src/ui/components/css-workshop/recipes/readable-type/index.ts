/**
 * Type-first readability pass.
 */
import type { CssRecipe } from "../contract";

const recipe: CssRecipe = {
  id: "readable-type",
  order: 50,
  title: "Readable type",
  blurb: "Clear sizes, contrast, and line height. Aesthetic second.",
  packs: ["universal", "chub-card", "risu-backdrop", "janitor-profile"],
  css: `/* readable type */
.name, .chub-name, .jai-username, .jai-bot-name, .risu-title {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.15rem;
  font-weight: 700;
  color: #faf7ff;
  letter-spacing: 0.01em;
}

.body, .chub-text, .jai-bot-preview, .risu-body {
  font-family: system-ui, -apple-system, Segoe UI, sans-serif;
  font-size: 0.95rem;
  line-height: 1.55;
  color: #d6d0e2;
}`,
};

export default recipe;
