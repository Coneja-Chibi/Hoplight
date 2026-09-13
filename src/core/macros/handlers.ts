/**
 * The bucket-1 handler set: identity, variables, inline conditionals, text transforms, and the
 * seeded volatile family (spec "evaluation-scope contract", bucket 1).
 *
 * DELIBERATELY a subset. Every macro here needs nothing but the value-only context; a name not
 * registered degrades to literal passthrough at the evaluator (never an error, never silent
 * removal - ADR-012). Time/date macros are absent on purpose: they need the caller-supplied
 * clock decision that ADR-012 requires and no caller has made yet, and shipping them on the
 * ambient clock would be exactly the untestable behavior the ADR forbids.
 *
 * ADR-012 "handlers are data-only" is enforced by a registry test, not just this header.
 */
import type { HandlerRun, MacroContext, MacroDefinition, MacroResult } from "./types";
import { mapForTarget, resolveVariableTarget } from "./scopes";

const ok = (value: string): MacroResult => ({ value, success: true });

export const readVar = (context: MacroContext, rawKey: string): string => {
  const target = resolveVariableTarget(rawKey, context);
  return mapForTarget(target, context).get(target.key)?.value ?? "";
};

export const writeVar = (context: MacroContext, rawKey: string, value: string): MacroResult => {
  const target = resolveVariableTarget(rawKey, context);
  if (context.readOnly) return ok("");
  const map = mapForTarget(target, context);
  const now = 0; // deterministic; wall-clock timestamps are a caller decision (ADR-012)
  const prior = map.get(target.key);
  map.set(target.key, { value, createdAt: prior?.createdAt ?? now, updatedAt: now });
  return {
    value: "",
    success: true,
    sideEffects: [
      { type: target.isGlobal ? "setGlobalVar" : "setLocalVar", key: target.key, value },
    ],
  };
};

const deleteVar = (context: MacroContext, rawKey: string): MacroResult => {
  const target = resolveVariableTarget(rawKey, context);
  if (context.readOnly) return ok("");
  mapForTarget(target, context).delete(target.key);
  return {
    value: "",
    success: true,
    sideEffects: [{ type: target.isGlobal ? "deleteGlobalVar" : "deleteLocalVar", key: target.key }],
  };
};

const addToVar = (context: MacroContext, rawKey: string, delta: number): MacroResult => {
  const current = Number(readVar(context, rawKey)) || 0;
  return writeVar(context, rawKey, String(current + delta));
};

const globalKey = (key: string): string => (key.includes(":") ? key : `global:${key}`);

/** `""`, `"false"`, `"0"`, `"null"`, `"undefined"` (trimmed, case-insensitive) are falsy. */
export const isTruthyText = (text: string): boolean => {
  const t = text.trim().toLowerCase();
  return t !== "" && t !== "false" && t !== "0" && t !== "null" && t !== "undefined";
};

export const compareTexts = (a: string, op: string, b: string): boolean => {
  const an = Number(a);
  const bn = Number(b);
  const numeric = a.trim() !== "" && b.trim() !== "" && !Number.isNaN(an) && !Number.isNaN(bn);
  switch (op) {
    case "==":
    case "===":
      return numeric ? an === bn : a === b;
    case "!=":
    case "!==":
      return numeric ? an !== bn : a !== b;
    case ">":
      return numeric ? an > bn : a > b;
    case "<":
      return numeric ? an < bn : a < b;
    case ">=":
      return numeric ? an >= bn : a >= b;
    case "<=":
      return numeric ? an <= bn : a <= b;
    default:
      return false;
  }
};

/** Options for random/pick: `::`-separated args, or one arg comma-split (ST habit). */
export const choiceOptions = (args: string[]): string[] => {
  const only = args.length === 1 ? args[0] : undefined;
  return only !== undefined && only.includes(",") ? only.split(",").map((s) => s.trim()) : args;
};

const rollDice = (spec: string, run: HandlerRun): number | null => {
  const m = /^(\d{0,3})d(\d{1,5})([+-]\d{1,5})?$/i.exec(spec.trim());
  if (!m) return null;
  const count = Math.min(Number(m[1] || "1"), 100);
  const sides = Number(m[2] ?? "0");
  if (sides < 1) return null;
  let sum = 0;
  for (let i = 0; i < count; i++) sum += 1 + Math.floor(run.random() * sides);
  return sum + (m[3] ? Number(m[3]) : 0);
};

