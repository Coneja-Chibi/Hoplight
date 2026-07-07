// ============================================================================
// MACRO TOKENIZER (clean-room v2 parser)
// ============================================================================
// A real lexer -> parser that REPLACES the index-scanning parseNodes step from
// processor.ts, producing the IDENTICAL ASTNode[]. Built ALONGSIDE the old
// parser (parseNodes stays the source of truth until this is gated in).
//
// SCOPE (v1): this replaces ONLY the post-preprocessing parse step. It receives
// the SAME already-preprocessed text parseNodes gets (escaped braces hidden as
// sentinels, dot/dollar/space/single-colon already normalized) and must return
// the SAME tree. Preprocessing passes are NOT folded in here.
//
// DESIGN
//   Stage 1 (lexer / scanMacroTokens): turn the flat character stream into a
//   token stream using RC's OWN brace/`::` semantics. The token vocabulary is
//   RC-native: TEXT, OPEN ('{{'), CLOSE ('}}'), SEP ('::' at brace-depth 0).
//   The lexer reproduces findMatchingClose's pair-scan EXACTLY:
//     - a lone '{' or '}' (not doubled) is an ordinary text character (advance 1)
//     - only '{{' / '}}' move brace depth; '{{' opens, '}}' closes
//     - the close that matches an open is the FIRST '}' of the '}}' that returns
//       depth to 0 (so '{{{char}}}' => inner content is '{char', the leading
//       lone '{' folds into the name; '{{{{char}}}}' => content is '{{char}}')
//   A macro tag is emitted as OPEN, its raw inner content (verbatim, untrimmed),
//   then CLOSE. The lexer ALSO records, per tag, the depth-0 `::` split points
//   so the parser can recover args without re-scanning (mirrors splitMacroArgs:
//   `::` only splits at brace depth 0, never inside a nested '{{ }}').
//
//   Stage 2 (parser / parseTokens): consume the token stream and apply RC's
//   first-match classification cascade (the exact order parseNodes uses):
//     1. block-if   (space/hash form: `if `/`#if `, not `if::`)
//     2. block-if   (colon form: `if::COND` with EXACTLY one arg + a {{/if}})
//     3. block-trim (bare `trim` + a {{/trim}})
//     4. block-setvar / block-setglobalvar (single-arg name + matching close)
//     5. orphan terminators (silently consumed -> no node)
//     6. comment    (inner trimmed starts with '//', body is ONE unsplit arg)
//     7. inline macro (name = arg0 trimmed+lowercased; args = rest, recursive)
//   Unmatched '{{' at EOF, malformed blocks, etc. degrade to text EXACTLY as
//   parseNodes does (head-becomes-text / fall-through-to-inline).
//
// Everything here is derived from processor.ts's parseNodes + helpers and the
// characterization corpus. No third-party lexer/parser was consulted.
// ============================================================================

import type { ASTNode, BlockIfNode } from './processor';

// ============================================================================
// LEXER
// ============================================================================

/**
 * A scanned macro tag: the span of one `{{ ... }}` in the source, with the
 * verbatim (UN-trimmed) inner content and the depth-0 `::` split offsets
 * (positions WITHIN inner, exclusive of the `::` themselves).
 */
interface MacroTag {
  /** index of the first `{` of the opening `{{` */
  openPos: number;
  /** index of the first `}` of the matching `}}` (findMatchingClose result) */
  closePos: number;
  /** index just past the matching `}}` (closePos + 2) */
  afterClose: number;
  /** verbatim inner text: source.slice(openPos + 2, closePos) — NOT trimmed */
  rawContent: string;
}

/**
 * Find the position of the `}}` that closes the `{{` starting at `openPos`.
 * `openPos` points to the first `{` of the opening `{{`. Returns the index of
 * the first `}` of the matching `}}`, or -1 if unmatched.
 *
 * Pair-scan semantics (derived from parseNodes.findMatchingClose):
 *   - a lone `{`/`}` is ordinary (advance 1)
 *   - `{{` increments depth (+2), `}}` decrements depth (+2)
 *   - the first `}}` returning depth to 0 is the match (its first `}` index)
 */
