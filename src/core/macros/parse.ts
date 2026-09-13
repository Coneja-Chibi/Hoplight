/**
 * The macro parser: a span-carrying port of VAUDEVILLE's clean-room `parseNodesV2`
 * (apps/rc/src/lib/macros/tokenizer.ts), per specs/engine/macro-engine.md stage 1.
 *
 * Two deliberate differences from the reference, neither behavioral:
 *  - Every node carries `start`/`end` offsets into the parsed text. The reference parses string
 *    slices recursively and forgets where they came from; this port parses WINDOWS of one string
 *    ([from, to) ranges), which is the same grammar with provenance kept. The editable preview
 *    is built on these spans, so they are load-bearing, not decoration.
 *  - Classification, brace pair-scan, arg splitting, block terminators, malformed-block
 *    degradation, and the never-floored negative depth quirk follow the reference exactly
 *    (spec edge cases 1-7 are the contract; the tests pin them).
 */

export interface TextNode {
  type: "text";
  value: string;
  start: number;
  end: number;
}
export interface MacroCallNode {
  type: "macro";
  name: string;
  rawContent: string;
  args: ASTNode[][];
  start: number;
  end: number;
}
export interface BlockIfNode {
  type: "blockIf";
  condition: ASTNode[];
  thenBranch: ASTNode[];
  elseBranch: ASTNode[];
  start: number;
  end: number;
}
export interface BlockSetvarNode {
  type: "blockSetvar";
  varName: ASTNode[];
  scope: "local" | "global";
  content: ASTNode[];
  start: number;
  end: number;
}
export interface BlockTrimNode {
  type: "blockTrim";
  content: ASTNode[];
  start: number;
  end: number;
}
export type ASTNode = TextNode | MacroCallNode | BlockIfNode | BlockSetvarNode | BlockTrimNode;

/** Pair-scan: index of the first `}` of the `}}` closing the `{{` at openPos, or -1. */
export function lexMatchingClose(text: string, openPos: number, to: number): number {
  let depth = 0;
  let i = openPos;
  while (i < to - 1) {
    if (text[i] === "{" && text[i + 1] === "{") {
      depth++;
      i += 2;
    } else if (text[i] === "}" && text[i + 1] === "}") {
      depth--;
      if (depth === 0) return i;
      i += 2;
    } else {
      i++;
    }
  }
  return -1;
}

/**
 * Split [from, to) on `::` at brace-depth 0 into absolute ranges. The depth counter is never
 * floored (spec edge case 6): a stray `}}` drives it negative and later `::` stay invisible
 * until braces rebalance. Preserved exactly; "fixing" it changes real template behavior.
 */
export function lexSplitArgRanges(
  text: string,
  from: number,
  to: number,
): { start: number; end: number }[] {
  const parts: { start: number; end: number }[] = [];
  let depth = 0;
  let partStart = from;
  for (let i = from; i < to; i++) {
    if (text[i] === "{" && i + 1 < to && text[i + 1] === "{") {
      depth++;
      i++;
    } else if (text[i] === "}" && i + 1 < to && text[i + 1] === "}") {
      depth--;
      i++;
    } else if (text[i] === ":" && i + 1 < to && text[i + 1] === ":" && depth === 0) {
      parts.push({ start: partStart, end: i });
      partStart = i + 2;
      i++;
    }
  }
  parts.push({ start: partStart, end: to });
  return parts;
}

const trimRange = (
  text: string,
  start: number,
  end: number,
): { start: number; end: number } => {
  let a = start;
  let b = end;
  while (a < b && /\s/.test(text.charAt(a))) a++;
  while (b > a && /\s/.test(text.charAt(b - 1))) b--;
  return { start: a, end: b };
};

const TRIM_CLOSE_TAG = "{{/trim}}";

/** Colon-form `{{if::...}}` opens a block only when the content after `if::` is a single arg. */
const isColonBlockIfOpen = (text: string, afterIf: number, innerEnd: number): boolean =>
  lexSplitArgRanges(text, afterIf, innerEnd).length === 1;

/** Block terminator at depth 0, honoring the inline-vs-block setvar desync guard. */
function findBlockTerminator(text: string, startPos: number, to: number, closeTag: string): number {
  const openTag =
    closeTag === "{{/setvar}}"
      ? "{{setvar::"
      : closeTag === TRIM_CLOSE_TAG
        ? "{{trim}}"
        : "{{setglobalvar::";

  const opensBlock = (openIdx: number): boolean => {
    if (!openTag.endsWith("::")) return true; // trim: every occurrence opens
    const macroClose = text.indexOf("}}", openIdx + openTag.length);
    if (macroClose === -1 || macroClose >= to) return true;
    return !text.slice(openIdx + openTag.length, macroClose).includes("::");
  };

  let depth = 1;
  let pos = startPos;
  const lower = text.toLowerCase();
  const openLower = openTag.toLowerCase();
  const closeLower = closeTag.toLowerCase();
  while (pos < to) {
    const nextOpen = lower.indexOf(openLower, pos);
    const nextClose = lower.indexOf(closeLower, pos);
    if (nextClose === -1 || nextClose >= to) return -1;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      if (opensBlock(nextOpen)) depth++;
      pos = nextOpen + openTag.length;
    } else {
      depth--;
      if (depth === 0) return nextClose;
      pos = nextClose + closeTag.length;
    }
  }
  return -1;
}

