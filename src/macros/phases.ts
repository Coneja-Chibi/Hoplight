// ============================================================================
// EVALUATION PHASES (macro engine spec Part VIII)
//
// Prompts evaluate in registry order, so a prompt reading a variable set
// by a LATER prompt sees stale state ("init ran before HEARTTHROB").
// Phases give authors explicit control:
//
//   {{phase::pre_render::...}}   runs before any prompt renders
//   {{phase::render::...}}       normal order (the default — pure sugar)
//   {{phase::post_render::...}}  runs after all prompts rendered
//   {{defer::...}}               same as post_render, reads final state
//   {{after::prompt_id::...}}    runs after the named prompt (v1: end of
//                                render pass — by then every prompt has
//                                evaluated, so the dependency always holds)
//
// processPhasedBlocks() is the orchestrator the prompt assembler calls
// with ALL preset prompt texts at once:
//
//   pass 1  extract phase segments, leave sentinels in the block texts
//   pass 2  evaluate pre_render segments (block order)
//   pass 3  evaluate block texts (normal render, shared context)
//   pass 4  evaluate after::, then post_render, then defer segments
//   pass 5  substitute every segment's output back into its sentinel
//
// Outside the orchestrator (lorebook entries, chat messages, single-text
// calls) the phase/defer/after macros fall back to rendering their body
// inline — documented, and the lint can flag misplaced uses later.
// ============================================================================

import { MacroContext } from './types';
import { processMacros } from './processor';

export interface PhasedBlock {
  /** Stable, unique id (preset prompt identifier or positional id) */
  id: string;
  text: string;
}

/**
 * Evaluator the orchestrator drives. The prompt assembler passes its own
 * replaceMacros (legacy fallbacks, memoization, side-effect persistence
 * stay in one place); tests and standalone callers can bind processMacros
 * via evaluatorFor().
 */
export type PhaseEvaluator = (text: string) => string;

/** Bind processMacros to a shared context as a PhaseEvaluator. */
export function evaluatorFor(context: MacroContext): PhaseEvaluator {
  return (text) => processMacros(text, context).text;
}

type SegmentKind = 'pre_render' | 'post_render' | 'defer' | 'after';

interface Segment {
  sentinel: string;
  kind: SegmentKind;
  /** for after:: — prompt identifier the segment waits on */
  afterId?: string;
  body: string;
  blockId: string;
}

const SENTINEL_CHAR = '\x03';

// -----------------------------------------------------------------------------
// Extraction
// -----------------------------------------------------------------------------

/** Find the `}}` closing the `{{` at openPos, or -1. */
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

/** Split on top-level `::`. */
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

/**
 * Extract top-level phase/defer/after macros from a block's text,
 * replacing each with a sentinel. {{phase::render::body}} is unwrapped
 * inline (it IS the default phase). Returns the rewritten text.
 */
function extractSegments(
  text: string,
  blockId: string,
  segments: Segment[],
): string {
  let result = '';
  let pos = 0;

  while (pos < text.length) {
    const open = text.indexOf('{{', pos);
    if (open === -1) {
      result += text.slice(pos);
      break;
    }
    const close = findClose(text, open);
    if (close === -1) {
      result += text.slice(pos);
      break;
    }

    const inner = text.slice(open + 2, close);
    const parts = splitTopLevel(inner);
    const name = parts[0].trim().toLowerCase();

    if (name === 'phase' && parts.length >= 3) {
      const phaseName = parts[1].trim().toLowerCase();
      const body = parts.slice(2).join('::');
      result += text.slice(pos, open);
      if (phaseName === 'pre_render' || phaseName === 'post_render') {
        const sentinel = `${SENTINEL_CHAR}${segments.length}${SENTINEL_CHAR}`;
        segments.push({ sentinel, kind: phaseName, body, blockId });
        result += sentinel;
      } else {
        // render (or unknown phase name): inline, normal order
        result += body;
      }
      pos = close + 2;
    } else if (name === 'defer' && parts.length >= 2) {
      const sentinel = `${SENTINEL_CHAR}${segments.length}${SENTINEL_CHAR}`;
      segments.push({ sentinel, kind: 'defer', body: parts.slice(1).join('::'), blockId });
      result += text.slice(pos, open) + sentinel;
      pos = close + 2;
    } else if (name === 'after' && parts.length >= 3) {
      const sentinel = `${SENTINEL_CHAR}${segments.length}${SENTINEL_CHAR}`;
      segments.push({
        sentinel,
        kind: 'after',
        afterId: parts[1].trim().toLowerCase(),
        body: parts.slice(2).join('::'),
        blockId,
      });
      result += text.slice(pos, open) + sentinel;
      pos = close + 2;
    } else {
      // Not a phase macro — copy through (nested phase macros inside other
      // macros' args are left to the inline fallback handlers)
      result += text.slice(pos, close + 2);
      pos = close + 2;
    }
  }

  return result;
}

// -----------------------------------------------------------------------------
// Orchestrator
// -----------------------------------------------------------------------------

/**
 * Evaluate a set of prompt blocks with phase support. The evaluator runs
 * against one shared context (owned by the caller), so side effects from
 * earlier passes are visible to later ones. Returns final per-block texts.
 */
export function processPhasedBlocks(
  blocks: PhasedBlock[],
  evaluate: PhaseEvaluator
): Map<string, string> {
  const segments: Segment[] = [];
  const run = evaluate;

  // Pass 1: extract segments. Blocks with no phase macros pass through
  // extraction unchanged.
  const stripped = blocks.map(b => ({
    id: b.id,
    text: extractSegments(b.text, b.id, segments),
  }));

  // Pass 2: pre_render segments, block order
  const outputs = new Map<string, string>();
  for (const seg of segments) {
    if (seg.kind === 'pre_render') outputs.set(seg.sentinel, run(seg.body));
  }

  // Pass 3: render pass, block order, shared context
  const rendered = stripped.map(b => ({ id: b.id, text: run(b.text) }));

  // Pass 4: after::, then post_render, then defer — all see final state
  for (const seg of segments) {
    if (seg.kind === 'after') outputs.set(seg.sentinel, run(seg.body));
  }
  for (const seg of segments) {
    if (seg.kind === 'post_render') outputs.set(seg.sentinel, run(seg.body));
  }
  for (const seg of segments) {
    if (seg.kind === 'defer') outputs.set(seg.sentinel, run(seg.body));
  }

  // Pass 5: substitute sentinels (a segment's output may itself contain a
  // sentinel if the author nested phase blocks — resolve repeatedly, bounded)
  const texts = new Map<string, string>();
  for (const block of rendered) {
    let text = block.text;
    for (let i = 0; i < 5 && text.includes(SENTINEL_CHAR); i++) {
      for (const [sentinel, output] of outputs) {
        text = text.split(sentinel).join(output);
      }
    }
    // Safety: never leak sentinel chars into the prompt
    text = text.replaceAll(SENTINEL_CHAR, '');
    texts.set(block.id, text);
  }

  return texts;
}

/** Does this text contain any phase-aware macro? Cheap pre-check. */
export function containsPhaseMacros(text: string): boolean {
  return /\{\{\s*(phase|defer|after)\s*::/i.test(text);
}
