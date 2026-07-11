/**
 * Merged CSS-module class map for the lore binder. A class name lives in exactly ONE module;
 * leaves take a single `styles` prop so they stay file-layout-blind.
 */
import deskStyles from "../LorebookEditor.module.css";
import panelStyles from "./entry-panel.module.css";
import panelKeyStyles from "./entry-panel-keys.module.css";
import pageStyles from "./entry-page.module.css";
import tocStyles from "./entry-toc.module.css";
import tocFineStyles from "./entry-toc-fine.module.css";
import railStyles from "./entry-rail.module.css";
import platformCardStyles from "./platforms/cards.module.css";
import healthStyles from "./health-pane.module.css";
import changesStyles from "./changes-pane.module.css";

export const binderStyles: Readonly<Record<string, string>> = {
  ...deskStyles,
  ...panelStyles,
  ...panelKeyStyles,
  ...pageStyles,
  ...tocStyles,
  ...tocFineStyles,
  ...railStyles,
  ...platformCardStyles,
  ...healthStyles,
  ...changesStyles,
};
