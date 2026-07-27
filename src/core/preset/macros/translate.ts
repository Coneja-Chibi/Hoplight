/**
 * Convert a preset's macro text from one engine's dialect to another's.
 *
 * This TRANSLATES. It does not merely report. A conversion that refuses because one token has no
 * perfect twin is not honesty, it is an unfinished job: the caller asked for a preset they can load
 * somewhere else, and prose they authored is worth more than a macro that was never going to fire.
 * So every input produces an output, and every change is recorded with a reason.
 *
 * Two passes, in this order, because the second depends on the first:
 *
 * 1. BLOCK FLATTENING. SillyTavern has no conditional macros at all, so a RoleCall
 *    `{{if cond}}body{{/if}}` cannot survive as a block. Flattening KEEPS THE BODY and drops the
 *    scaffolding: rendering authored text unconditionally is recoverable, silently deleting it is
 *    not. The dropped condition is preserved as a `{{// ...}}` comment, which SillyTavern does
 *    support, so the artifact documents its own losses instead of the receipt being the only record.
 *
 * 2. TOKEN TRANSLATION. Each remaining token is resolved through the canonical op hub in
 *    ./equivalence.ts. There is no engine-pair table: each catalog declares what its own macros
 *    mean, and the crossing is a join on that meaning.
 *
 * NOTHING IS EVALUATED. This rewrites text into text. It does not resolve a macro, and so does not
 * depend on ADR-012.
 */
import type { PresetWriteForProfile } from "../capabilities";
import { macroName, matchingClose } from "./support";
import { equivalentOf } from "./equivalence";

/**
 * What happened to one macro. These come from the canonical op join in ./equivalence.ts, never from
 * a hand-written engine pair.
 *
 *   flatten   a block construct the target cannot express; body kept, scaffolding removed
 *   same      both engines spell it identically; untouched
 *   rewrite   both perform the operation; re-spelled in the target's punctuation
 *   collision same NAME, different operation. Left as authored and flagged, never silently kept
 *   absent    no engine-side equivalent; removed, with same-family candidates when any exist
 */
export type MacroChangeKind = "flatten" | "same" | "rewrite" | "collision" | "absent";

/** One recorded change, so nothing about the conversion is invisible. */
export interface MacroChange {
  kind: MacroChangeKind;
  /** The original token, or the block opener for a flatten. */
  from: string;
  /** What replaced it; null when it was removed. */
  to: string | null;
  where: string;
  why: string;
  /** Present when a person or model should pick a better answer than the default. */
  candidates?: string[];
}

export interface TextTranslation {
  text: string;
  changes: MacroChange[];
}

const COLLISION_NOTE = "left unchanged and flagged; it must be reviewed before use";

/** Split a tag's inner content on `::` at brace depth zero, so nested macros stay whole. */
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
 * The condition text of a block opener, safe to place inside a `{{// ...}}` comment.
 *
 * Braces are stripped rather than escaped: a comment body still containing `{{` would re-enter the
 * target's own parser and could break the very file this is trying to keep loadable. The reader
 * still gets the condition; they just get it as plain words.
 */
