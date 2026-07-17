/**
 * Starters pane: drop-in recipe cards with use this.
 */
import type { JSX } from "react";
import { listCssRecipes } from "./recipes/registry";
import styles from "./styles.module.css";

export interface CssStartersProps {
  packId: string;
  packBlurb: string;
  onApply(css: string): void;
}

/** Recipe list filtered by active target pack. */
export function CssStarters({ packId, packBlurb, onApply }: CssStartersProps): JSX.Element {
  const recipes = listCssRecipes(packId);
  return (
    <div className={styles.assist} data-tour="css-starters">
      <p className={styles.hint}>
        Drop a starter into your sheet, then tune it in Assist or Source. {packBlurb}
      </p>
      {recipes.map((r) => (
        <div className={styles.recipe} key={r.id}>
          <div className={styles.recipeHead}>
            <span className={styles.recipeTitle}>{r.title}</span>
            <button type="button" className={styles.useBtn} onClick={() => onApply(r.css)}>
              use this
            </button>
          </div>
          <p className={styles.blurb}>{r.blurb}</p>
        </div>
      ))}
    </div>
  );
}