function lexMatchingClose(text: string, openPos: number): number {
  let depth = 0;
  let i = openPos;
  while (i < text.length - 1) {
    if (text[i] === '{' && text[i + 1] === '{') {
      depth++;
      i += 2;
    } else if (text[i] === '}' && text[i + 1] === '}') {
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
 * Split a macro tag's inner content on `::` at brace-depth 0 only (not inside
 * nested `{{ }}`). Mirrors splitMacroArgs EXACTLY — including the quirk that a
 * lone `{`/`}` does not affect depth (only `{{`/`}}` do) and that the depth
 * counter is never floored at 0 (so a stray `}}` makes depth negative, after
 * which a `::` at "depth 0" can never be hit again until balance is restored).
 */
function lexSplitArgs(content: string): string[] {
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
    } else if (
      content[i] === ':' &&
      i + 1 < content.length &&
      content[i + 1] === ':' &&
      depth === 0
    ) {
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
// PARSER
// ============================================================================

const TRIM_CLOSE_TAG = '{{/trim}}';

/**
 * Is `{{if::...}}` content a colon-form BLOCK-if opener? Only the single-arg
 * form qualifies (`{{if::cond::then}}` etc. is the inline conditional macro).
 * `tagContent` is the trimmed inner content (starts with `if::`).
 */
function isColonBlockIfOpen(tagContent: string): boolean {
  return lexSplitArgs(tagContent.slice(4)).length === 1;
}

/**
 * Find a block terminator tag (e.g. `{{/setvar}}`) at block depth 0, starting
 * from `startPos`. Respects nested blocks of the same type. Mirrors
 * findBlockTerminator EXACTLY (case-insensitive tag search; the single-arg
 * desync guard for setvar/setglobalvar openers; trim's every-match-opens rule).
 */
function findBlockTerminator(text: string, startPos: number, closeTag: string): number {
  const openTag =
    closeTag === '{{/setvar}}'
      ? '{{setvar::'
      : closeTag === TRIM_CLOSE_TAG
        ? '{{trim}}'
        : '{{setglobalvar::';

  const opensBlock = (openIdx: number): boolean => {
    if (!openTag.endsWith('::')) return true; // trim — every match is a block open
    const macroClose = text.indexOf('}}', openIdx + openTag.length);
    if (macroClose === -1) return true;
    const inner = text.slice(openIdx + openTag.length, macroClose);
    return !inner.includes('::'); // a second `::` means it's the inline form
  };

  let depth = 1;
  let pos = startPos;
  const lower = text.toLowerCase();
  const openLower = openTag.toLowerCase();
  const closeLower = closeTag.toLowerCase();

  while (pos < text.length) {
    const nextOpen = lower.indexOf(openLower, pos);
    const nextClose = lower.indexOf(closeLower, pos);

    if (nextClose === -1) return -1;

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

/**
 * Parse a block-if construct. `condContent` is the condition text (after the
 * `if`/`#if`/`if::` head). `bodyStart` is where the body begins (just past the
 * closing `}}` of the head). Returns the BlockIfNode and the position after the
 * matching `{{/if}}`, or null if malformed. Mirrors parseBlockIf EXACTLY,
 * including the {{else}}/{{else if}}/{{/if}} depth-0 scan and the else-if
 * recursion that nests a BlockIfNode in the parent's else branch.
 */
function parseBlockIf(
  condContent: string,
  text: string,
  bodyStart: number
): { node: BlockIfNode; endPos: number } | null {
  let depth = 1;
  let pos = bodyStart;
  let elsePos = -1;

  while (pos < text.length && depth > 0) {
    const nextOpen = text.indexOf('{{', pos);
    if (nextOpen === -1) break;

    const closeMatch = lexMatchingClose(text, nextOpen);
    if (closeMatch === -1) break;

    const rawTag = text.slice(nextOpen + 2, closeMatch).trim();
    const tagContent = rawTag.toLowerCase();
    const afterTag = closeMatch + 2;

    if (
      (/^if\s/.test(tagContent) && !/^if::/.test(tagContent)) ||
      /^#if\s/.test(tagContent) ||
      (/^if::/.test(tagContent) && isColonBlockIfOpen(rawTag))
    ) {
      depth++;
    } else if (
      tagContent === '/if' ||
      tagContent === 'endif' ||
      tagContent === '/#if' ||
      tagContent === '//if'
    ) {
      depth--;
      if (depth === 0) {
        const thenText =
          elsePos === -1 ? text.slice(bodyStart, nextOpen) : text.slice(bodyStart, elsePos);
        const elseText = elsePos === -1 ? '' : text.slice(elsePos, nextOpen);

        return {
          node: {
            type: 'blockIf',
            condition: parseNodesV2(condContent),
            thenBranch: parseNodesV2(thenText),
            elseBranch: parseNodesV2(elseText),
          },
          endPos: afterTag,
        };
      }
    } else if (depth === 1 && elsePos === -1 && /^else\s+if(::|\s)/.test(tagContent)) {
      const sepMatch = /^else\s+if(::|\s)/.exec(rawTag.toLowerCase())!;
      const innerCond = rawTag.slice(sepMatch[0].length).trim();
      const inner = parseBlockIf(innerCond, text, afterTag);
      if (!inner) return null;

      return {
        node: {
          type: 'blockIf',
          condition: parseNodesV2(condContent),
          thenBranch: parseNodesV2(text.slice(bodyStart, nextOpen)),
          elseBranch: [inner.node],
        },
        endPos: inner.endPos,
      };
    } else if (tagContent === 'else' && depth === 1) {
      if (elsePos === -1) {
        elsePos = afterTag;
      }
    }

    pos = afterTag;
  }

  return null;
}

// ============================================================================
// MAIN ENTRY: tokenize + parse into ASTNode[]
// ============================================================================

/**
 * Parse already-preprocessed text into ASTNode[] via a lexer -> parser pipeline.
 * Drop-in replacement for processor.parseNodes; emits the IDENTICAL tree.
 */
export function parseNodesV2(text: string): ASTNode[] {
  const nodes: ASTNode[] = [];
  let pos = 0;

  while (pos < text.length) {
    // --- LEX: find next macro tag opening ---
    const openIdx = text.indexOf('{{', pos);

    if (openIdx === -1) {
      // No more tags — rest is TEXT.
      nodes.push({ type: 'text', value: text.slice(pos) });
      break;
    }

    // Leading TEXT before the tag.
    if (openIdx > pos) {
      nodes.push({ type: 'text', value: text.slice(pos, openIdx) });
    }

    // --- LEX: match the closing `}}` (pair-scan) ---
    const closeIdx = lexMatchingClose(text, openIdx);
    if (closeIdx === -1) {
      // Unmatched OPEN — rest of the stream is TEXT.
      nodes.push({ type: 'text', value: text.slice(openIdx) });
      break;
    }

    const tag: MacroTag = {
      openPos: openIdx,
      closePos: closeIdx,
      afterClose: closeIdx + 2,
      rawContent: text.slice(openIdx + 2, closeIdx),
    };

    const innerContent = tag.rawContent;
    const afterClose = tag.afterClose;
    const trimmedInner = innerContent.trim();
    const lowerTrimmed = trimmedInner.toLowerCase();

    // ===== PARSE: first-match classification cascade (parseNodes order) =====

    // (1) Block-if, space/hash form: `if ` / `#if ` (NOT `if::`).
    const isBlockIf =
      (/^if\s/i.test(trimmedInner) && !/^if::/i.test(trimmedInner)) ||
      /^#if\s/i.test(trimmedInner);
    if (isBlockIf) {
      const condContent = /^#if\s/i.test(trimmedInner)
        ? trimmedInner.slice(3).trim()
        : trimmedInner.slice(2).trim();
      const blockResult = parseBlockIf(condContent, text, afterClose);
      if (blockResult) {
        nodes.push(blockResult.node);
        pos = blockResult.endPos;
        continue;
      }
      // Malformed (no {{/if}}) — head becomes literal TEXT.
      nodes.push({ type: 'text', value: text.slice(openIdx, afterClose) });
      pos = afterClose;
      continue;
    }

    // (2) Block-if, colon form: `{{if::COND}}` (single-arg only) + {{/if}}.
    if (/^if::/i.test(trimmedInner) && isColonBlockIfOpen(trimmedInner)) {
      const condContent = lexSplitArgs(trimmedInner.slice(4))[0].trim();
      const blockResult = parseBlockIf(condContent, text, afterClose);
      if (blockResult) {
        nodes.push(blockResult.node);
        pos = blockResult.endPos;
        continue;
      }
      // No {{/if}} — fall through to inline macro.
    }

    // (3) Block-trim: bare `{{trim}}` + {{/trim}}.
    if (lowerTrimmed === 'trim') {
      const blockCloseIdx = findBlockTerminator(text, afterClose, TRIM_CLOSE_TAG);
      if (blockCloseIdx !== -1) {
        const bodyText = text.slice(afterClose, blockCloseIdx);
        nodes.push({ type: 'blockTrim', content: parseNodesV2(bodyText) });
        pos = blockCloseIdx + TRIM_CLOSE_TAG.length;
        continue;
      }
    }

    // (4) Block-setvar / block-setglobalvar: single-arg name + matching close.
    if (/^setvar::/i.test(trimmedInner) || /^setglobalvar::/i.test(trimmedInner)) {
      const isGlobal = /^setglobalvar::/i.test(trimmedInner);
      const closeTag = isGlobal ? '{{/setglobalvar}}' : '{{/setvar}}';
      const prefix = isGlobal ? 'setglobalvar::' : 'setvar::';
      const argPart = trimmedInner.slice(prefix.length);

      const argParts = lexSplitArgs(argPart);
      if (argParts.length === 1) {
        const blockCloseIdx = findBlockTerminator(text, afterClose, closeTag);
        if (blockCloseIdx !== -1) {
          const bodyText = text.slice(afterClose, blockCloseIdx);
          const endPos = blockCloseIdx + closeTag.length;
          nodes.push({
            type: 'blockSetvar',
            varName: parseNodesV2(argParts[0].trim()),
            scope: isGlobal ? 'global' : 'local',
            content: parseNodesV2(bodyText),
          });
          pos = endPos;
          continue;
        }
      }
      // Not a block setvar — fall through to inline macro.
    }

    // (5) Orphan block terminators — silently consumed (no node).
    if (
      lowerTrimmed === '/if' ||
      lowerTrimmed === 'endif' ||
      lowerTrimmed === '/#if' ||
      lowerTrimmed === '//if' ||
      lowerTrimmed === 'else' ||
      /^else\s+if(::|\s)/i.test(trimmedInner) ||
      lowerTrimmed === '/trim' ||
      lowerTrimmed === '/setvar' ||
      lowerTrimmed === '/setglobalvar'
    ) {
      pos = afterClose;
      continue;
    }

    // (6) Comment macro: `{{// ...}}` — name '//' , body is ONE unsplit arg.
    if (trimmedInner.startsWith('//')) {
      const commentBody = trimmedInner.slice(2).trim();
      nodes.push({
        type: 'macro',
        name: '//',
        rawContent: innerContent,
        args: commentBody ? [[{ type: 'text', value: commentBody }]] : [],
      });
      pos = afterClose;
      continue;
    }

    // (7) Inline macro — name = arg0 (trimmed+lowercased); args parsed recursively.
    const argStrings = lexSplitArgs(innerContent);
    const macroName = argStrings[0].trim().toLowerCase();
    const macroArgs: ASTNode[][] = [];
    for (let i = 1; i < argStrings.length; i++) {
      macroArgs.push(parseNodesV2(argStrings[i]));
    }

    nodes.push({
      type: 'macro',
      name: macroName,
      rawContent: innerContent,
      args: macroArgs,
    });

    pos = afterClose;
  }

  return nodes;
}

// ============================================================================
// TEST-ONLY EXPORTS
// ============================================================================
// Surfaced so the differential / equivalence net can drive the lexer stages
// directly. Not part of any runtime API.

export const __lexMatchingCloseForTest = lexMatchingClose;
export const __lexSplitArgsForTest = lexSplitArgs;
