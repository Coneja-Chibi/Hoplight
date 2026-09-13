/**
 * The tree-walking evaluator (ADR-012; spec stage 2), with SEGMENT output.
 *
 * Beyond the reference behavior (short-circuit block-if, recursive re-expansion of macro-bearing
 * results, unknown-name literal passthrough, readOnly no-ops, depth cap), this evaluator also
 * reports the render as top-level SEGMENTS: each authored top-level node becomes one span of
 * output that knows its authored source range. That is what makes the preview editable - a
 * literal segment edit is a source splice, a macro segment carries its raw expression and (for
 * the choice family) which branch rolled.
 *
 * Bounds per ADR-012, all enforced during evaluation: depth 100, output ceiling, step budget.
 * Randomness is mulberry32 over context.randomSeed - never ambient.
 */
import { mulberry32 } from "../lore/rng";
import type {
  MacroContext,
  MacroError,
  MacroProcessResult,
  MacroSegmentDetail,
  MacroSideEffect,
  MacroVariable,
  RenderSegment,
} from "./types";
import type { ASTNode, BlockIfNode, MacroCallNode } from "./parse";
import { parseMacroNodes } from "./parse";
import { normalizeMacroText, restoreEscapedBraces, toSource } from "./normalize";
import { getMacro } from "./registry";
import { choiceOptions, compareTexts, isTruthyText, readVar, writeVar } from "./handlers";

export const MAX_EVAL_DEPTH = 100;
export const MAX_OUTPUT_CHARS = 1_000_000;
export const MAX_EVAL_STEPS = 200_000;

interface EvalState {
  errors: MacroError[];
  sideEffects: MacroSideEffect[];
  touched: Set<string>;
  volatileHit: boolean;
  steps: number;
  outputChars: number;
  overBudget: boolean;
  random: () => number;
  /** which way each block-if went, for segment detail */
  branchTaken: WeakMap<BlockIfNode, "then" | "else">;
}

class RecordingMap extends Map<string, MacroVariable> {
  constructor(
    private readonly backing: Map<string, MacroVariable>,
    private readonly scope: "local" | "global",
    private readonly touched: Set<string>,
  ) {
    super();
  }
  override get(key: string): MacroVariable | undefined {
    this.touched.add(`${this.scope}:${key}`);
    return this.backing.get(key);
  }
  override has(key: string): boolean {
    this.touched.add(`${this.scope}:${key}`);
    return this.backing.has(key);
  }
  override set(key: string, value: MacroVariable): this {
    this.backing.set(key, value);
    return this;
  }
  override delete(key: string): boolean {
    return this.backing.delete(key);
  }
}

const budgeted = (state: EvalState, text: string): string => {
  if (state.outputChars >= MAX_OUTPUT_CHARS) {
    if (!state.overBudget) {
      state.overBudget = true;
      state.errors.push({ macro: "", message: `output ceiling of ${MAX_OUTPUT_CHARS} chars hit; truncated` });
    }
    return "";
  }
  const room = MAX_OUTPUT_CHARS - state.outputChars;
  const kept = text.length > room ? text.slice(0, room) : text;
  if (kept.length < text.length && !state.overBudget) {
    state.overBudget = true;
    state.errors.push({ macro: "", message: `output ceiling of ${MAX_OUTPUT_CHARS} chars hit; truncated` });
  }
  state.outputChars += kept.length;
  return kept;
};

