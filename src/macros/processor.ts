// ============================================================================
// MACRO PROCESSOR
// Core engine for parsing and expanding macros with nested support
// Uses a single-pass recursive descent parser + tree-walking evaluator
// ============================================================================

import {
  MacroContext,
  MacroProcessResult,
  MacroExpansion,
  MacroError,
  MacroSideEffect,
  MacroResult,
  MacroInterceptor,
  MacroVariable,
  LazyMacroArg,
  LazyMacroHandler,
} from './types';
import { getMacro, getMacroHandler, isVolatileMacro } from './registry';
import { parseNodesV2 } from './tokenizer';

// ============================================================================
// AST NODE TYPES (internal)
// ============================================================================

interface TextNode {
  type: 'text';
  value: string;
}

interface MacroCallNode {
  type: 'macro';
  name: string;
  rawContent: string;
  args: ASTNode[][];
}

interface BlockIfNode {
  type: 'blockIf';
  condition: ASTNode[];
  thenBranch: ASTNode[];
  elseBranch: ASTNode[];
}

interface BlockSetvarNode {
  type: 'blockSetvar';
  varName: ASTNode[];
  scope: 'local' | 'global';
  content: ASTNode[];
}

interface BlockTrimNode {
  type: 'blockTrim';
  content: ASTNode[];
}

type ASTNode = TextNode | MacroCallNode | BlockIfNode | BlockSetvarNode | BlockTrimNode;

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_EVAL_DEPTH = 100;

// ============================================================================
// EXPORTS (unchanged API surface)
// ============================================================================

/**
 * Check if text contains any unexpanded macros
 */
export function containsMacros(text: string): boolean {
  return /\{\{(?:[^{}]|\{(?!\{)|\}(?!\}))+\}\}/.test(text);
}

/**
 * Parse a macro string into name and arguments
 */
export function parseMacro(macroContent: string): { name: string; args: string[] } {
  const trimmed = macroContent.trim();

  if (trimmed.startsWith('//')) {
    return { name: '//', args: [trimmed.slice(2).trim()] };
  }

  const parts = trimmed.split('::');
  const name = parts[0].trim().toLowerCase();
  const args = parts.slice(1).map(arg => arg.trim());

  return { name, args };
}

// ============================================================================
// PREPROCESSING: Dot-Notation Variable Shorthand
// ============================================================================

function preprocessDotNotation(text: string): string {
  let result = text;

  result = result.replace(/\{\{\.([\w]+)\+\+\s*\}\}/g, '{{incvar::$1}}');
  result = result.replace(/\{\{\.([\w]+)--\s*\}\}/g, '{{decvar::$1}}');
  result = result.replace(/\{\{\.([\w]+)\s*\+=\s*(.+?)\s*\}\}/g, '{{addvar::$1::$2}}');
  result = result.replace(
    /\{\{\.([\w]+)\s*-=\s*(.+?)\s*\}\}/g,
    (_, name, val) => `{{addvar::${name}::-${val.trim()}}}`
  );
  result = result.replace(
    /\{\{\.([\w]+)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+?)\s*\}\}/g,
    '{{compare::{{getvar::$1}}::$2::$3}}'
  );
  result = result.replace(
    /\{\{\.([\w]+)\s*=(?!=)\s*(.+?)\s*\}\}/g,
    '{{setvar::$1::$2}}'
  );
  result = result.replace(/\{\{\.([\w]+)\s*\}\}/g, '{{getvar::$1}}');
  // Match {{$name}} but NOT {{$1}}, {{$2}} etc. (pure digits reserved for positional macro args)
  result = result.replace(/\{\{\$([a-zA-Z_][\w]*)\s*\}\}/g, '{{getglobalvar::$1}}');

  return result;
}

// ============================================================================
// PREPROCESSING: Space-Separated Syntax Normalization
// ============================================================================

