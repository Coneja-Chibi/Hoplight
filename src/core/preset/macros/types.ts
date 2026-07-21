/**
 * The shape of a platform's macro reference. One catalog per engine (folders-as-schema): a macro's
 * NAME, SYNTAX and MEANING all differ between engines, so a single catalog filtered per-lens cannot
 * be correct. See each platform file for its provenance.
 */
export interface MacroEntry {
  /** the token exactly as that engine parses it - separators matter ({{roll:1d6}} vs {{roll::2d6}}) */
  macro: string;
  description: string;
  example?: string;
  /**
   * Alternate names the engine resolves to this same macro ({{char}} = {{charName}}). Support
   * checks must honor these: an engine with heavy aliasing (Lumiverse aliases ~100 names) would
   * otherwise get false "unsupported" warnings on perfectly valid tokens.
   */
  aliases?: readonly string[];
}

export interface MacroGroup {
  name: string;
  description: string;
  macros: MacroEntry[];
}
