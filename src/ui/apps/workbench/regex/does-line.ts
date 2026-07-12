/**
 * doesLine - the computed plain-language "does what" line under each rule name (REGEX-JEWEL-PLAN.md
 * QOL 18, the lorebook firesLine sibling). NEVER stored: assembled fresh from the rule's own fields
 * every render, so it can never drift from what the rule actually does. Tolerant by construction -
 * an empty or unreadable pattern yields a plain honest line, never a throw.
 *
 * It leans on the builder's explainPattern for the "finds ..." clause: when the pattern is exactly
 * the words-builder shape we can name the words as whole words; otherwise we say "matches its
 * pattern" rather than guess. The replace and phase clauses are pure field reads.
 */
import type { RegexPhase, RegexRule } from "../../../../entities/regex/schema";
import { explainPattern } from "../../../../core/regex";

const PHASE_WORDS: Record<string, string> = {
  input: "the user's words",
  output: "the model's reply",
  request: "the outgoing request",
  display: "the display",
  prompt: "the prompt",
  lorebook: "lorebook text",
  reasoning: "the reasoning",
  slash: "slash commands",
  memory: "memory",
};

const phaseWord = (phase: RegexPhase): string => PHASE_WORDS[phase] ?? String(phase);

/** Join a list into plain prose: "a", "a and b", "a, b, or c" (conjunction picks and/or). */
function joinList(parts: readonly string[], conj: "and" | "or"): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} ${conj} ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, ${conj} ${parts.at(-1)}`;
}

const trunc = (text: string, max = 32): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

/** The "finds ..." clause, honest about what the words vocabulary can prove. */
function findClause(rule: RegexRule): string {
  const explained = explainPattern(rule.find, rule.flags);
  if (explained.complete && explained.phrases.length > 0) {
    const quoted = explained.phrases.map((p) => `"${p}"`);
    return `finds ${joinList(quoted, "or")} as whole words`;
  }
  return "matches its pattern";
}

/** The replace clause: an empty replacement removes the match, else it swaps in the given text. */
function replaceClause(rule: RegexRule): string {
  const to = rule.replace.trim();
  if (to === "") return "removes it";
  return `swaps it for "${trunc(rule.replace)}"`;
}

/** The where-it-runs clause from the rule's phases. */
function phaseClause(rule: RegexRule): string {
  if (rule.phases.length === 0) return "";
  const words = rule.phases.map(phaseWord);
  return `in ${joinList(words, "and")}`;
}

/**
 * One plain sentence describing what the rule does. Used in the TOC row and the page masthead.
 * Off rules lead with their state; patternless rules say so plainly.
 */
export function doesLine(rule: RegexRule): string {
  const off = rule.enabled ? "" : "off · ";
  if (rule.find.trim() === "") {
    return `${off}no pattern yet - add one to start matching`;
  }
  const clauses = [findClause(rule), "and", replaceClause(rule)];
  const where = phaseClause(rule);
  const sentence = where ? `${clauses.join(" ")}, ${where}` : clauses.join(" ");
  return `${off}${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`;
}