function normalizeSpaceSyntax(text: string): string {
  let result = text.replace(
    /\{\{(roll|dice|incvar|decvar|getvar|var|hasvar|delvar|incglobalvar|decglobalvar|getglobalvar|globalvar|gvar|incgvar|decgvar)\s+(\S+?)\s*\}\}/gi,
    '{{$1::$2}}'
  );

  result = result.replace(
    /\{\{(setvar|addvar|setglobalvar|addglobalvar|setgvar|addgvar)\s+(\S+?)\s+(.+?)\s*\}\}/gi,
    '{{$1::$2::$3}}'
  );

  return result;
}

/**
 * Full sugar-normalization pass applied before parsing. Runs at the top level
 * AND on every macro expansion value before it is re-parsed (see evaluate
 * re-parse sites), so text reached through one macro's output — e.g. a card
 * field surfaced via {{scenario}} — normalizes identically to text written at
 * the top level. Without this, dot-notation nested in an expansion (like
 * {{switch::{{.x}}::...}}) never became {{getvar::x}} and the switch matched
 * nothing (VVS-609).
 */
function preprocessSyntax(text: string): string {
  // Escaped braces (\{\{ … \}\}) become sentinels so they survive parsing and
  // evaluation, then are restored as literal braces at the end of processMacros.
  let result = hideEscapedBraces(text);
  // Legacy angle tokens from imported ST/forum-era cards: <user>, <char>, <bot>
  result = result.replace(/<(user|char|bot)>/gi, (_m, name: string) =>
    name.toLowerCase() === 'user' ? '{{user}}' : '{{char}}');
  result = preprocessDotNotation(result);
  result = normalizeSpaceSyntax(result);

  // Normalize single-colon formats to double-colon. Covers the random/roll
  // family plus the variable family — imported presets from platforms with
  // a tolerant separator grammar write {{roll:1d50}} / {{getvar:x}} /
  // {{setvar:x:5}} interchangeably with the :: form. Canonical :: content
  // never matches (the (?!:) guard requires a SINGLE colon after the name).
  result = result.replace(
    /\{\{(random|rand|pick|choose|select|roll|dice|getvar|var|setvar|addvar|incvar|decvar|hasvar|delvar|getglobalvar|setglobalvar|addglobalvar|incglobalvar|decglobalvar|globalvar|gvar|setgvar|addgvar|incgvar|decgvar)\s?:(?!:)([^{}]*)\}\}/gi,
    (_m, name, rest) => `{{${name}::${rest.split(/(?<!:):(?!:)/).join('::')}}}`
  );

  return result;
}

// ============================================================================
// PARSER: Bracket-depth matching
// ============================================================================

/**
 * Split macro content on `::` at depth 0 only (not inside nested `{{}}`).
 */
function splitMacroArgs(content: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < content.length; i++) {
    if (content[i] === '{' && i + 1 < content.length && content[i + 1] === '{') {
      depth++;
      current += '{{';
      i++;
    } else if (content[i] === '}' && i + 1 < content.length && content[i + 1] === '}') {
      depth--;
      current += '}}';
      i++;
    } else if (content[i] === ':' && i + 1 < content.length && content[i + 1] === ':' && depth === 0) {
      parts.push(current);
      current = '';
      i++;
    } else {
      current += content[i];
    }
  }
  parts.push(current);
  return parts;
}

// ============================================================================
// PARSER: AST cache
// ============================================================================

// LRU cache for parsed ASTs. Preset blocks, lorebook entries, and structural
// prompts are re-processed on every generation with identical template text —
// only the variable state changes — so re-parsing them each time is pure
// waste. Evaluation never mutates AST nodes (handlers receive evaluated arg
// strings; side effects go to the context's variable maps), so cached node
// trees are safe to share across evaluations.
const AST_CACHE_MAX = 256;
const astCache = new Map<string, ASTNode[]>();

