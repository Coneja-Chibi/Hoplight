// ============================================================================
// OFF-BAND $ MACROS (macro engine spec Part III.3 / III.4 / III.5)
//
// Macros that make a separate LLM call during prompt assembly, so the
// answer can shape the prompt currently being built (the one thing
// in-reply asks can't do):
//
//   {{pick$::question::opt1::opt2::...}}          model picks one option
//   {{pick_or_keep$::var::question::opts}}        keep var if set, else ask
//   {{pick_when$::condition::question::opts}}     ask only when condition true
//   {{ask_model$::question}}                      freeform answer
//   {{walkdown$::<yaml levels>}}                  multi-level pick chain
//
// `$` means "this costs a separate API call" — the cost-marker convention.
// A `!` suffix ({{pick$!::...}}) busts the cache and re-asks.
//
// Resolution is an ASYNC PRE-PASS over the prompt blocks, before normal
// (sync) macro expansion: each ask is gated (or_keep / when), checked
// against the per-chat cache (__offband_cache), executed via an injected
// executor when needed, and its answer substituted into the text. Cache
// writes and into= commits mutate the shared assembly context, which the
// assembler already persists wholesale.
//
// Without an executor (preview routes, contexts that can't spend), asks
// degrade to cache/keep-or-empty — same behavior as the sync fallback
// handlers in handlers/offband-macros.ts, which cover $ macros that never
// reached the pre-pass (e.g. nested inside another macro's args).
// ============================================================================

import yaml from 'js-yaml';
import { MacroContext, MacroVariable, MacroVariableValue } from './types';
import { processMacros, evaluateConditionExpression } from './processor';
import { resolveVar } from './handlers/variables';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type OffbandKind = 'pick' | 'pick_or_keep' | 'pick_when' | 'ask_model' | 'walkdown';

export interface OffbandAsk {
  kind: OffbandKind;
  /** Full original macro source ({{...}}) */
  raw: string;
  question: string;
  options: string[];
  /** pick_or_keep: the variable to keep */
  varName?: string;
  /** pick_when: the gate condition */
  condition?: string;
  /** Commit the answer to this scope:key as well as substituting inline */
  into?: string;
  /** `!` suffix — bypass the cache */
  forceFresh: boolean;
  /** walkdown: the raw YAML spec */
  walkdownSpec?: string;
}

/**
 * Makes one off-band model call. The worker implements this over the
 * chat's own provider/model with normal charging; `purpose` is for logs.
 */
export type OffbandExecutor = (req: {
  prompt: string;
  maxTokens: number;
  purpose: string;
}) => Promise<string>;

export interface OffbandBlock {
  id: string;
  text: string;
}

/** Per-chat answer cache variable: { [cacheKey]: answer } */
export const OFFBAND_CACHE_KEY = '__offband_cache';

// -----------------------------------------------------------------------------
// Extraction & parsing
// -----------------------------------------------------------------------------

const OFFBAND_BASE_NAMES = new Set(['pick$', 'pick_or_keep$', 'pick_when$', 'ask_model$', 'walkdown$']);

/** Cheap pre-check before running the async pass. */
export function containsOffbandMacros(text: string): boolean {
  return /\{\{\s*(pick|pick_or_keep|pick_when|ask_model|walkdown)\$!?\s*::/i.test(text);
}

function findClose(text: string, openPos: number): number {
  let depth = 0;
  for (let i = openPos; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') { depth++; i++; }
    else if (text[i] === '}' && text[i + 1] === '}') {
      depth--;
      if (depth === 0) return i;
      i++;
    }
  }
  return -1;
}

function splitTopLevel(content: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '{' && content[i + 1] === '{') { depth++; current += '{{'; i++; }
    else if (content[i] === '}' && content[i + 1] === '}') { depth--; current += '}}'; i++; }
    else if (content[i] === ':' && content[i + 1] === ':' && depth === 0) {
      parts.push(current); current = ''; i++;
    } else current += content[i];
  }
  parts.push(current);
  return parts;
}

