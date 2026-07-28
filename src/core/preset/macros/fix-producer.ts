/**
 * Removing an inline cleanup macro by fixing what produced the mess.
 *
 * WHY THE OBVIOUS CONVERSION IS IMPOSSIBLE. `{{regex::VALUE::PATTERN::REPLACEMENT}}` rewrites a
 * value at the moment a prompt renders. SillyTavern regex scripts look like the counterpart, and are
 * not: they run over chat messages and world-info entries (`script.js`, where getRegexedString is
 * applied across coreChat), never over preset prompt content. There is no surface on which a script
 * could clean a variable being read inside a prompt block, so no arrangement of scripts reproduces
 * the macro. Emitting one anyway would be a rule that runs, matches nothing, and looks correct.
 *
 * WHAT IS ACTUALLY FIXABLE, and it covers the common case. A list assembled by appending
 * `separator + item` onto an empty variable comes out with a leading separator, and the usual repair
 * is to strip it afterwards with exactly this macro. The cleanup only exists because the appends
 * emit a separator they should not have emitted first time round. Guard each append on whether the
 * variable already holds something and the leading separator never appears, so nothing needs
 * stripping:
 *
 *     {{addvar::pool::, ITEM}}
 *       ->  {{if {{getvar::pool}}}}{{addvar::pool::, ITEM}}{{else}}{{setvar::pool::ITEM}}{{/if}}
 *
 * The cleanup macro is then deleted rather than translated, because there is nothing left for it to
 * clean. That is the whole pattern: the consumer stops needing the fix because the producer stopped
 * causing it.
 *
 * NOTHING IS COMPILED. Deciding whether a pattern strips a separator is done by normalising the
 * pattern as text, never by running it, so an authored regex cannot execute here. The cost is that
 * only straightforward spellings are recognised; anything else is reported unfixed rather than
 * guessed at, because a wrong guess silently changes what a preset renders.
 */
import { macroName, scanMacroTokens } from "./support";

/** One cleanup macro removed by repairing the writes that made it necessary. */
export interface ProducerFix {
  variable: string;
  /** The separator the appends were prepending, as authored. */
  separator: string;
  /** The cleanup macro that is no longer needed. */
  cleanup: string;
  /** How many append sites were guarded. */
  guarded: number;
  where: string;
}

/** A cleanup macro left in place, with the reason it could not be traced to a producer. */
export interface UnfixedCleanup {
  cleanup: string;
  where: string;
  reason: string;
}

export interface ProducerRepair {
  /** A copy of the body. The input is never mutated. */
  body: unknown;
  fixes: ProducerFix[];
  unfixed: UnfixedCleanup[];
}

/** Split on `::` at brace depth zero, so a nested macro argument stays whole. */
function splitArgs(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i += 1) {
    if (inner[i] === "{" && inner[i + 1] === "{") { depth += 1; i += 1; continue; }
    if (inner[i] === "}" && inner[i + 1] === "}") { depth -= 1; i += 1; continue; }
    if (depth === 0 && inner[i] === ":" && inner[i + 1] === ":") {
      parts.push(inner.slice(start, i));
      i += 1;
      start = i + 1;
    }
  }
  parts.push(inner.slice(start));
  return parts;
}

/**
 * Does this pattern strip exactly this separator from the front?
 *
 * Decided by normalising the pattern as text: whitespace classes collapse to a space and escapes
 * come off, then it is compared with the separator. `^,\s*` and `, ` agree; anything needing real
 * regex semantics to judge does not, and is left alone.
 */
export function stripsSeparator(pattern: string, separator: string): boolean {
  if (!pattern.startsWith("^")) return false;
  // Whitespace classes collapse FIRST, or their own quantifier is mistaken for regex syntax and a
  // perfectly ordinary `\s+` gets refused.
  const collapsed = pattern.slice(1).replace(/\\s[*+]?/g, " ");
  if (/[[\](){}|+?*.]/.test(collapsed.replace(/\\./g, ""))) return false; // real regex semantics
  const normalized = collapsed.replace(/\\(.)/g, "$1").trim();
  return normalized.length > 0 && normalized === separator.trim();
}

/**
 * The variable a cleanup macro reads, with its SCOPE, when it is a plain read of one.
 *
 * Scope has to travel with the name. SillyTavern keeps two sets of variables - chat-local and global,
 * where a global outlives the conversation - and they are separate stores under similar names.
 * Guarding a global append with a chat-local read would test a variable that is always empty, so
 * every append would take the first-item branch and the list would never join.
 */
