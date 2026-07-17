/**
 * run-data-trigger - the interpreter for Risu's DATA-format triggerscript: the declarative
 * {event, conditions[], effects[]} rules (distinct from Lua triggerlua). This is the production,
 * tested version of the safe simulator in design/vs-behavior-1.html.
 *
 * Security line: this is pure TypeScript. It NEVER executes card content - no eval, no Function, no
 * wasmoon. `calc::` is a hand-written numeric parser; a `command`/`impersonate` effect is recorded as
 * text, never dispatched. The interpreter reads card DATA and reports what it WOULD do; running real
 * effects is a host concern above this layer. Tolerant reader throughout: bad rows are skipped or noted,
 * never thrown.
 *
 * Macro names and condition/effect shapes follow the documented Risu card format.
 */
import type { TriggerScript } from "../../entities/character/schema";
import { classifyCondition, classifyEffect } from "../../entities/character/behavior";

/** Trigger-engine variable store: names to string values (Risu keeps script vars as strings). */
export interface TriggerVars {
  [name: string]: string;
}

/** Outcome of a run: the new variable store, a human-readable action trace, and which labels fired. */
export interface TriggerRunResult {
  vars: TriggerVars;
  log: string[];
  fired: string[];
}

/** Swappable runtime knobs. `rng` makes rolls deterministic in tests; char/user name the speakers. */
export interface TriggerRunOptions {
  /** returns a float in [0, 1); defaults to Math.random. */
  rng?: () => number;
  /** {{char}} expansion (no character loaded here, so it is injected). */
  char?: string;
  /** {{user}} expansion. */
  user?: string;
}

