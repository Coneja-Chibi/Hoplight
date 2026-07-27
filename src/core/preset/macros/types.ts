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
  /**
   * The canonical operation this macro performs, when a name alone would mislead. This is the spoke
   * that connects a dialect to the hub in ./ops.ts: translation is source op to target op, never
   * engine to engine. Absent means "the name means what it says", which is true for most macros and
   * is why this stays optional. Annotate collisions and gaps, not everything.
   */
  op?: import("./ops").MacroOp;
}

export interface MacroGroup {
  name: string;
  description: string;
  macros: MacroEntry[];
}