function cleanedVariable(valueArg: string): { name: string; global: boolean } | null {
  const match = /^\s*\{\{get(global)?var::([A-Za-z_]\w*)\}\}\s*$/.exec(valueArg);
  return match ? { name: match[2]!, global: Boolean(match[1]) } : null;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Every append to this variable IN ITS OWN SCOPE, with the value it appends. */
function appendsTo(text: string, variable: string, global: boolean): { token: string; value: string }[] {
  const wanted = global ? "addglobalvar" : "addvar";
  const out: { token: string; value: string }[] = [];
  for (const token of scanMacroTokens(text)) {
    if (macroName(token) !== wanted) continue;
    const parts = splitArgs(token.slice(2, -2));
    if (parts[1]?.trim() !== variable) continue;
    out.push({ token, value: parts.slice(2).join("::") });
  }
  return out;
}

/** The longest common prefix of every appended value, which is the separator they share. */
function sharedSeparator(values: readonly string[]): string {
  if (values.length === 0) return "";
  let prefix = values[0]!;
  for (const value of values.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < value.length && prefix[i] === value[i]) i += 1;
    prefix = prefix.slice(0, i);
    if (prefix.length === 0) break;
  }
  return prefix;
}

/**
 * Repair the producers behind every inline cleanup macro that can be traced to one.
 *
 * Works one prompt block at a time, because a value assembled in one block and cleaned in another is
 * a different problem: the guard would have to know the block order, which is not this function's to
 * assume. Those are reported unfixed.
 */
export function fixProducers(body: unknown): ProducerRepair {
  const copy = structuredClone(body) as { prompts?: unknown } | null;
  const prompts = copy?.prompts;
  if (!Array.isArray(prompts)) return { body: copy, fixes: [], unfixed: [] };

  const fixes: ProducerFix[] = [];
  const unfixed: UnfixedCleanup[] = [];

  for (const prompt of prompts) {
    if (!isRecord(prompt) || typeof prompt["content"] !== "string") continue;
    let content = prompt["content"];
    const where = typeof prompt["name"] === "string" ? prompt["name"] : String(prompt["id"] ?? "block");

    for (const cleanup of scanMacroTokens(content)) {
      if (macroName(cleanup) !== "regex") continue;
      const [, valueArg, pattern, ...rest] = splitArgs(cleanup.slice(2, -2));
      const replacement = rest.join("::");
      const target = cleanedVariable(valueArg ?? "");
      const variable = target?.name;
      const global = target?.global ?? false;
      const get = global ? "getglobalvar" : "getvar";
      const set = global ? "setglobalvar" : "setvar";

      if (!variable || replacement.trim().length > 0) {
        unfixed.push({
          cleanup,
          where,
          reason: variable
            ? "the cleanup replaces the match with text rather than removing it, so it is a rewrite "
              + "rather than a separator the producer should not have emitted"
            : "the cleaned value is not a plain variable read, so there is no single producer to fix",
        });
        continue;
      }

      const appends = appendsTo(content, variable, global);
      const separator = sharedSeparator(appends.map((a) => a.value));
      if (appends.length === 0 || !stripsSeparator(pattern ?? "", separator)) {
        unfixed.push({
          cleanup,
          where,
          reason: appends.length === 0
            ? `nothing in this block appends to "${variable}", so the producer is elsewhere`
            : `the pattern does not plainly strip the separator "${separator}" those appends share`,
        });
        continue;
      }

      // Guard each append so the separator is only added when there is already something to join to.
      for (const append of appends) {
        const first = append.value.slice(separator.length);
        const guarded =
          `{{if {{${get}::${variable}}}}}${append.token}`
          + `{{else}}{{${set}::${variable}::${first}}}{{/if}}`;
        content = content.replace(append.token, guarded);
      }

      // The cleanup is now repairing nothing. Remove the whole assignment when it exists only to
      // hold this macro, so no empty write is left behind to clear the variable.
      const wrapper = `{{${set}::${variable}::${cleanup}}}`;
      content = content.includes(wrapper)
        ? content.replace(wrapper, "")
        : content.replace(cleanup, `{{${get}::${variable}}}`);

      fixes.push({ variable, separator, cleanup, guarded: appends.length, where });
    }

    prompt["content"] = content;
  }

  return { body: copy, fixes, unfixed };
}