interface ResolveCtx {
  vars: TriggerVars;
  rng: () => number;
  char: string;
  user: string;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Parse like the reference: Number(), with NaN collapsed to null so callers can branch on "is numeric". */
const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const INNERMOST = /\{\{([^{}]*)\}\}/g;
const RESOLVE_PASS_CAP = 100;

/**
 * Resolve {{...}} macros innermost-first, recursively, until stable. Mutates `vars` on a `setvar` macro
 * (that is the macro's documented job - it stores a value and expands to ""). Unknown macros are left
 * literally as {{...}} and never guessed.
 */
export function resolveCbs(text: string, vars: TriggerVars, opts: TriggerRunOptions = {}): string {
  const ctx: ResolveCtx = {
    vars,
    rng: opts.rng ?? Math.random,
    char: opts.char ?? "char",
    user: opts.user ?? "user",
  };
  let s = text;
  for (let pass = 0; pass < RESOLVE_PASS_CAP && s.includes("{{"); pass += 1) {
    const next = s.replace(INNERMOST, (_, inner: string) => evalMacro(inner, ctx));
    if (next === s) break;
    s = next;
  }
  return s;
}

/** Evaluate one macro body (the text between {{ and }}). Innermost args are already resolved. */
function evalMacro(inner: string, ctx: ResolveCtx): string {
  const parts = inner.split("::");
  const name = str(parts[0]).trim().toLowerCase();
  const args = parts.slice(1);
  const arg = (i: number): string => str(args[i]);
  switch (name) {
    case "getvar":
    case "gettempvar":
      return ctx.vars[arg(0)] ?? "";
    case "setvar": {
      // value is everything after the name, so values containing "::" survive
      ctx.vars[arg(0)] = args.slice(1).join("::");
      return "";
    }
    case "roll": {
      const n = Math.trunc(num(arg(0)) ?? 0);
      return String(1 + Math.floor(ctx.rng() * Math.max(1, n)));
    }
    case "random": {
      if (args.length === 0) return "";
      return str(args[Math.floor(ctx.rng() * args.length)]);
    }
    case "calc":
      return safeCalc(arg(0));
    case "equal":
      return String(arg(0)) === String(arg(1)) ? "1" : "";
    case "greater":
      return numCompare(arg(0), arg(1), (a, b) => a > b);
    case "greater_equal":
      return numCompare(arg(0), arg(1), (a, b) => a >= b);
    case "less":
      return numCompare(arg(0), arg(1), (a, b) => a < b);
    case "less_equal":
      return numCompare(arg(0), arg(1), (a, b) => a <= b);
    case "char":
      return ctx.char;
    case "user":
      return ctx.user;
    default:
      return `{{${inner}}}`;
  }
}

const numCompare = (a: string, b: string, cmp: (x: number, y: number) => boolean): string =>
  cmp(num(a) ?? 0, num(b) ?? 0) ? "1" : "";

// -- calc:: a from-scratch numeric evaluator for + - * / (and parens/unary minus). No eval/Function. --

/** Evaluate a numeric expression; on any parse failure return the literal input (tolerant reader). */
export function safeCalc(expr: string): string {
  const tokens = tokenizeCalc(expr);
  if (tokens === null) return expr;
  const parser = { tokens, pos: 0 };
  const value = parseAddSub(parser);
  if (value === null || parser.pos !== tokens.length) return expr;
  if (!Number.isFinite(value)) return expr;
  return String(value);
}

type CalcToken = { kind: "num"; value: number } | { kind: "op"; value: string };

const tokenizeCalc = (expr: string): CalcToken[] | null => {
  const tokens: CalcToken[] = [];
  const re = /\s*(\d+(?:\.\d+)?|[-+*/()])\s*/y;
  let idx = 0;
  while (idx < expr.length) {
    re.lastIndex = idx;
    const m = re.exec(expr);
    if (m === null || m.index !== idx) return null;
    const raw = str(m[1]);
    if (raw === "") return null;
    tokens.push(/^\d/.test(raw) ? { kind: "num", value: Number(raw) } : { kind: "op", value: raw });
    idx = re.lastIndex;
  }
  return tokens;
};

interface CalcParser {
  tokens: CalcToken[];
  pos: number;
}

const peek = (p: CalcParser): CalcToken | undefined => p.tokens[p.pos];

const parseAddSub = (p: CalcParser): number | null => {
  let left = parseMulDiv(p);
  if (left === null) return null;
  for (let t = peek(p); t && t.kind === "op" && (t.value === "+" || t.value === "-"); t = peek(p)) {
    p.pos += 1;
    const right = parseMulDiv(p);
    if (right === null) return null;
    left = t.value === "+" ? left + right : left - right;
  }
  return left;
};

const parseMulDiv = (p: CalcParser): number | null => {
  let left = parseUnary(p);
  if (left === null) return null;
  for (let t = peek(p); t && t.kind === "op" && (t.value === "*" || t.value === "/"); t = peek(p)) {
    p.pos += 1;
    const right = parseUnary(p);
    if (right === null) return null;
    if (t.value === "/" && right === 0) return null; // divide-by-zero -> literal
    left = t.value === "*" ? left * right : left / right;
  }
  return left;
};

const parseUnary = (p: CalcParser): number | null => {
  const t = peek(p);
  if (t && t.kind === "op" && t.value === "-") {
    p.pos += 1;
    const inner = parseUnary(p);
    return inner === null ? null : -inner;
  }
  return parsePrimary(p);
};

const parsePrimary = (p: CalcParser): number | null => {
  const t = peek(p);
  if (t === undefined) return null;
  if (t.kind === "num") {
    p.pos += 1;
    return t.value;
  }
  if (t.kind === "op" && t.value === "(") {
    p.pos += 1;
    const inner = parseAddSub(p);
    if (inner === null) return null;
    const close = peek(p);
    if (!close || close.kind !== "op" || close.value !== ")") return null;
    p.pos += 1;
    return inner;
  }
  return null;
};

// -- condition + effect evaluation --

/** Compare two resolved values: numeric when both parse as numbers, string otherwise. */
const compare = (l: string, op: string, r: string): boolean => {
  const ln = num(l);
  const rn = num(r);
  const nums = ln !== null && rn !== null;
  switch (op) {
    case "=":
      return String(l) === String(r);
    case "!=":
      return String(l) !== String(r);
    case ">":
      return nums ? ln > rn : l > r;
    case "<":
      return nums ? ln < rn : l < r;
    case ">=":
      return nums ? ln >= rn : l >= r;
    case "<=":
      return nums ? ln <= rn : l <= r;
    default:
      return false;
  }
};

/** Does this condition row hold against the current vars? Known = plain var compare; advanced = both
 * sides are resolved (macro-built `type:"value"` rows) then compared. */
const conditionHolds = (row: unknown, ctx: ResolveCtx): boolean => {
  const view = classifyCondition(row);
  if (view.kind === "known") {
    const lhs = ctx.vars[view.variable] ?? "";
    const rhs = resolveCtx(view.value, ctx);
    return compare(lhs, view.operator, rhs);
  }
  const raw = view.raw;
  const lhs = resolveCtx(str(raw.var), ctx);
  const rhs = resolveCtx(str(raw.value), ctx);
  return compare(lhs, str(raw.operator), rhs);
};

/** Apply a setvar assignment operator; += -* / coerce to numbers (missing current -> 0), = assigns raw. */
const applyOp = (current: string, op: string, value: string): string => {
  if (op === "=") return value;
  const cn = num(current) ?? 0;
  const vn = num(value);
  if (vn === null) return value;
  switch (op) {
    case "+=":
      return String(cn + vn);
    case "-=":
      return String(cn - vn);
    case "*=":
      return String(cn * vn);
    case "/=":
      return String(vn !== 0 ? cn / vn : cn);
    default:
      return value;
  }
};

/** Run one effect row: setvar mutates ctx.vars; impersonate/command/unknown push a trace line to log. */
const applyEffect = (row: unknown, ctx: ResolveCtx, log: string[]): void => {
  const view = classifyEffect(row);
  switch (view.kind) {
    case "setvar": {
      const value = resolveCtx(view.value, ctx);
      ctx.vars[view.variable] = applyOp(ctx.vars[view.variable] ?? "0", view.operator, value);
      return;
    }
    case "impersonate":
      log.push(`impersonate(${view.role}): ${resolveCtx(view.value, ctx)}`);
      return;
    case "command":
      log.push(`command: ${resolveCtx(view.value, ctx)}`);
      return;
    case "advanced": {
      const type = str(view.raw.type) || "unknown";
      log.push(`unsupported effect skipped: ${type}`);
      return;
    }
  }
};

const resolveCtx = (text: string, ctx: ResolveCtx): string =>
  resolveCbs(text, ctx.vars, { rng: ctx.rng, char: ctx.char, user: ctx.user });

/**
 * Run every trigger whose event matches, in order. For each, if all conditions hold, record the label
 * in `fired` and apply its effects. Returns a NEW vars object (the input is never mutated), the action
 * log, and the fired labels.
 */
export function runDataTriggers(
  triggers: TriggerScript[],
  vars: TriggerVars,
  event: string,
  opts: TriggerRunOptions = {},
): TriggerRunResult {
  const ctx: ResolveCtx = {
    vars: { ...vars },
    rng: opts.rng ?? Math.random,
    char: opts.char ?? "char",
    user: opts.user ?? "user",
  };
  const log: string[] = [];
  const fired: string[] = [];
  for (const trigger of triggers) {
    if (trigger.event !== event) continue;
    const holds = trigger.conditions.every((c) => conditionHolds(c, ctx));
    if (!holds) continue;
    fired.push(str(trigger.label));
    for (const effect of trigger.effects) applyEffect(effect, ctx, log);
  }
  return { vars: ctx.vars, log, fired };
}