/** Parse a block-if; cond is an absolute range. Returns null when malformed (no `{{/if}}`). */
function parseBlockIf(
  text: string,
  condStart: number,
  condEnd: number,
  headStart: number,
  bodyStart: number,
  to: number,
): { node: BlockIfNode; endPos: number } | null {
  let depth = 1;
  let pos = bodyStart;
  let elsePos = -1;

  while (pos < to && depth > 0) {
    const nextOpen = text.indexOf("{{", pos);
    if (nextOpen === -1 || nextOpen >= to) break;
    const closeMatch = lexMatchingClose(text, nextOpen, to);
    if (closeMatch === -1) break;

    const inner = trimRange(text, nextOpen + 2, closeMatch);
    const rawTag = text.slice(inner.start, inner.end);
    const tagContent = rawTag.toLowerCase();
    const afterTag = closeMatch + 2;

    if (
      (/^if\s/.test(tagContent) && !/^if::/.test(tagContent)) ||
      /^#if\s/.test(tagContent) ||
      (/^if::/.test(tagContent) && isColonBlockIfOpen(text, inner.start + 4, inner.end))
    ) {
      depth++;
    } else if (
      tagContent === "/if" ||
      tagContent === "endif" ||
      tagContent === "/#if" ||
      tagContent === "//if"
    ) {
      depth--;
      if (depth === 0) {
        const thenEnd = elsePos === -1 ? nextOpen : elsePos;
        return {
          node: {
            type: "blockIf",
            condition: parseRange(text, condStart, condEnd),
            thenBranch: parseRange(text, bodyStart, thenEnd),
            elseBranch: elsePos === -1 ? [] : parseRange(text, elsePos, nextOpen),
            start: headStart,
            end: afterTag,
          },
          endPos: afterTag,
        };
      }
    } else if (depth === 1 && elsePos === -1 && /^else\s+if(::|\s)/.test(tagContent)) {
      const sepMatch = /^else\s+if(::|\s)/.exec(tagContent);
      if (sepMatch) {
        const innerCond = trimRange(text, inner.start + sepMatch[0].length, inner.end);
        const nested = parseBlockIf(text, innerCond.start, innerCond.end, nextOpen, afterTag, to);
        if (!nested) return null;
        return {
          node: {
            type: "blockIf",
            condition: parseRange(text, condStart, condEnd),
            thenBranch: parseRange(text, bodyStart, nextOpen),
            elseBranch: [nested.node],
            start: headStart,
            end: nested.endPos,
          },
          endPos: nested.endPos,
        };
      }
    } else if (tagContent === "else" && depth === 1 && elsePos === -1) {
      elsePos = afterTag;
    }
    pos = afterTag;
  }
  return null;
}

