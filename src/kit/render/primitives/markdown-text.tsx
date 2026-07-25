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
import { theme } from "../theme";
import { parseMarkdown, type Inline } from "../markdown";

const RULE = "─".repeat(40);

const inlineNodes = (spans: Inline[], key: string): ReactNode[] =>
  spans.map((sp, i) => {
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
    return <span key={k}>{sp.s}</span>;
  });

export function MarkdownText({ text, fg = theme.soft }: { text: string; fg?: string }): ReactNode {
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
          <span fg={theme.bright}>{inlineNodes(b.spans, key)}</span>
        </b>,
      );
    } else if (b.t === "para") {
      out.push(...inlineNodes(b.spans, key));
    } else if (b.t === "bullet") {
      out.push(
        <span key={`${key}-p`} fg={theme.mut}>
          {"  ".repeat(b.depth) + "- "}
        </span>,
        ...inlineNodes(b.spans, key),
      );
    } else if (b.t === "ordered") {
      out.push(
        <span key={`${key}-p`} fg={theme.mut}>
          {`${"  ".repeat(b.depth)}${b.num}. `}
        </span>,
        ...inlineNodes(b.spans, key),
      );
    } else if (b.t === "quote") {
      out.push(
        <span key={`${key}-p`} fg={theme.mut}>
          {"| "}
        </span>,
        <i key={`${key}-q`}>{inlineNodes(b.spans, key)}</i>,
      );
    } else if (b.t === "code") {
      // Terminal-honest code slab: a dim language label (when the fence carried one) over the code lines
      // on the sunken fill. No box (a nested box measures to 0 in the scrollback); the fill IS the slab.
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
    } else if (b.t === "hr") {
      out.push(
        <span key={`${key}-hr`} fg={theme.mut}>
          {RULE}
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
