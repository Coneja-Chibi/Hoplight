/** The shared terminal scene-break mark used by Markdown rules and later transcript transitions. */
export const sceneSeam = (width = 40): string => "─".repeat(Math.max(1, width));