/** Bare `.name` / `$name` inside a condition string resolve to variable values (edge case 19). */
const resolveConditionShorthands = (cond: string, context: MacroContext): string =>
  cond
    .replace(/(^|[\s(!])\.([A-Za-z_][A-Za-z0-9_:]*)/g, (_m, pre: string, name: string) => pre + readVar(context, name))
    .replace(/(^|[\s(!])\$([A-Za-z_][A-Za-z0-9_]*)/g, (_m, pre: string, name: string) => pre + readVar(context, `global:${name}`));

const evaluateBlockCondition = (cond: string, context: MacroContext): boolean => {
  const resolved = resolveConditionShorthands(cond, context).trim();
  const cmp = /^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/.exec(resolved);
  if (cmp) return compareTexts((cmp[1] ?? "").trim(), cmp[2] ?? "==", (cmp[3] ?? "").trim());
  if (resolved.startsWith("!")) return !isTruthyText(resolved.slice(1));
  return isTruthyText(resolved);
};

function evaluateNodes(nodes: ASTNode[], depth: number, state: EvalState, context: MacroContext): string {
  if (depth > MAX_EVAL_DEPTH) return "";
  let out = "";
  for (const node of nodes) {
    if (++state.steps > MAX_EVAL_STEPS) {
      if (!state.overBudget) {
        state.overBudget = true;
        state.errors.push({ macro: "", message: `evaluation step budget of ${MAX_EVAL_STEPS} hit; truncated` });
      }
      return out;
    }
    switch (node.type) {
      case "text":
        out += budgeted(state, node.value);
        break;
      case "macro":
        out += budgeted(state, evaluateMacroNode(node, depth, state, context));
        break;
      case "blockIf": {
        const condText = evaluateNodes(node.condition, depth + 1, state, context);
        const taken = evaluateBlockCondition(condText, context);
        state.branchTaken.set(node, taken ? "then" : "else");
        out += evaluateNodes(taken ? node.thenBranch : node.elseBranch, depth + 1, state, context);
        break;
      }
      case "blockSetvar": {
        const name = evaluateNodes(node.varName, depth + 1, state, context).trim();
        const value = evaluateNodes(node.content, depth + 1, state, context).trim();
        if (name !== "" && !context.readOnly) {
          const key = node.scope === "global" && !name.includes(":") ? `global:${name}` : name;
          const result = writeVar(context, key, value);
          if (result.sideEffects) state.sideEffects.push(...result.sideEffects);
        }
        break;
      }
      case "blockTrim":
        out += budgeted(state, evaluateNodes(node.content, depth + 1, state, context).trim());
        break;
    }
  }
  return out;
}

function evaluateMacroNode(node: MacroCallNode, depth: number, state: EvalState, context: MacroContext): string {
  const args = node.args.map((arg) => evaluateNodes(arg, depth + 1, state, context).trim());
  const def = getMacro(node.name);
  if (!def) {
    // Unknown name: reconstruct the tag from its evaluated args as literal output (edge case 10).
    state.errors.push({ macro: node.name, message: `unknown macro: ${node.name}` });
    return `{{${[node.name, ...args].join("::")}}}`;
  }
  if (def.volatile) state.volatileHit = true;
  let result;
  try {
    result = def.handler(args, context, { random: state.random });
  } catch (error) {
    result = { value: "", success: false, error: error instanceof Error ? error.message : "handler failed" };
  }
  if (!result.success) {
    state.errors.push({ macro: node.name, message: result.error ?? `macro failed: ${node.name}` });
  }
  if (result.sideEffects) state.sideEffects.push(...result.sideEffects);
  // A result carrying macro text expands recursively, one depth level down (edge case 16).
  // The inner walk's appends charge the output budget and the caller charges the returned text
  // again - deliberate fail-closed over-counting, never under-counting.
  if (result.value.includes("{{")) {
    return evaluateNodes(parseMacroNodes(result.value), depth + 1, state, context);
  }
  return result.value;
}

/** Trim-marker collapse and newline squashing (spec stage 9), then sentinel restore (stage 10). */
const postprocess = (text: string): string =>
  restoreEscapedBraces(
    text
      .replace(/[^\S\n]*\x04[^\S\n]*/g, "")
      .replace(/\n\s*\x04\s*\n?/g, "\n")
      .replace(/\x04/g, "")
      .replace(/\n{3,}/g, "\n\n"),
  );

const segmentDetail = (node: ASTNode, value: string, state: EvalState): MacroSegmentDetail | undefined => {
  if (node.type === "blockIf") {
    const taken = state.branchTaken.get(node);
    return taken ? { kind: "branch", taken } : undefined;
  }
  if (node.type === "macro" && (node.name === "random" || node.name === "pick")) {
    // Options from the args' literal text; a macro-bearing option won't match and detail is
    // simply omitted (the segment still renders and still carries its raw expression).
    const rawArgs = node.args.map((arg) =>
      arg.map((n) => (n.type === "text" ? n.value : "")).join("").trim(),
    );
    const options = choiceOptions(rawArgs);
    const chosenIndex = options.indexOf(value);
    if (options.length > 0 && chosenIndex !== -1) return { kind: "choice", options, chosenIndex };
  }
  return undefined;
};

/**
 * Run one template: normalized, parsed, evaluated to flat text AND top-level segments whose
 * offsets point into the AUTHORED source. Deterministic for a fixed context + randomSeed.
 */
export function processMacros(source: string, context: MacroContext): MacroProcessResult {
  const touched = new Set<string>();
  const recording: MacroContext = {
    ...context,
    localVariables: new RecordingMap(context.localVariables, "local", touched),
    globalVariables: new RecordingMap(context.globalVariables, "global", touched),
  };
  const state: EvalState = {
    errors: [],
    sideEffects: [],
    touched,
    volatileHit: false,
    steps: 0,
    outputChars: 0,
    overBudget: false,
    random: mulberry32(context.randomSeed ?? 1),
    branchTaken: new WeakMap(),
  };

  const normalized = normalizeMacroText(source);
  const nodes = parseMacroNodes(normalized.text);

  // Segments are PROVENANCE, not a partition of `text`: the flat render is postprocessed once as
  // a whole, so joining segment values is not guaranteed to reproduce it (a trim marker or a
  // newline run can span a boundary). What IS guaranteed, and what the editable preview stands
  // on: a literal segment's `value` is the authored source slice VERBATIM (escaped braces and
  // all), so splicing an edited value into [sourceStart, sourceEnd) can never corrupt the source.
  const segments: RenderSegment[] = [];
  let flat = "";
  for (const node of nodes) {
    const value = evaluateNodes([node], 0, state, recording);
    flat += value;
    const span = toSource(normalized, node.start, node.end);
    if (node.type === "text") {
      segments.push({
        kind: "literal",
        value: source.slice(span.start, span.end),
        sourceStart: span.start,
        sourceEnd: span.end,
      });
    } else {
      const name = node.type === "macro" ? node.name : node.type;
      segments.push({
        kind: "macro",
        name,
        value: postprocess(value),
        raw: source.slice(span.start, span.end),
        sourceStart: span.start,
        sourceEnd: span.end,
        detail: segmentDetail(node, value, state),
      });
    }
  }

  return {
    text: postprocess(flat),
    segments,
    errors: state.errors,
    sideEffects: state.sideEffects,
    touchedVariables: [...touched],
    cacheable: !state.volatileHit && state.sideEffects.length === 0,
  };
}

export const containsMacros = (text: string): boolean =>
  /\{\{|<(user|char|bot)>/i.test(text);