export const HANDLERS: MacroDefinition[] = [
  // identity
  { name: "char", aliases: ["bot", "character"], category: "identity", description: "character name", handler: (_a, c) => ok(c.characterName) },
  { name: "user", category: "identity", description: "user/persona name", handler: (_a, c) => ok(c.userName) },
  { name: "description", category: "identity", description: "character description", handler: (_a, c) => ok(c.characterDescription ?? "") },
  { name: "personality", category: "identity", description: "character personality", handler: (_a, c) => ok(c.characterPersonality ?? "") },
  { name: "scenario", category: "identity", description: "scenario", handler: (_a, c) => ok(c.scenario ?? "") },
  { name: "model", category: "identity", description: "model name", handler: (_a, c) => ok(c.modelName ?? "") },

  // comments
  { name: "//", category: "comment", description: "comment; renders nothing", handler: () => ok("") },

  // text transforms
  { name: "upper", aliases: ["uppercase"], category: "text", description: "uppercase the argument", handler: (a) => ok((a[0] ?? "").toUpperCase()) },
  { name: "lower", aliases: ["lowercase"], category: "text", description: "lowercase the argument", handler: (a) => ok((a[0] ?? "").toLowerCase()) },
  { name: "trim", category: "text", description: "whitespace-collapse marker", handler: () => ok("\x04") },

  // variables - session/scoped
  { name: "getvar", aliases: ["var"], category: "variables", description: "read a variable", handler: (a, c) => ok(readVar(c, a[0] ?? "")) },
  { name: "setvar", category: "variables", description: "write a variable", hasSideEffects: true, handler: (a, c) => writeVar(c, a[0] ?? "", a[1] ?? "") },
  { name: "addvar", category: "variables", description: "add a number to a variable", hasSideEffects: true, handler: (a, c) => addToVar(c, a[0] ?? "", Number(a[1] ?? "0") || 0) },
  { name: "incvar", category: "variables", description: "increment a variable", hasSideEffects: true, handler: (a, c) => addToVar(c, a[0] ?? "", 1) },
  { name: "decvar", category: "variables", description: "decrement a variable", hasSideEffects: true, handler: (a, c) => addToVar(c, a[0] ?? "", -1) },
  { name: "hasvar", category: "variables", description: "does the variable exist", handler: (a, c) => { const t = resolveVariableTarget(a[0] ?? "", c); return ok(mapForTarget(t, c).has(t.key) ? "true" : "false"); } },
  { name: "delvar", category: "variables", description: "delete a variable", hasSideEffects: true, handler: (a, c) => deleteVar(c, a[0] ?? "") },

  // variables - global spellings
  { name: "getglobalvar", aliases: ["gvar"], category: "variables", description: "read a global variable", handler: (a, c) => ok(readVar(c, globalKey(a[0] ?? ""))) },
  { name: "setglobalvar", category: "variables", description: "write a global variable", hasSideEffects: true, handler: (a, c) => writeVar(c, globalKey(a[0] ?? ""), a[1] ?? "") },
  { name: "addglobalvar", category: "variables", description: "add to a global variable", hasSideEffects: true, handler: (a, c) => addToVar(c, globalKey(a[0] ?? ""), Number(a[1] ?? "0") || 0) },
  { name: "incglobalvar", category: "variables", description: "increment a global variable", hasSideEffects: true, handler: (a, c) => addToVar(c, globalKey(a[0] ?? ""), 1) },
  { name: "decglobalvar", category: "variables", description: "decrement a global variable", hasSideEffects: true, handler: (a, c) => addToVar(c, globalKey(a[0] ?? ""), -1) },
  { name: "hasglobalvar", category: "variables", description: "does the global variable exist", handler: (a, c) => { const t = resolveVariableTarget(globalKey(a[0] ?? ""), c); return ok(mapForTarget(t, c).has(t.key) ? "true" : "false"); } },
  { name: "delglobalvar", category: "variables", description: "delete a global variable", hasSideEffects: true, handler: (a, c) => deleteVar(c, globalKey(a[0] ?? "")) },

  // inline conditionals
  { name: "if", category: "conditional", description: "inline conditional: cond, then, else", handler: (a) => ok(isTruthyText(a[0] ?? "") ? (a[1] ?? "") : (a[2] ?? "")) },
  { name: "compare", category: "conditional", description: "compare two values with an operator", handler: (a) => ok(compareTexts(a[0] ?? "", (a[1] ?? "==").trim(), a[2] ?? "") ? "true" : "false") },

  // volatile family (seeded)
  { name: "random", category: "random", volatile: true, description: "pick one option at random", handler: (a, _c, run) => { const opts = choiceOptions(a); return ok(opts[Math.floor(run.random() * opts.length)] ?? ""); } },
  { name: "pick", category: "random", volatile: true, description: "pick one option (stable within a seed)", handler: (a, _c, run) => { const opts = choiceOptions(a); return ok(opts[Math.floor(run.random() * opts.length)] ?? ""); } },
  { name: "roll", aliases: ["dice"], category: "random", volatile: true, description: "roll dice: NdM(+K)", handler: (a, _c, run) => { const n = rollDice(a[0] ?? "", run); return n === null ? { value: "", success: false, error: `bad dice spec: ${a[0] ?? ""}` } : ok(String(n)); } },
  { name: "coinflip", category: "random", volatile: true, description: "Heads or Tails", handler: (_a, _c, run) => ok(run.random() < 0.5 ? "Heads" : "Tails") },
];
