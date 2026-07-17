/**
 * CSS starter recipe contract. Folder recipes/<id>/index.ts default-exports one pack.
 */

export interface CssRecipe {
  /** folder name; must match recipes/<id>/ */
  id: string;
  title: string;
  blurb: string;
  /** plain CSS to merge into the document */
  css: string;
  /** which target packs this recipe is best for (empty = all) */
  packs?: readonly string[];
  order?: number;
}