function parseNodesCached(text: string): ASTNode[] {
  const cached = astCache.get(text);
  if (cached) {
    // Promote to most-recently-used (Map preserves insertion order)
    astCache.delete(text);
    astCache.set(text, cached);
    return cached;
  }
  const nodes = parseNodes(text);
  if (astCache.size >= AST_CACHE_MAX) {
    const oldest = astCache.keys().next().value;
    if (oldest !== undefined) astCache.delete(oldest);
  }
  astCache.set(text, nodes);
  return nodes;
}

// ============================================================================
// PARSER: Main recursive descent parser
// ============================================================================

/**
 * Parse text into a list of AST nodes.
 *
 * As of the clean-room tokenizer swap, this is a thin delegator to
 * `parseNodesV2` (src/lib/macros/tokenizer.ts) — a lexer→parser pipeline proven
 * byte-identical to the legacy recursive-descent parser across the full
 * characterization corpus + adversarial differential. Routing through this one
 * function covers every parse call site: `parseNodesCached`, the eval-time
 * re-parse of expansions, and all block sub-body parses.
 *
 * The legacy recursive-descent implementation has been removed now that the
 * tokenizer has shipped clean.
 */
function parseNodes(text: string): ASTNode[] {
  return parseNodesV2(text);
}

// ============================================================================
// EVALUATOR: Tree-walking evaluation
// ============================================================================

interface EvalState {
  expansions: MacroExpansion[];
  errors: MacroError[];
  sideEffects: MacroSideEffect[];
  expansionCounter: number;
  /** "scope:name" keys of variables read during evaluation (fingerprint) */
  touchedVariables: Set<string>;
  /** True once any nondeterministic macro ran — result must not be cached */
  volatileHit: boolean;
}

// ============================================================================
// ESCAPED BRACES
// ============================================================================

// Sentinel characters (unused control codes) standing in for escaped braces
// between preprocessing and post-processing.
const ESCAPED_OPEN_SENTINEL = '\x01';
const ESCAPED_CLOSE_SENTINEL = '\x02';

function hideEscapedBraces(text: string): string {
  if (text.indexOf('\\{') === -1 && text.indexOf('\\}') === -1) return text;
  return text.replace(/\\\{\\\{|\\\{\{/g, ESCAPED_OPEN_SENTINEL + ESCAPED_OPEN_SENTINEL)
             .replace(/\\\}\\\}|\\\}\}/g, ESCAPED_CLOSE_SENTINEL + ESCAPED_CLOSE_SENTINEL);
}

function restoreEscapedBraces(text: string): string {
  return text.replaceAll(ESCAPED_OPEN_SENTINEL, '{').replaceAll(ESCAPED_CLOSE_SENTINEL, '}');
}

// ============================================================================
// INTERCEPTORS
// ============================================================================

const interceptors = new Map<string, MacroInterceptor>();

/**
 * Register a processing interceptor. 'pre' hooks run on the raw template
 * before any preprocessing; 'post' hooks run on the final expanded text.
 * Registering an existing id replaces it.
 */
export function registerMacroInterceptor(interceptor: MacroInterceptor): void {
  interceptors.set(interceptor.id, interceptor);
}

export function unregisterMacroInterceptor(id: string): void {
  interceptors.delete(id);
}

/** Test/teardown helper. */
export function clearMacroInterceptors(): void {
  interceptors.clear();
}

function runInterceptors(phase: 'pre' | 'post', text: string, context: MacroContext): string {
  if (interceptors.size === 0) return text;
  let current = text;
  for (const interceptor of interceptors.values()) {
    if (interceptor.phase !== phase) continue;
    try {
      current = interceptor.fn(current, context);
    } catch (err) {
      console.error(`[macros] Interceptor "${interceptor.id}" (${phase}) threw:`, err);
    }
  }
  return current;
}

// ============================================================================
// VARIABLE-READ RECORDING (result fingerprint)
// ============================================================================

