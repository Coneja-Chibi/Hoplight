/**
 * Import helpers for CSS Workshop: load a .css file and summarize parse breakdown.
 */
import { parseCss } from "./model";

export interface CssImportSummary {
  rules: number;
  freeform: boolean;
  bytes: number;
}

/** Read a File as UTF-8 text. */
export async function readCssFile(file: File): Promise<string> {
  return file.text();
}

/** Best-effort breakdown after import (same parser Assist uses). */
export function summarizeImport(css: string): CssImportSummary {
  const doc = parseCss(css);
  return {
    rules: doc.rules.length,
    freeform: doc.freeform.trim().length > 0,
    bytes: css.length,
  };
}

/** Accept list for file pickers. */
export const CSS_FILE_ACCEPT = ".css,text/css,text/plain";

/** True if the name looks like CSS we should open. */
export function looksLikeCssFile(name: string): boolean {
  const n = name.toLowerCase();
  return n.endsWith(".css") || n.endsWith(".txt") || n.endsWith(".scss");
}