function conditionOf(inner: string): string {
  return inner
    .replace(/^[#!?~>]/, "")
    .replace(/^\s*(if|unless|foreach|each)\b\s*(?:::|:)?\s*/i, "")
    .replaceAll("{{", "")
    .replaceAll("}}", "")
    .replaceAll("}", "")
    .replaceAll("{", "")
    .trim();
}

const isBlockOpener = (name: string, inner: string): boolean =>
  (name === "if" || name === "unless" || name === "foreach" || name === "each")
  && !/^\s*if::[^:]*::/.test(inner); // {{if::c::then::else}} is the INLINE ternary, not a block

/**
 * Pass 1: collapse block constructs to their body.
 *
 * Handles `{{if ...}}`, `{{#if ...}}`, `{{unless ...}}`, `{{foreach ...}}` and their `{{/name}}`
 * closers, with `{{else}}` splitting branches. The taken branch is the FIRST one, because with no
 * condition evaluator there is no basis to choose another, and the first is what the author wrote
 * as the ordinary case.
 */
export function flattenBlocks(text: string, where: string, changes: MacroChange[]): string {
  let out = "";
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf("{{", index);
    if (open === -1) { out += text.slice(index); break; }
    const close = matchingClose(text, open);
    if (close === -1) { out += text.slice(index); break; }

    const token = text.slice(open, close + 2);
    const inner = token.slice(2, -2).trim();
    const bare = inner.replace(/^[#!?~>]/, "");
    const name = macroName(`{{${bare}}}`);
    out += text.slice(index, open);

    if (!isBlockOpener(name, inner)) {
      out += token;
      index = close + 2;
      continue;
    }

    const closer = findCloser(text, close + 2, name);
    if (closer === null) {
      // No terminator: not a block after all. Leave it for pass 2 to judge.
      out += token;
      index = close + 2;
      continue;
    }
    const body = text.slice(close + 2, closer.start);
    const branch = firstBranch(body);
    const condition = conditionOf(inner);

    changes.push({
      kind: "flatten",
      from: token,
      to: null,
      where,
      why:
        `The target engine has no ${name} block, so the block was flattened and its body kept. `
        + (condition ? `The condition "${condition}" is no longer applied.` : "")
        + " Review whether this text should always be present.",
    });

    out += condition ? `{{// was ${name}: ${condition}}}` : "";
    out += flattenBlocks(branch, where, changes);
    index = closer.end;
  }
  return out;
}

/** Locate the `{{/name}}` that closes a block opened before `from`, honouring nesting. */
function findCloser(text: string, from: string | number, name: string): { start: number; end: number } | null {
  let depth = 0;
  let index = typeof from === "number" ? from : 0;
  while (index < text.length) {
    const open = text.indexOf("{{", index);
    if (open === -1) return null;
    const close = matchingClose(text, open);
    if (close === -1) return null;
    const inner = text.slice(open + 2, close).trim();
    const bare = inner.replace(/^[#!?~>]/, "");
    if (bare.startsWith("/")) {
      const closing = macroName(`{{${bare.slice(1)}}}`);
      if (closing === name) {
        if (depth === 0) return { start: open, end: close + 2 };
        depth -= 1;
      }
    } else if (isBlockOpener(macroName(`{{${bare}}}`), inner)) {
      depth += 1;
    }
    index = close + 2;
  }
  return null;
}

/** The text before the first depth-zero `{{else}}`. */
function firstBranch(body: string): string {
  let index = 0;
  while (index < body.length) {
    const open = body.indexOf("{{", index);
    if (open === -1) break;
    const close = matchingClose(body, open);
    if (close === -1) break;
    const inner = body.slice(open + 2, close).trim().replace(/^[#!?~>]/, "");
    if (/^else\b/i.test(inner)) return body.slice(0, open);
    index = close + 2;
  }
  return body;
}

/** Pass 2: translate each remaining token for the target engine. */
export function translateTokens(
  text: string,
  from: PresetWriteForProfile,
  to: PresetWriteForProfile,
  where: string,
  changes: MacroChange[],
): string {
  let out = "";
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf("{{", index);
    if (open === -1) { out += text.slice(index); break; }
    const close = matchingClose(text, open);
    if (close === -1) { out += text.slice(index); break; }

    const token = text.slice(open, close + 2);
    out += text.slice(index, open);
    out += translateOne(token, from, to, where, changes);
    index = close + 2;
  }
  return out;
}

function translateOne(
  token: string,
  from: PresetWriteForProfile,
  to: PresetWriteForProfile,
  where: string,
  changes: MacroChange[],
): string {
  const inner = token.slice(2, -2);
  const name = macroName(token);
  // Comments, dot-locals and flag-only forms invoke nothing; leave them exactly as authored.
  if (!name) return token;

  const args = splitArgs(inner).slice(1);
  const match = equivalentOf(from, to, name, args);

  if (match.verdict === "portable") {
    // Identical spelling on both sides: nothing to change and nothing worth reporting.
    if (!match.rewritten || match.rewritten === token) return token;
    changes.push({ kind: "rewrite", from: token, to: match.rewritten, where, why: match.why });
    return match.rewritten;
  }

  if (match.verdict === "collision") {
    changes.push({
      kind: "collision",
      from: token,
      to: token,
      where,
      why: `${match.why} It was ${COLLISION_NOTE}.`,
      ...(match.candidates.length ? { candidates: match.candidates } : {}),
    });
    return token;
  }

  changes.push({
    kind: "absent",
    from: token,
    to: null,
    where,
    why: match.candidates.length
      ? `${match.why} Removed; one of these may fit instead.`
      : `${match.why} Removed, since it would otherwise stay literal text.`,
    ...(match.candidates.length ? { candidates: match.candidates } : {}),
  });
  return "";
}

export interface PresetTranslation {
  /** A deep copy with translated prompt content. The input is never mutated. */
  body: unknown;
  changes: MacroChange[];
}

/**
 * Translate every prompt block in a preset body. Returns a copy: the stored canonical entity is the
 * user's authored work and an export must never edit it in place.
 */
export function translatePresetBody(
  body: unknown,
  from: PresetWriteForProfile,
  to: PresetWriteForProfile,
): PresetTranslation {
  const copy = structuredClone(body) as { prompts?: unknown } | null;
  const changes: MacroChange[] = [];
  const prompts = copy?.prompts;
  if (!Array.isArray(prompts)) return { body: copy, changes };

  prompts.forEach((prompt, index) => {
    const row = prompt as { content?: unknown; name?: unknown; id?: unknown };
    if (typeof row.content !== "string" || row.content.length === 0) return;
    const where = typeof row.name === "string" && row.name
      ? row.name
      : typeof row.id === "string" && row.id
        ? row.id
        : `block ${index}`;
    const result = translateText(row.content, from, to, where);
    row.content = result.text;
    changes.push(...result.changes);
  });
  return { body: copy, changes };
}

/** Translate one chunk of prompt text: flatten blocks, then translate what remains. */
export function translateText(
  text: string,
  from: PresetWriteForProfile,
  to: PresetWriteForProfile,
  where = "text",
): TextTranslation {
  const changes: MacroChange[] = [];
  const flattened = flattenBlocks(text, where, changes);
  return { text: translateTokens(flattened, from, to, where, changes), changes };
}
