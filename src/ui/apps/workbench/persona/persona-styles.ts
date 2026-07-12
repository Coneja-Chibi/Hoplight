/**
 * Merged CSS-module class map for the persona editor (the regex-styles precedent). A class name
 * lives in exactly ONE module; components take the merged map so they stay file-layout-blind.
 */
import editorStyles from "./persona.module.css";
import starStyles from "./persona-star.module.css";
import railStyles from "./persona-rail.module.css";

export const personaStyles: Readonly<Record<string, string>> = {
  ...editorStyles,
  ...starStyles,
  ...railStyles,
};
