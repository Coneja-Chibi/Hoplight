/**
 * Merged CSS-module class map for the lore binder. A class name lives in exactly ONE module;
 * leaves take a single `styles` prop so they stay file-layout-blind.
 */
import deskStyles from "../LorebookEditor.module.css";
import panelStyles from "./entry-panel.module.css";
import panelKeyStyles from "./entry-panel-keys.module.css";
import pageStyles from "./entry-page.module.css";
import whenWhereStyles from "./entry-when-where.module.css";
import positionPickerStyles from "./position-picker.module.css";
import tocStyles from "./entry-toc.module.css";
import tocItemStyles from "./entry-toc-item.module.css";
import tocModeStyles from "./entry-toc-mode.module.css";
import tocFineStyles from "./entry-toc-fine.module.css";
import folderTocStyles from "./folder-toc.module.css";
import railStyles from "./entry-rail.module.css";
import platformCardStyles from "./platforms/cards.module.css";
import novelAiBiasStyles from "./platforms/novelai-bias.module.css";
import healthStyles from "./health-pane.module.css";
import changesStyles from "./changes-pane.module.css";

export const binderStyles: Readonly<Record<string, string>> = {
  ...deskStyles,
  ...panelStyles,
  ...panelKeyStyles,
  ...pageStyles,
  ...whenWhereStyles,
  ...positionPickerStyles,
  ...tocStyles,
  ...tocItemStyles,
  ...tocModeStyles,
  ...tocFineStyles,
  ...folderTocStyles,
  ...railStyles,
  ...platformCardStyles,
  ...novelAiBiasStyles,
  ...healthStyles,
  ...changesStyles,
};