/**
 * Wrap a variable map so reads (get/has) record "scope:name" into the sink.
 * All other operations (including writes) pass through to the original map.
 */
function makeRecordingVarMap(
  map: Map<string, MacroVariable>,
  scope: 'local' | 'global',
  sink: Set<string>,
): Map<string, MacroVariable> {
  return new Proxy(map, {
    get(target, prop, receiver) {
      if (prop === 'get') {
        return (key: string) => { sink.add(`${scope}:${key}`); return target.get(key); };
      }
      if (prop === 'has') {
        return (key: string) => { sink.add(`${scope}:${key}`); return target.has(key); };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * Evaluate a list of AST nodes, producing text output and collecting side effects.
 */
function evaluateNodes(
  nodes: ASTNode[],
  context: MacroContext,
  state: EvalState,
  depth: number
): string {
  if (depth > MAX_EVAL_DEPTH) {
    return '';
  }

  let result = '';

  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        result += node.value;
        break;

      case 'macro':
        result += evaluateMacroNode(node, context, state, depth);
        break;

      case 'blockIf':
        result += evaluateBlockIfNode(node, context, state, depth);
        break;

      case 'blockSetvar':
        evaluateBlockSetvarNode(node, context, state, depth);
        break;

      case 'blockTrim':
        result += evaluateNodes(node.content, context, state, depth + 1).trim();
        break;
    }
  }

  return result;
}

/**
 * Evaluate an inline macro node.
 */
function evaluateMacroNode(
  node: MacroCallNode,
  context: MacroContext,
  state: EvalState,
  depth: number
): string {
  // Lazy macros receive unevaluated args (raw text + evaluate-on-demand)
  // so they can skip, repeat, or substitute into their arguments before
  // expansion. Everything else gets the eager depth-first path below.
  const definition = getMacro(node.name);
  if (definition?.lazyHandler) {
    return evaluateLazyMacroNode(node, definition.lazyHandler, context, state, depth);
  }

  // Evaluate all arguments first (depth-first)
  // Trim each arg to match old parseMacro behavior (which called .trim() on every arg)
  const evaluatedArgs: string[] = [];
  for (const argNodes of node.args) {
    evaluatedArgs.push(evaluateNodes(argNodes, context, state, depth + 1).trim());
  }

  // Call the handler
  const macroResult = expandSingleMacro(node.name, evaluatedArgs, context);
  const currentDepth = state.expansionCounter++;

  // Fingerprint: nondeterministic macros poison result cacheability
  if (!state.volatileHit && isVolatileMacro(node.name)) {
    state.volatileHit = true;
  }

  if (macroResult.success) {
    const originalText = reconstructMacro(node.name, node.args, evaluatedArgs);

    state.expansions.push({
      original: originalText,
      expanded: macroResult.value,
      macroName: node.name,
      depth: currentDepth,
    });

    if (macroResult.sideEffects) {
      const annotated = macroResult.sideEffects.map(fx => fx.cause ? fx : { ...fx, cause: node.name });
      state.sideEffects.push(...annotated);
      applyImmediateSideEffects(annotated, context);
    }

    // If the expansion itself contains macros, re-parse and evaluate
    if (containsMacros(macroResult.value)) {
      // Re-parse the expansion through the SAME sugar normalization the top
      // level gets, or dot/space/single-colon syntaxes surfaced via a macro's
      // output (e.g. a card field through {{scenario}}) never canonicalize and
      // silently fail — notably dot-vars nested in {{switch}}/{{if}} (VVS-609).
      const subNodes = parseNodes(preprocessSyntax(macroResult.value));
      return evaluateNodes(subNodes, context, state, depth + 1);
    }

    return macroResult.value;
  } else {
    // Unknown macro — reconstruct with evaluated args, record error
    const reconstructed = reconstructMacroText(node.name, evaluatedArgs);

    state.errors.push({
      macro: reconstructed,
      message: macroResult.error || 'Unknown error',
    });

    return reconstructed;
  }
}

/**
 * Evaluate a macro node through its lazy handler. Args are handed over
 * unevaluated: raw source text plus an evaluate() thunk that expands the
 * arg's AST on demand without trimming. The handler's returned value is
 * re-parsed for macros like any other expansion, so handlers may return
 * (substituted copies of) raw arg text.
 */
function evaluateLazyMacroNode(
  node: MacroCallNode,
  lazyHandler: LazyMacroHandler,
  context: MacroContext,
  state: EvalState,
  depth: number
): string {
  // Per-arg raw source: re-split rawContent the same way the parser did.
  const rawParts = splitMacroArgs(node.rawContent).slice(1);

  const lazyArgs: LazyMacroArg[] = node.args.map((argNodes, i) => ({
    raw: rawParts[i] ?? '',
    evaluate: () => evaluateNodes(argNodes, context, state, depth + 1),
  }));

  let macroResult: MacroResult;
  try {
    macroResult = lazyHandler(lazyArgs, context);
  } catch (error) {
    macroResult = {
      value: '',
      success: false,
      error: error instanceof Error ? error.message : 'Macro handler threw an exception',
    };
  }

  const currentDepth = state.expansionCounter++;

  if (!state.volatileHit && isVolatileMacro(node.name)) {
    state.volatileHit = true;
  }

  if (macroResult.success) {
    state.expansions.push({
      original: `{{${node.rawContent}}}`,
      expanded: macroResult.value,
      macroName: node.name,
      depth: currentDepth,
    });

    if (macroResult.sideEffects) {
      const annotated = macroResult.sideEffects.map(fx => fx.cause ? fx : { ...fx, cause: node.name });
      state.sideEffects.push(...annotated);
      applyImmediateSideEffects(annotated, context);
    }

    if (containsMacros(macroResult.value)) {
      // Re-parse the expansion through the SAME sugar normalization the top
      // level gets, or dot/space/single-colon syntaxes surfaced via a macro's
      // output (e.g. a card field through {{scenario}}) never canonicalize and
      // silently fail — notably dot-vars nested in {{switch}}/{{if}} (VVS-609).
      const subNodes = parseNodes(preprocessSyntax(macroResult.value));
      return evaluateNodes(subNodes, context, state, depth + 1);
    }

    return macroResult.value;
  } else {
    state.errors.push({
      macro: `{{${node.rawContent}}}`,
      message: macroResult.error || 'Unknown error',
    });
    return `{{${node.rawContent}}}`;
  }
}

/**
 * Evaluate a block-if node with short-circuit semantics.
 */
function evaluateBlockIfNode(
  node: BlockIfNode,
  context: MacroContext,
  state: EvalState,
  depth: number
): string {
  // Evaluate the condition
  const condText = evaluateNodes(node.condition, context, state, depth + 1);
  const isTruthy = evaluateBlockCondition(resolveConditionShorthands(condText, context));

  // Short-circuit: only evaluate the taken branch
  if (isTruthy) {
    return evaluateNodes(node.thenBranch, context, state, depth + 1);
  } else {
    return evaluateNodes(node.elseBranch, context, state, depth + 1);
  }
}

/**
 * Evaluate a block-setvar node.
 */
function evaluateBlockSetvarNode(
  node: BlockSetvarNode,
  context: MacroContext,
  state: EvalState,
  depth: number
): void {
  const varName = evaluateNodes(node.varName, context, state, depth + 1).trim();
  const content = evaluateNodes(node.content, context, state, depth + 1).trim();

  if (!varName) return;
  if (context.readOnly) return;

  const varMap = node.scope === 'global' ? context.globalVariables : context.localVariables;
  const effectType = node.scope === 'global' ? 'setGlobalVar' as const : 'setLocalVar' as const;

  varMap.set(varName, {
    value: content,
    createdAt: varMap.get(varName)?.createdAt || new Date(),
    updatedAt: new Date(),
  });

  const effect: MacroSideEffect = {
    type: effectType,
    key: varName,
    value: content,
    cause: node.scope === 'global' ? 'setglobalvar' : 'setvar',
  };
  state.sideEffects.push(effect);
}

/**
 * Reconstruct original macro text for expansion tracking.
 */
function reconstructMacro(name: string, argNodes: ASTNode[][], evaluatedArgs: string[]): string {
  if (argNodes.length === 0) return `{{${name}}}`;
  return `{{${name}::${evaluatedArgs.join('::')}}}`;
}

/**
 * Reconstruct macro text from name and evaluated args (for unknown macro preservation).
 */
function reconstructMacroText(name: string, args: string[]): string {
  if (args.length === 0) return `{{${name}}}`;
  return `{{${name}::${args.join('::')}}}`;
}

// ============================================================================
// BLOCK CONDITIONAL HELPERS (kept from original)
// ============================================================================

/**
 * Truthiness check for block conditional evaluation.
 */
function isBlockTruthy(value: string): boolean {
  const lower = value.toLowerCase().trim();
  return lower !== '' && lower !== 'false' && lower !== '0' && lower !== 'null' && lower !== 'undefined';
}

/**
 * Evaluate a comparison expression.
 */
function evaluateComparison(lhs: string, op: string, rhs: string): boolean {
  const lNum = Number(lhs);
  const rNum = Number(rhs);
  const bothNumeric = !isNaN(lNum) && !isNaN(rNum) && lhs !== '' && rhs !== '';

  switch (op) {
    case '==':  return bothNumeric ? lNum === rNum : lhs === rhs;
    case '!=':  return bothNumeric ? lNum !== rNum : lhs !== rhs;
    case '===': return lhs === rhs;
    case '!==': return lhs !== rhs;
    case '>=':  return bothNumeric ? lNum >= rNum : lhs >= rhs;
    case '<=':  return bothNumeric ? lNum <= rNum : lhs <= rhs;
    case '>':   return bothNumeric ? lNum > rNum : lhs > rhs;
    case '<':   return bothNumeric ? lNum < rNum : lhs < rhs;
    default:    return false;
  }
}

const COMPARISON_RE = /^(.*?)\s*(===|!==|>=|<=|==|!=|>|<)\s*(.*)$/;

/**
 * Evaluate a block conditional condition string.
 */
/**
 * Resolve bare `.varName` / `$varName` shorthands inside a block-if condition.
 * The dot-notation preprocessor only rewrites standalone `{{.var ...}}`
 * macros — a bare `.var` inside `{{if .var <= 25}}` reaches the condition
 * evaluator unresolved and would otherwise string-compare literally. Local
 * vars resolve via `.name`, globals via `$name`; missing vars become "".
 */
function resolveConditionShorthands(condition: string, context: MacroContext): string {
  const lookup = (map: Map<string, { value: unknown }>, name: string): string => {
    const v = map.get(name)?.value;
    return v === undefined || v === null ? '' : String(v);
  };
  return condition
    .replace(/(^|[\s(!])\.([A-Za-z_][\w-]*)/g, (_m, pre, name) =>
      pre + lookup(context.localVariables, name))
    .replace(/(^|[\s(!])\$([A-Za-z_][\w-]*)/g, (_m, pre, name) =>
      pre + lookup(context.globalVariables, name));
}

/**
 * Evaluate a condition expression string ("A != B", "x >= 3", "!flag",
 * bare truthiness). Shared by block-if and the iteration/conditional
 * macro families ({{filter}}, {{when_all}}, ...).
 */
export function evaluateConditionExpression(condition: string): boolean {
  return evaluateBlockCondition(condition);
}

function evaluateBlockCondition(condition: string): boolean {
  const trimmed = condition.trim();
  if (!trimmed) return false;

  const compMatch = COMPARISON_RE.exec(trimmed);
  if (compMatch) {
    const lhs = compMatch[1].trim();
    const op = compMatch[2];
    const rhs = compMatch[3].trim();
    return evaluateComparison(lhs, op, rhs);
  }

  if (trimmed.startsWith('!')) {
    const inner = trimmed.slice(1).trim();
    return !isBlockTruthy(inner);
  }

  return isBlockTruthy(trimmed);
}

// ============================================================================
// POST-PROCESSING: Whitespace Cleanup
// ============================================================================

// Sentinel emitted by the bare {{trim}} macro (ST semantics: collapse the
// whitespace surrounding the macro's position). Replaced here, after
// evaluation, so the collapse sees the final neighboring text.
// NOTE: \x01/\x02 are the escaped-brace sentinels and \x03 is the phase
// orchestrator's placeholder delimiter (phases.ts SENTINEL_CHAR) — this one
// must stay distinct from all three.
export const TRIM_SENTINEL = '\x04';

function postProcessWhitespace(text: string): string {
  let result = text;
  if (result.indexOf(TRIM_SENTINEL) !== -1) {
    result = result.replace(/\s*\x04\s*/g, '');
  }
  return result.replace(/\n{3,}/g, '\n\n');
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Process text and expand all macros.
 *
 * Pipeline: preprocess → parse (AST) → evaluate (tree-walk) → post-process
 */
export function processMacros(
  text: string,
  context: MacroContext
): MacroProcessResult {
  const startTime = performance.now();

  // {{rcounter}} state must live on the CALLER'S context object (not the
  // shallow evalContext copy below) so counters continue across the multiple
  // processMacros calls of one prompt build.
  if (!context.counters) context.counters = new Map();

  let currentText = text;

  // ── Pre-processing pipeline ────────────────────────────────────────
  // Pre-interceptors see the raw template before any normalization
  currentText = runInterceptors('pre', currentText, context);
  // Normalize sugar syntaxes (dot vars, space/single-colon separators, legacy
  // angle tokens, escaped braces) into canonical macro form before parsing.
  currentText = preprocessSyntax(currentText);

  // ── Parse (LRU-cached) ─────────────────────────────────────────────
  const ast = parseNodesCached(currentText);

  // ── Evaluate ───────────────────────────────────────────────────────
  const state: EvalState = {
    expansions: [],
    errors: [],
    sideEffects: [],
    expansionCounter: 0,
    touchedVariables: new Set<string>(),
    volatileHit: false,
  };

  // Variable maps are wrapped in recording proxies so the result carries a
  // fingerprint of which variables the template actually read. Writes pass
  // through to the underlying maps unchanged.
  const evalContext: MacroContext = {
    ...context,
    localVariables: makeRecordingVarMap(context.localVariables, 'local', state.touchedVariables),
    globalVariables: makeRecordingVarMap(context.globalVariables, 'global', state.touchedVariables),
  };

  let resultText = evaluateNodes(ast, evalContext, state, 0);

  // ── Post-processing ────────────────────────────────────────────────
  resultText = postProcessWhitespace(resultText);
  resultText = restoreEscapedBraces(resultText);

  // Post-interceptors see the final expanded text
  resultText = runInterceptors('post', resultText, context);

  const processingTimeMs = performance.now() - startTime;

  // Compute depth from expansions (for backward compat)
  let maxDepth = 0;
  for (const exp of state.expansions) {
    if (exp.depth > maxDepth) maxDepth = exp.depth;
  }

  return {
    text: resultText,
    expansions: state.expansions,
    errors: state.errors,
    sideEffects: state.sideEffects,
    touchedVariables: [...state.touchedVariables].sort(),
    cacheable: !state.volatileHit && state.sideEffects.length === 0,
    stats: {
      totalMacros: state.expansions.length + state.errors.length,
      successfulExpansions: state.expansions.length,
      failedExpansions: state.errors.length,
      nestingDepthReached: maxDepth,
      processingTimeMs,
    },
  };
}

// ============================================================================
// MACRO EXPANSION HELPERS (kept from original)
// ============================================================================

/**
 * Expand a single macro by name
 */
function expandSingleMacro(
  name: string,
  args: string[],
  context: MacroContext
): MacroResult {
  const handler = getMacroHandler(name);

  if (!handler) {
    const suggestion = findSimilarMacro(name);
    return {
      value: '',
      success: false,
      error: suggestion
        ? `Unknown macro "${name}". Did you mean "${suggestion}"?`
        : `Unknown macro "${name}"`,
    };
  }

  try {
    return handler(args, context);
  } catch (error) {
    return {
      value: '',
      success: false,
      error: error instanceof Error ? error.message : 'Macro handler threw an exception',
    };
  }
}

/**
 * Apply variable side effects immediately to the context
 */
function applyImmediateSideEffects(
  effects: MacroSideEffect[],
  context: MacroContext
): void {
  for (const effect of effects) {
    switch (effect.type) {
      case 'setLocalVar':
        if (effect.value !== undefined) {
          context.localVariables.set(effect.key, {
            value: effect.value,
            createdAt: context.localVariables.get(effect.key)?.createdAt || new Date(),
            updatedAt: new Date(),
          });
        }
        break;

      case 'setGlobalVar':
        if (effect.value !== undefined) {
          context.globalVariables.set(effect.key, {
            value: effect.value,
            createdAt: context.globalVariables.get(effect.key)?.createdAt || new Date(),
            updatedAt: new Date(),
          });
        }
        break;

      case 'deleteLocalVar':
        context.localVariables.delete(effect.key);
        break;

      case 'deleteGlobalVar':
        context.globalVariables.delete(effect.key);
        break;
    }
  }
}

/**
 * Simple similarity check for macro name typos
 */
function findSimilarMacro(name: string): string | null {
  const commonMacros = [
    'char', 'user', 'time', 'date', 'random', 'pick', 'roll',
    'getvar', 'setvar', 'if', 'upper', 'lower', 'trim',
  ];

  for (const macro of commonMacros) {
    if (Math.abs(name.length - macro.length) <= 2) {
      let diff = 0;
      const shorter = name.length < macro.length ? name : macro;
      const longer = name.length < macro.length ? macro : name;

      for (let i = 0; i < shorter.length; i++) {
        if (shorter[i] !== longer[i]) diff++;
      }
      diff += longer.length - shorter.length;

      if (diff <= 2) return macro;
    }
  }

  return null;
}

/**
 * Create a default/empty macro context
 */
export function createDefaultContext(overrides?: Partial<MacroContext>): MacroContext {
  return {
    characterName: 'Character',
    userName: 'User',
    messages: [],
    messageCount: 0,
    localVariables: new Map(),
    globalVariables: new Map(),
    userMacros: new Map(),
    counters: new Map(),
    templates: new Map(),
    blockOverrides: new Map(),
    ...overrides,
  };
}

// ============================================================================
// TEST-ONLY EXPORTS
// Not part of the public API surface. Exposes the internal recursive-descent
// parser so characterization tests can assert AST structure directly. Do NOT
// use outside of tests — this bypasses preprocessing and the AST cache.
// ============================================================================

export type { ASTNode, TextNode, MacroCallNode, BlockIfNode, BlockSetvarNode, BlockTrimNode };
export const __parseForTest = (text: string): ASTNode[] => parseNodes(text);

/**
 * Quick utility to expand macros with a simple context
 */
export function quickExpand(
  text: string,
  context?: Partial<MacroContext>
): string {
  const fullContext = createDefaultContext(context);
  const result = processMacros(text, fullContext);
  return result.text;
}
