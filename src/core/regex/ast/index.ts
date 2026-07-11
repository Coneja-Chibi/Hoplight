/**
 * The regex AST keystone barrel (REGEX-JEWEL-PLAN.md Phase R2X). One import surface for the parser,
 * printer, and node types every later jewel (explain, examples, ReDoS lint, dialect tolerance)
 * builds on. The parent core/regex/index.ts wires this in during a later phase.
 */
export * from "./ast-types";
export { V_MODE_ENABLED, parseRegex, printRegex } from "./parser";
export type { ParseResult } from "./parser";
export { explainAst } from "./explain";
export type { PlainExplanation } from "./explain";
export { examplesFor } from "./examples";
export type { ExamplesOptions, ExamplesResult } from "./examples";
export { analyzeRedos } from "./redos";
export type { RedosFinding, RedosKind, RedosReport, RedosSeverity } from "./redos";
export { parseFlagTokens, tolerate } from "./dialect";
export type { ToleranceNote, ToleranceResult } from "./dialect";
