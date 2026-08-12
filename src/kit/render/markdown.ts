/**
 * Pure markdown parser for the transcript: a string becomes an ordered list of blocks, each with its
 * inline spans. Tolerant by design (unclosed markers render as plain text), so it can parse a reply
 * mid-stream. The renderer (markdown-text.tsx) turns these into OpenTUI text; this file has no view
 * concerns so it can be unit-tested directly. Scope is what an assistant actually emits: headings,
 * paragraphs, bullet/ordered lists, block quotes, fenced code, rules, and inline bold/italic/code/link.
 */

export type Inline =
  | { t: "text"; s: string }
  | { t: "bold"; s: string }
  | { t: "italic"; s: string }
  | { t: "code"; s: string }
  | { t: "link"; s: string; href: string };

export type Block =
  | { t: "para"; spans: Inline[] }
  | { t: "heading"; level: number; spans: Inline[] }
  | { t: "bullet"; depth: number; spans: Inline[] }
  | { t: "ordered"; depth: number; num: number; spans: Inline[] }
  | { t: "quote"; spans: Inline[] }
  | { t: "code"; lines: string[]; lang?: string; /** false when the model was still writing it */ closed?: boolean }
  /**
   * A pipe table.
   *
   * Models reach for one whenever they compare two things, and until this existed the reply arrived
   * as a wall of `|` and `---` that had to be read like a puzzle. Cells are spans, not strings, so
   * the bold and the code inside them survive the trip.
   */
  | { t: "table"; head: Inline[][]; rows: Inline[][][] }
  | { t: "hr" };

// Inline markers, in priority order: code (protects its content), bold (**/__), italic (*), link.
// Single _ is deliberately not italic, so snake_case identifiers survive untouched.
const INLINE = /(`[^`\n]+`)|(\*\*[^\n]+?\*\*|__[^\n]+?__)|(\*[^\n*]+?\*)|(\[[^\]\n]+\]\([^)\n]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;

/** Split one line of text into styled inline spans. Always returns at least one span. */
export const parseInline = (line: string): Inline[] => {
  const out: Inline[] = [];
  let last = 0;
  INLINE.lastIndex = 0;
  for (let m = INLINE.exec(line); m; m = INLINE.exec(line)) {
    if (m.index > last) out.push({ t: "text", s: line.slice(last, m.index) });
    if (m[1]) out.push({ t: "code", s: m[1].slice(1, -1) });
    else if (m[2]) out.push({ t: "bold", s: m[2].slice(2, -2) });
    else if (m[3]) out.push({ t: "italic", s: m[3].slice(1, -1) });
    else if (m[4]) {
      const link = LINK.exec(m[4]);
      if (link) out.push({ t: "link", s: link[1]!, href: link[2]! });
      else out.push({ t: "text", s: m[4] });
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ t: "text", s: line.slice(last) });
  return out.length > 0 ? out : [{ t: "text", s: line }];
};

const HR = /^\s*(---+|\*\*\*+|___+)\s*$/;
const FENCE = /^\s*```/;
const HEADING = /^(#{1,6})\s+(.+)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const BULLET = /^(\s*)[-*+]\s+(.+)$/;
const ORDERED = /^(\s*)(\d+)[.)]\s+(.+)$/;
/**
 * A table's second line: the one made of dashes that says "the row above was headings".
 *
 * THIS IS WHAT MAKES A TABLE A TABLE. A single line of pipes is far more often prose - a model
 * writing `use | to separate them` - so the delimiter row is the only honest signal, and requiring
 * it is what stops ordinary sentences being swallowed into a grid.
 */
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const hasPipe = (l: string): boolean => l.includes("|");

/** Split one table row into its cells, tolerating the optional leading and trailing pipes. */
const cellsOf = (line: string): string[] =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

const isSpecial = (l: string): boolean =>
  !l.trim() || FENCE.test(l) || HEADING.test(l) || QUOTE.test(l) || BULLET.test(l) || ORDERED.test(l) || HR.test(l)
  // A table's own rule line must break a paragraph, or the header row is eaten by the text above it.
  || TABLE_RULE.test(l);

/** Parse markdown into blocks. Consecutive plain lines fold into one paragraph. */
export const parseMarkdown = (src: string): Block[] => {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (FENCE.test(line)) {
      const lang = line.replace(/^\s*```/, "").trim() || undefined; // the info string after the fence
      i += 1;
      const code: string[] = [];
      while (i < lines.length && !FENCE.test(lines[i]!)) code.push(lines[i++]!);
      /**
       * WHETHER THE FENCE ACTUALLY CLOSED, which mid-stream is the difference between a finished
       * block and half of one. Both render as code, so this changes nothing for a reader - but a
       * consumer that does something RICHER with a block (drawing HTML rather than printing it)
       * must not act on a document the model is still writing: sanitising half a page yields markup
       * that renders wrong and then rewrites itself as the rest arrives.
       */
      const closed = i < lines.length;
      i += 1; // skip closing fence (absent mid-stream; the loop just ended instead)
      blocks.push({ t: "code", lines: code, lang, closed });
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (HR.test(line)) {
      blocks.push({ t: "hr" });
      i += 1;
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      blocks.push({ t: "heading", level: h[1]!.length, spans: parseInline(h[2]!) });
      i += 1;
      continue;
    }
    if (QUOTE.test(line)) {
      const parts: string[] = [];
      for (let q = QUOTE.exec(lines[i]!); q; q = i < lines.length ? QUOTE.exec(lines[i]!) : null) {
        parts.push(q[1]!);
        i += 1;
      }
      blocks.push({ t: "quote", spans: parseInline(parts.join(" ")) });
      continue;
    }
    /**
     * A table: a header row, a rule under it, and every row after that carries a pipe.
     *
     * Checked before the list and paragraph rules because a header row is otherwise ordinary text,
     * and it is the NEXT line that reveals what it was. Rows are padded or trimmed to the header's
     * width so a ragged table still draws as a grid rather than throwing the columns out.
     */
    const ruleAhead = i + 1 < lines.length && TABLE_RULE.test(lines[i + 1]!);
    if (hasPipe(line) && ruleAhead) {
      const head = cellsOf(line);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && hasPipe(lines[i]!) && lines[i]!.trim()) {
        const cells = cellsOf(lines[i]!);
        rows.push(
          Array.from({ length: head.length }, (_, c) => parseInline(cells[c] ?? "")),
        );
        i += 1;
      }
      blocks.push({ t: "table", head: head.map((c) => parseInline(c)), rows });
      continue;
    }

    const b = BULLET.exec(line);
    if (b) {
      blocks.push({ t: "bullet", depth: Math.floor(b[1]!.length / 2), spans: parseInline(b[2]!) });
      i += 1;
      continue;
    }
    const o = ORDERED.exec(line);
    if (o) {
      blocks.push({ t: "ordered", depth: Math.floor(o[1]!.length / 2), num: parseInt(o[2]!, 10), spans: parseInline(o[3]!) });
      i += 1;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && !isSpecial(lines[i]!)) para.push(lines[i++]!);
    blocks.push({ t: "para", spans: parseInline(para.join(" ")) });
  }
  return blocks;
};