/** Parse the window [from, to) into nodes carrying absolute spans. */
export function parseRange(text: string, from: number, to: number): ASTNode[] {
  const nodes: ASTNode[] = [];
  let pos = from;

  while (pos < to) {
    let openIdx = text.indexOf("{{", pos);
    if (openIdx !== -1 && openIdx >= to) openIdx = -1;
    if (openIdx === -1) {
      nodes.push({ type: "text", value: text.slice(pos, to), start: pos, end: to });
      break;
    }
    if (openIdx > pos) {
      nodes.push({ type: "text", value: text.slice(pos, openIdx), start: pos, end: openIdx });
    }
    const closeIdx = lexMatchingClose(text, openIdx, to);
    if (closeIdx === -1) {
      nodes.push({ type: "text", value: text.slice(openIdx, to), start: openIdx, end: to });
      break;
    }

    const innerStart = openIdx + 2;
    const afterClose = closeIdx + 2;
    const inner = trimRange(text, innerStart, closeIdx);
    const trimmedInner = text.slice(inner.start, inner.end);
    const lowerTrimmed = trimmedInner.toLowerCase();

    // (1) Block-if, space/hash form.
    const isBlockIf =
      (/^if\s/i.test(trimmedInner) && !/^if::/i.test(trimmedInner)) ||
      /^#if\s/i.test(trimmedInner);
    if (isBlockIf) {
      const skip = /^#if\s/i.test(trimmedInner) ? 3 : 2;
      const cond = trimRange(text, inner.start + skip, inner.end);
      const blockResult = parseBlockIf(text, cond.start, cond.end, openIdx, afterClose, to);
      if (blockResult) {
        nodes.push(blockResult.node);
        pos = blockResult.endPos;
        continue;
      }
      nodes.push({
        type: "text",
        value: text.slice(openIdx, afterClose),
        start: openIdx,
        end: afterClose,
      });
      pos = afterClose;
      continue;
    }

    // (2) Block-if, colon form (single-arg only); no closer -> fall through to inline.
    if (/^if::/i.test(trimmedInner) && isColonBlockIfOpen(text, inner.start + 4, inner.end)) {
      const cond = trimRange(text, inner.start + 4, inner.end);
      const blockResult = parseBlockIf(text, cond.start, cond.end, openIdx, afterClose, to);
      if (blockResult) {
        nodes.push(blockResult.node);
        pos = blockResult.endPos;
        continue;
      }
    }

    // (3) Block-trim.
    if (lowerTrimmed === "trim") {
      const blockCloseIdx = findBlockTerminator(text, afterClose, to, TRIM_CLOSE_TAG);
      if (blockCloseIdx !== -1) {
        const endPos = blockCloseIdx + TRIM_CLOSE_TAG.length;
        nodes.push({
          type: "blockTrim",
          content: parseRange(text, afterClose, blockCloseIdx),
          start: openIdx,
          end: endPos,
        });
        pos = endPos;
        continue;
      }
    }

    // (4) Block-setvar / block-setglobalvar (single-arg name only).
    if (/^setvar::/i.test(trimmedInner) || /^setglobalvar::/i.test(trimmedInner)) {
      const isGlobal = /^setglobalvar::/i.test(trimmedInner);
      const closeTag = isGlobal ? "{{/setglobalvar}}" : "{{/setvar}}";
      const prefixLen = isGlobal ? "setglobalvar::".length : "setvar::".length;
      const argRanges = lexSplitArgRanges(text, inner.start + prefixLen, inner.end);
      const soleArg = argRanges.length === 1 ? argRanges[0] : undefined;
      if (soleArg) {
        const blockCloseIdx = findBlockTerminator(text, afterClose, to, closeTag);
        if (blockCloseIdx !== -1) {
          const name = trimRange(text, soleArg.start, soleArg.end);
          const endPos = blockCloseIdx + closeTag.length;
          nodes.push({
            type: "blockSetvar",
            varName: parseRange(text, name.start, name.end),
            scope: isGlobal ? "global" : "local",
            content: parseRange(text, afterClose, blockCloseIdx),
            start: openIdx,
            end: endPos,
          });
          pos = endPos;
          continue;
        }
      }
    }

    // (5) Orphan terminators: consumed, no node.
    if (
      lowerTrimmed === "/if" ||
      lowerTrimmed === "endif" ||
      lowerTrimmed === "/#if" ||
      lowerTrimmed === "//if" ||
      lowerTrimmed === "else" ||
      /^else\s+if(::|\s)/i.test(trimmedInner) ||
      lowerTrimmed === "/trim" ||
      lowerTrimmed === "/setvar" ||
      lowerTrimmed === "/setglobalvar"
    ) {
      pos = afterClose;
      continue;
    }

    // (6) Comment: name '//', body ONE unsplit arg (a `::` inside stays whole).
    if (trimmedInner.startsWith("//")) {
      const body = trimRange(text, inner.start + 2, inner.end);
      nodes.push({
        type: "macro",
        name: "//",
        rawContent: text.slice(innerStart, closeIdx),
        args:
          body.end > body.start
            ? [[{ type: "text", value: text.slice(body.start, body.end), start: body.start, end: body.end }]]
            : [],
        start: openIdx,
        end: afterClose,
      });
      pos = afterClose;
      continue;
    }

    // (7) Inline macro: name = arg0 trimmed+lowercased; args parsed recursively, untrimmed.
    const argRanges = lexSplitArgRanges(text, innerStart, closeIdx);
    const head = argRanges[0] ?? { start: innerStart, end: closeIdx };
    const name0 = trimRange(text, head.start, head.end);
    const macroArgs: ASTNode[][] = [];
    for (const range of argRanges.slice(1)) {
      macroArgs.push(parseRange(text, range.start, range.end));
    }
    nodes.push({
      type: "macro",
      name: text.slice(name0.start, name0.end).toLowerCase(),
      rawContent: text.slice(innerStart, closeIdx),
      args: macroArgs,
      start: openIdx,
      end: afterClose,
    });
    pos = afterClose;
  }
  return nodes;
}

/** Universal, context-free: normalized text -> AST with spans. */
export const parseMacroNodes = (text: string): ASTNode[] => parseRange(text, 0, text.length);