/** Parse evaluated/raw args into an ask. Exported for the sync fallbacks. */
export function parseOffbandAsk(name: string, args: string[], raw: string): OffbandAsk | null {
  const forceFresh = name.endsWith('!');
  const base = forceFresh ? name.slice(0, -1) : name;
  if (!OFFBAND_BASE_NAMES.has(base)) return null;

  let into: string | undefined;
  const positional: string[] = [];
  for (const arg of args) {
    const m = /^into\s*=\s*(.+)$/.exec(arg.trim());
    if (m) into = m[1].trim();
    else positional.push(arg);
  }

  switch (base) {
    case 'pick$':
      if (positional.length < 2) return null;
      return { kind: 'pick', raw, question: positional[0], options: positional.slice(1), into, forceFresh };
    case 'pick_or_keep$':
      if (positional.length < 3) return null;
      return {
        kind: 'pick_or_keep', raw, varName: positional[0],
        question: positional[1], options: positional.slice(2), into, forceFresh,
      };
    case 'pick_when$':
      if (positional.length < 3) return null;
      return {
        kind: 'pick_when', raw, condition: positional[0],
        question: positional[1], options: positional.slice(2), into, forceFresh,
      };
    case 'ask_model$':
      if (positional.length < 1) return null;
      return { kind: 'ask_model', raw, question: positional[0], options: [], into, forceFresh };
    case 'walkdown$':
      if (positional.length < 1) return null;
      return {
        kind: 'walkdown', raw, question: '', options: [],
        walkdownSpec: positional.join('::'), into, forceFresh,
      };
  }
  return null;
}

interface ExtractedAsk {
  ask: OffbandAsk;
  start: number;
  end: number;
}

/** Find top-level off-band macros in a text. */
export function extractOffbandAsks(text: string): ExtractedAsk[] {
  const found: ExtractedAsk[] = [];
  let pos = 0;
  while (pos < text.length) {
    const open = text.indexOf('{{', pos);
    if (open === -1) break;
    const close = findClose(text, open);
    if (close === -1) break;

    const inner = text.slice(open + 2, close);
    const parts = splitTopLevel(inner);
    const name = parts[0].trim().toLowerCase();
    if (OFFBAND_BASE_NAMES.has(name.endsWith('!') ? name.slice(0, -1) : name)) {
      const ask = parseOffbandAsk(name, parts.slice(1).map(a => a.trim()), text.slice(open, close + 2));
      if (ask) {
        found.push({ ask, start: open, end: close + 2 });
        pos = close + 2;
        continue;
      }
    }
    // Not (a valid) off-band macro — skip just the opener so nested
    // occurrences inside other macros are NOT extracted (they fall to the
    // sync fallback handlers).
    pos = close + 2;
  }
  return found;
}

// ============================================================================
// TEST-ONLY EXPORT
// Surfaces the off-band scanner's raw top-level tokenization (name + arg
// boundaries + source span) for EVERY top-level `{{...}}`, not just off-band
// macros. Characterization tests use this to pin that this scanner agrees with
// the processor/lint scanners on name/arg boundaries and top-level vs nested
// classification, so the tokenizer rewrite cannot silently desync them. Not
// part of the public API surface; mirrors extractOffbandAsks' scan loop.
// ============================================================================

export interface TopLevelMacroForTest {
  name: string;
  args: string[];
  start: number;
  end: number;
}

export function __scanTopLevelForTest(text: string): TopLevelMacroForTest[] {
  const out: TopLevelMacroForTest[] = [];
  let pos = 0;
  while (pos < text.length) {
    const open = text.indexOf('{{', pos);
    if (open === -1) break;
    const close = findClose(text, open);
    if (close === -1) break;
    const inner = text.slice(open + 2, close);
    const parts = splitTopLevel(inner);
    out.push({
      name: parts[0].trim().toLowerCase(),
      args: parts.slice(1).map(a => a.trim()),
      start: open,
      end: close + 2,
    });
    pos = close + 2;
  }
  return out;
}

