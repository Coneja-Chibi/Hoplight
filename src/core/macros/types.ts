/**
 * The macro engine's shared types (ADR-012; specs/engine/macro-engine.md).
 *
 * The context is deliberately value-only: no filesystem, network, process, clock, or DB handle
 * ever rides on it (ADR-012 "No host surface on MacroContext"). Determinism comes from
 * `randomSeed`; a caller that wants reproducible output pins it, a caller that wants a fresh roll
 * passes a fresh seed. Handlers receive randomness through the evaluator's run state, never from
 * ambient `Math.random`.
 */

export interface MacroVariable {
  value: string;
  createdAt: number;
  updatedAt: number;
}

/** Value-only context. Bucket-2 assembly fields arrive later with the Test Stage. */
export interface MacroContext {
  characterName: string;
  userName: string;
  characterDescription?: string;
  characterPersonality?: string;
  scenario?: string;
  modelName?: string;
  characterId?: string;
  localVariables: Map<string, MacroVariable>;
  globalVariables: Map<string, MacroVariable>;
  /** Seed for the volatile family; the same seed replays the same rolls. */
  randomSeed?: number;
  /**
   * The clock, AS A VALUE (epoch ms). The engine never reads system time itself (ADR-012);
   * the caller supplies it - the UI passes Date.now(), a test pins it. Absent -> time macros
   * resolve to "" rather than inventing a moment.
   */
  now?: number;
  /** BCP-47 locale and IANA time zone for time formatting; explicit defaults keep tests stable. */
  locale?: string;
  timezone?: string;
  /**
   * Bucket-2 fields (spec "evaluation-scope contract"): populated by an assembly/preview caller,
   * absent otherwise - chat macros resolve to their empty defaults, never an error.
   */
  messages?: readonly ChatStubMessage[];
  currentMessage?: string;
  chatId?: string;
  /** Side-effect macros become no-ops; reads are unaffected. */
  readOnly?: boolean;
}

export interface ChatStubMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface MacroSideEffect {
  type: "setLocalVar" | "setGlobalVar" | "deleteLocalVar" | "deleteGlobalVar";
  key: string;
  value?: string;
}

export interface MacroResult {
  value: string;
  success: boolean;
  error?: string;
  sideEffects?: MacroSideEffect[];
}

/** What the evaluator hands a handler beyond its args: seeded randomness, nothing ambient. */
export interface HandlerRun {
  random(): number;
}

export type MacroHandler = (args: string[], context: MacroContext, run: HandlerRun) => MacroResult;

export type MacroCategory =
  | "identity"
  | "random"
  | "variables"
  | "conditional"
  | "text"
  | "comment"
  | "time"
  | "chat";

export interface MacroDefinition {
  name: string;
  aliases?: string[];
  description: string;
  category: MacroCategory;
  handler: MacroHandler;
  hasSideEffects?: boolean;
  volatile?: boolean;
}

export interface MacroError {
  macro: string;
  message: string;
}

/**
 * One span of the rendered output, tied back to the AUTHORED text it came from.
 *
 * This is the type the editable preview stands on: `sourceStart`/`sourceEnd` are offsets into the
 * original (pre-normalization) template, so an edit to a literal segment is a plain splice of the
 * source, and a macro segment exposes its raw source expression for structural editing.
 */
export type RenderSegment = LiteralSegment | MacroSegment;

export interface LiteralSegment {
  kind: "literal";
  /**
   * The AUTHORED source slice, verbatim - escaped braces unrestored, newline runs uncollapsed.
   * This is what makes an edit a safe splice; the flat `text` is where the rendered view lives.
   */
  value: string;
  sourceStart: number;
  sourceEnd: number;
}

export interface MacroSegment {
  kind: "macro";
  /** the macro/block's resolved output */
  value: string;
  /** the authored source slice, macro syntax and all */
  raw: string;
  name: string;
  sourceStart: number;
  sourceEnd: number;
  /** volatile choices, for reroll/branch editing in the preview */
  detail?: MacroSegmentDetail;
}

export type MacroSegmentDetail =
  | { kind: "choice"; options: string[]; chosenIndex: number }
  | { kind: "branch"; taken: "then" | "else" };

export interface MacroProcessResult {
  text: string;
  segments: RenderSegment[];
  errors: MacroError[];
  sideEffects: MacroSideEffect[];
  /** "local:x" / "global:y" read fingerprint */
  touchedVariables: string[];
  /** false once a volatile macro fired or a side effect landed */
  cacheable: boolean;
}
