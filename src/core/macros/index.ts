/**
 * The closed-world macro interpreter (ADR-012; specs/engine/macro-engine.md).
 *
 * Permitted callers, per the ADR: the macro test bench (user-invoked), the transfer
 * compatibility report, and prompt assembly / preview. Codecs and adapters NEVER import this
 * package - macro text is opaque payload at every import and conversion boundary.
 */
export type {
  MacroContext,
  MacroVariable,
  MacroResult,
  MacroSideEffect,
  MacroError,
  MacroDefinition,
  MacroProcessResult,
  RenderSegment,
  LiteralSegment,
  MacroSegment,
  MacroSegmentDetail,
} from "./types";
export { parseMacroNodes, type ASTNode } from "./parse";
export { normalizeMacroText, toSource } from "./normalize";
export { getMacro, hasMacro, isVolatileMacro, getAllMacros } from "./registry";
export {
  processMacros,
  containsMacros,
  MAX_EVAL_DEPTH,
  MAX_OUTPUT_CHARS,
  MAX_EVAL_STEPS,
} from "./evaluate";