// -----------------------------------------------------------------------------
// Cache
// -----------------------------------------------------------------------------

function hashKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/**
 * Stable cache key per spec III.4: (macro signature, args).
 *
 * varName and condition are part of the signature: two `pick_or_keep$` asks
 * with the same question but different target variables (e.g. heroWeapon vs
 * villainWeapon) are distinct picks and must not share one cached answer.
 * `into` is intentionally excluded — a cache hit still commits to the current
 * `into` target (see resolveAsk), so it never needs to widen the key.
 */
export function cacheKeyFor(ask: OffbandAsk): string {
  return hashKey(
    [
      ask.kind,
      ask.varName ?? '',
      ask.condition ?? '',
      ask.question,
      ...ask.options,
      ask.walkdownSpec ?? '',
    ].join('\x1f')
  );
}

function readCache(context: MacroContext, key: string): string | undefined {
  const raw = context.localVariables.get(OFFBAND_CACHE_KEY)?.value;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const value = (raw as Record<string, MacroVariableValue>)[key];
  return typeof value === 'string' ? value : undefined;
}

function makeVar(value: MacroVariableValue): MacroVariable {
  return { value, createdAt: new Date(), updatedAt: new Date() };
}

function writeCache(context: MacroContext, key: string, answer: string): void {
  const raw = context.localVariables.get(OFFBAND_CACHE_KEY)?.value;
  const cache: Record<string, MacroVariableValue> =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? { ...(raw as Record<string, MacroVariableValue>) }
      : {};
  cache[key] = answer;
  context.localVariables.set(OFFBAND_CACHE_KEY, makeVar(cache));
}

// -----------------------------------------------------------------------------
// Resolution
// -----------------------------------------------------------------------------

