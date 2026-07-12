/**
 * Merged CSS-module class map for the regex set editor. A class name lives in exactly ONE module;
 * the leaves (rule-toc, rule-page, phase-picker, fine-print, rule-rail) take a single `styles` prop
 * so they stay file-layout-blind, exactly like the lore binder's binder-styles.
 */
import editorStyles from "./set-editor.module.css";
import tocStyles from "./rule-toc.module.css";
import pageStyles from "./rule-page.module.css";
import phaseStyles from "./phase-picker.module.css";
import fineStyles from "./fine-print.module.css";
import railStyles from "./rule-rail.module.css";
import wordsStyles from "./mode-words.module.css";
import guidedStyles from "./mode-guided.module.css";

export const regexStyles: Readonly<Record<string, string>> = {
  ...editorStyles,
  ...tocStyles,
  ...pageStyles,
  ...phaseStyles,
  ...fineStyles,
  ...railStyles,
  ...wordsStyles,
  ...guidedStyles,
};
