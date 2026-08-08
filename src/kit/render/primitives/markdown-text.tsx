/** @jsxImportSource @opentui/react */
/**
 * MarkdownText: renders parsed markdown blocks as a single OpenTUI <text> node (nested b/i/code/span
 * with <br> breaks). One text node on purpose: a stack of separate boxes measures to height 0 under
 * the harness, but one text node measures its own wrapped height and lays out cleanly in the
 * scrollback. Block styling stays flat (color + weight + a prefix), which is what a terminal can do
 * honestly; no full-width fills or boxes.
 */
import { Fragment } from "react";
import type { ReactNode } from "react";
import type { EntitySummary } from "../../bridge";
import { theme } from "../theme";
import { classifyDiff, type DiffLineKind } from "../diff-classify";
import { parsePieceMentions } from "../mention-parse";
import { parseMarkdown, type Inline } from "../markdown";
import { PieceCard } from "./piece-card";
import { sceneSeam } from "./scene-seam";

const DIFF_LINE_CAP = 80;

const diffColor = (kind: DiffLineKind): string => {
  if (kind === "add") return theme.alive;
  if (kind === "remove") return theme.red;
  if (kind === "meta") return theme.violet;
  return theme.soft;
};

const plainNodes = (
  text: string,
  pieces: readonly EntitySummary[],
  key: string,
): ReactNode[] =>
  parsePieceMentions(text, pieces).map((part, index) =>
    part.type === "piece"
      ? <PieceCard key={`${key}-piece-${index}`} piece={part.piece} />
      : <span key={`${key}-text-${index}`}>{part.text}</span>,
  );

const inlineNodes = (
  spans: Inline[],
  key: string,
  pieces: readonly EntitySummary[],
): ReactNode[] =>
  spans.flatMap((sp, i) => {
    const k = `${key}-${i}`;
    if (sp.t === "bold") return <b key={k}>{sp.s}</b>;
    if (sp.t === "italic") return <i key={k}>{sp.s}</i>;
    if (sp.t === "code") {
      return (
        <span key={k} fg={theme.gold} bg={theme.sunken}>
          {sp.s}
        </span>
      );
    }
    if (sp.t === "link") {
      return (
        <u key={k}>
          <span fg={theme.teal}>{sp.s}</span>
        </u>
      );
    }
    return plainNodes(sp.s, pieces, k);
  });

export function MarkdownText({
  text,
  fg = theme.soft,
  pieces = [],
}: {
  text: string;
  fg?: string;
  pieces?: readonly EntitySummary[];
}): ReactNode {
  const blocks = parseMarkdown(text);
  const out: ReactNode[] = [];
  // <br> takes no key (LineBreakProps = Pick<SpanProps,"id">), so key the wrapping Fragment instead.
  const br = (k: string): ReactNode => (
    <Fragment key={k}>
      <br />
    </Fragment>
  );

  blocks.forEach((b, bi) => {
    const key = `b${bi}`;
    const last = bi === blocks.length - 1;
    const tight = b.t === "bullet" || b.t === "ordered";

    if (b.t === "heading") {
      out.push(
        <b key={`${key}-h`}>
          <span fg={theme.bright}>{inlineNodes(b.spans, key, pieces)}</span>
        </b>,
      );
    } else if (b.t === "para") {
      out.push(...inlineNodes(b.spans, key, pieces));
    } else if (b.t === "bullet") {
      out.push(
        <span key={`${key}-p`} fg={theme.mut}>
          {"  ".repeat(b.depth) + "- "}
        </span>,
        ...inlineNodes(b.spans, key, pieces),
      );
    } else if (b.t === "ordered") {
      out.push(
        <span key={`${key}-p`} fg={theme.mut}>
          {`${"  ".repeat(b.depth)}${b.num}. `}
        </span>,
        ...inlineNodes(b.spans, key, pieces),
      );
    } else if (b.t === "quote") {
      out.push(
        <span key={`${key}-p`} fg={theme.mut}>
          {"| "}
        </span>,
        <i key={`${key}-q`}>{inlineNodes(b.spans, key, pieces)}</i>,
      );
    } else if (b.t === "table") {
      /**
       * A TERMINAL IS MONOSPACE, so a table is columns padded to their widest cell. No rules and no
       * corners: box-drawing around every cell costs three lines of chrome per two of content in a
       * pane this narrow, and the alignment alone already reads as a table.
       *
       * Cells are flattened to their text here. Bold inside a cell is real in the window; in a
       * grid measured by character count, a span that renders wider than it measures tears the
       * columns apart, which is worse than losing the emphasis.
       */
      const flat = (cells: readonly Inline[][]): string[] => cells.map((c) => c.map((s) => s.s).join(""));
      const head = flat(b.head);
      const rows = b.rows.map(flat);
      const width = head.map((h, c) =>
        Math.max(h.length, ...rows.map((r) => (r[c] ?? "").length)));
      const line = (cells: readonly string[]): string =>
        cells.map((cell, c) => cell.padEnd(width[c] ?? 0)).join("  ").trimEnd();
      out.push(<b key={`${key}-th`}>{line(head)}</b>, br(`${key}-th-nl`));
      rows.forEach((row, ri) => {
        out.push(<span key={`${key}-tr${ri}`}>{line(row)}</span>);
        if (ri < rows.length - 1) out.push(br(`${key}-tr${ri}-nl`));
      });
    } else if (b.t === "code") {
      const diff = classifyDiff(b.lines, b.lang);
      // Terminal-honest code slab: a dim language label (when the fence carried one) over the code lines
      // on the sunken fill. No box (a nested box measures to 0 in the scrollback); the fill IS the slab.
      if (diff) {
        out.push(
          <b key={`${key}-diff-label`}>
            <span fg={theme.bright}>DIFF </span>
            <span fg={theme.alive}>+{String(diff.additions)}</span>
            <span fg={theme.red}> -{String(diff.removals)}</span>
          </b>,
          br(`${key}-diff-nl`),
        );
        diff.lines.slice(0, DIFF_LINE_CAP).forEach((line, li) => {
          out.push(
            <span key={`${key}-d${li}`} fg={diffColor(line.kind)} bg={theme.sunken}>
              {` ${line.text} `}
            </span>,
          );
          if (li < Math.min(diff.lines.length, DIFF_LINE_CAP) - 1) {
            out.push(br(`${key}-d${li}-nl`));
          }
        });
        if (diff.lines.length > DIFF_LINE_CAP) {
          out.push(
            br(`${key}-diff-cap-nl`),
            <span key={`${key}-diff-cap`} fg={theme.quiet}>
              {String(diff.lines.length - DIFF_LINE_CAP)} more lines
            </span>,
          );
        }
      } else {
        if (b.lang) {
          out.push(
            <span key={`${key}-lang`} fg={theme.quiet}>
              {b.lang}
            </span>,
            br(`${key}-lang-nl`),
          );
        }
        b.lines.forEach((ln, li) => {
          out.push(
            <span key={`${key}-c${li}`} fg={theme.teal} bg={theme.sunken}>
              {` ${ln} `}
            </span>,
          );
          if (li < b.lines.length - 1) out.push(br(`${key}-c${li}-nl`));
        });
      }
    } else if (b.t === "hr") {
      out.push(
        <span key={`${key}-hr`} fg={theme.mut}>
          {sceneSeam()}
        </span>,
      );
    }

    if (!last) {
      out.push(br(`${key}-s0`));
      if (!tight) out.push(br(`${key}-s1`));
    }
  });

  return <text fg={fg}>{out}</text>;
}