/** Canonicalize a pick answer to one of the options when possible. */
export function canonicalizePick(answer: string, options: string[]): string {
  const firstLine = answer.split('\n')[0].trim().replace(/^["'`]+|["'`.,!]+$/g, '');
  const exact = options.find(o => o.toLowerCase() === firstLine.toLowerCase());
  if (exact) return exact;
  const contained = options.find(o => firstLine.toLowerCase().includes(o.toLowerCase()));
  if (contained) return contained;
  return firstLine;
}

function pickPrompt(question: string, options: string[]): string {
  return [
    'You are a decision module inside a roleplay engine. Decide the following:',
    question,
    '',
    'Respond with EXACTLY one of these options, verbatim, and nothing else:',
    ...options.map(o => `- ${o}`),
  ].join('\n');
}

function askPrompt(question: string): string {
  return [
    'You are a decision module inside a roleplay engine. Answer concisely',
    '(a short phrase or sentence, no preamble):',
    question,
  ].join('\n');
}

/** Expand macros inside an ask's text fields against the shared context. */
function expand(text: string, context: MacroContext): string {
  if (!text.includes('{{')) return text;
  return processMacros(text, context).text;
}

function commitInto(context: MacroContext, into: string, answer: string): void {
  const { vars, target } = resolveVar(into, context);
  vars.set(target.key, makeVar(answer));
}

interface WalkdownLevel {
  label?: string;
  options?: unknown[];
  options_from?: string;
  [branch: string]: unknown;
}

async function resolveWalkdown(
  ask: OffbandAsk,
  context: MacroContext,
  executor: OffbandExecutor
): Promise<string> {
  let spec: Record<string, unknown>;
  try {
    const parsed = yaml.load(expand(ask.walkdownSpec ?? '', context));
    if (typeof parsed !== 'object' || parsed === null) return '';
    spec = parsed as Record<string, unknown>;
  } catch {
    return '';
  }

  const levelEntries = Object.entries(spec).filter(([key]) => key !== 'commit');
  let picked = '';

  for (const [levelName, rawLevel] of levelEntries) {
    if (typeof rawLevel !== 'object' || rawLevel === null) continue;
    const level = rawLevel as WalkdownLevel;

    let options: string[];
    if (Array.isArray(level.options)) {
      options = level.options.map(String);
    } else if (level.options_from && picked) {
      const branch = level[picked];
      options = Array.isArray(branch) ? branch.map(String) : [];
    } else {
      options = [];
    }
    if (options.length === 0) continue;

    const question = level.label ? `Choose the ${level.label}.` : `Choose for ${levelName}.`;
    const answer = await executor({
      prompt: pickPrompt(question, options),
      maxTokens: 64,
      purpose: `walkdown:${levelName}`,
    });
    picked = canonicalizePick(answer, options);
  }

  const commit = spec.commit;
  if (picked && typeof commit === 'object' && commit !== null) {
    const set = (commit as Record<string, unknown>).set;
    if (typeof set === 'string') commitInto(context, set, picked);
  }
  return picked;
}

/** Resolve one ask to its substitution text. */
async function resolveOne(
  ask: OffbandAsk,
  context: MacroContext,
  executor: OffbandExecutor | undefined,
  log: (m: string) => void
): Promise<string> {
  // Gate: keep an existing value
  if (ask.kind === 'pick_or_keep' && ask.varName) {
    const { vars, target } = resolveVar(ask.varName, context);
    const existing = vars.get(target.key)?.value;
    if (existing !== undefined && existing !== null && String(existing).trim() !== '') {
      return String(existing);
    }
  }

  // Gate: condition
  if (ask.kind === 'pick_when' && ask.condition !== undefined) {
    const condition = expand(ask.condition, context).trim();
    if (!evaluateConditionExpression(condition)) return '';
  }

  const cacheKey = cacheKeyFor(ask);
  if (!ask.forceFresh) {
    const cached = readCache(context, cacheKey);
    if (cached !== undefined) {
      if (ask.into) commitInto(context, ask.into, cached);
      return cached;
    }
  }

  if (!executor) {
    log(`[offband] no executor for ${ask.kind} — substituting empty`);
    return '';
  }

  let answer: string;
  if (ask.kind === 'walkdown') {
    answer = await resolveWalkdown(ask, context, executor);
  } else {
    const question = expand(ask.question, context);
    const options = ask.options.map(o => expand(o, context)).filter(o => o.trim().length > 0);
    if (ask.kind === 'ask_model') {
      answer = (await executor({ prompt: askPrompt(question), maxTokens: 256, purpose: 'ask_model' })).trim();
    } else {
      const rawAnswer = await executor({ prompt: pickPrompt(question, options), maxTokens: 64, purpose: ask.kind });
      answer = canonicalizePick(rawAnswer, options);
    }
  }

  if (answer) {
    writeCache(context, cacheKey, answer);
    if (ask.into) commitInto(context, ask.into, answer);
  }
  return answer;
}

/**
 * The async pre-pass: resolve every top-level off-band macro in the
 * given blocks, substituting answers into the text. Mutates the shared
 * context (cache writes, into= commits) — the assembler persists it.
 * Returns block id → new text (only blocks that changed).
 */
export async function resolveOffbandAsks(
  blocks: OffbandBlock[],
  context: MacroContext,
  executor?: OffbandExecutor,
  opts: { log?: (m: string) => void } = {}
): Promise<Map<string, string>> {
  const log = opts.log ?? (() => {});
  const results = new Map<string, string>();

  for (const block of blocks) {
    if (!containsOffbandMacros(block.text)) continue;
    const extracted = extractOffbandAsks(block.text);
    if (extracted.length === 0) continue;

    let rebuilt = '';
    let cursor = 0;
    for (const { ask, start, end } of extracted) {
      let answer = '';
      try {
        answer = await resolveOne(ask, context, executor, log);
        log(`[offband] ${ask.kind} → ${answer ? JSON.stringify(answer.slice(0, 60)) : '(empty)'}`);
      } catch (err) {
        // A failed decision call must never break assembly
        log(`[offband] ${ask.kind} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      rebuilt += block.text.slice(cursor, start) + answer;
      cursor = end;
    }
    rebuilt += block.text.slice(cursor);
    results.set(block.id, rebuilt);
  }

  return results;
}
