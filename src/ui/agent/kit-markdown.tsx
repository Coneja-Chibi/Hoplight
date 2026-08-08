/**
 * A reply, rendered the way Kit renders one.
 *
 * WHY A REPLY IS NOT A PARAGRAPH. Kit does not print the model's answer as text. It parses it and
 * draws headings, lists, quotes, rules, inline code and fenced code, and it colours a fenced patch
 * as a DIFF with counts. That is not decoration: an answer containing a patch, a shell command and
 * three steps reads as three different KINDS of thing in Kit and as one undifferentiated wall here.
 * This window was printing `{line.text}` into a `<p>`.
 *
 * THE PARSER IS KIT'S OWN, imported. See kit-markdown-core.ts for why it is not copied.
 *
 * IT IS BUILT FROM REACT ELEMENTS, NEVER FROM AN HTML STRING. This renders MODEL OUTPUT, which is
 * untrusted text from outside the program: it can contain `<script>`, `<img onerror=...>`, or a
 * `javascript:` link, and it arrives having passed through whatever the model read on the way. React
 * escapes text children by construction, so a `<script>` in a reply is a `<script>` on the screen
 * and never a `<script>` in the document. There is no `dangerouslySetInnerHTML` in this file and
 * there must never be one.
 *
 * WHERE IT DEPARTS FROM THE TERMINAL, AND WHY. Kit draws list markers, quote bars and horizontal
 * rules as text in `mut` - and theme.ts says plainly that `mut` is BORDERS ONLY, never text. The
 * terminal had no choice; every mark it can make is a character. A browser does have borders, so
 * those three become real borders in `mut` and every remaining piece of TEXT floors at `quiet`,
 * which is what the palette's rule actually asks for.
 */
import { useState, type JSX, type ReactNode } from "react";
import { classifyDiff } from "../../kit/render/diff-classify";
import { parseMarkdown, type Block, type Inline } from "../../kit/render/markdown";
import { DIFF_LINE_CAP, diffInk, safeLinkHref } from "./kit-markdown-core";

/** One styled run inside a line. Kit's assignment: code gold on sunken, links teal, the rest plain. */
function Span({ span }: { span: Inline }): JSX.Element {
  if (span.t === "bold") return <strong className="kit-md__b">{span.s}</strong>;
  if (span.t === "italic") return <em className="kit-md__i">{span.s}</em>;
  if (span.t === "code") return <code className="kit-md__code">{span.s}</code>;
  if (span.t === "link") {
    const href = safeLinkHref(span.href);
    /**
     * A LINK THAT DID NOT PASS THE POLICY KEEPS ITS WORDS AND LOSES ITS CLICK. Dropping the label
     * would hide that the model tried to link something, which is information a reader wants
     * precisely when the target was refused.
     */
    if (href === null) return <span className="kit-md__deadlink" title={span.href}>{span.s}</span>;
    return (
      // `noopener` matters even with a strict scheme: the opened page must not get a handle on the
      // window that opened it, and `noreferrer` keeps this app's URL out of somebody else's logs.
      <a className="kit-md__link" href={href} target="_blank" rel="noopener noreferrer">{span.s}</a>
    );
  }
  return <span>{span.s}</span>;
}

/** A line's spans, in order. */
function Spans({ spans }: { spans: readonly Inline[] }): JSX.Element {
  return <>{spans.map((span, i) => <Span key={`s${String(i)}`} span={span} />)}</>;
}

/**
 * A fenced block: a diff playbill when it parses as a patch, a plain code slab otherwise.
 *
 * THE DIFF RECOGNISER IS KIT'S. An explicit ```diff fence always counts; any other fence needs a
 * hunk header AND both kinds of changed line, so ordinary arithmetic is never painted as a patch.
 */
function CodeBlock({ block }: { block: Extract<Block, { t: "code" }> }): JSX.Element {
  const diff = classifyDiff(block.lines, block.lang);
  if (!diff) {
    return (
      <pre className="kit-md__slab">
        {/* The info string after the fence, when the model gave one. Dim: it labels, it is not code. */}
        {block.lang !== undefined && <span className="kit-md__lang">{block.lang}</span>}
        <code>{block.lines.join("\n")}</code>
      </pre>
    );
  }
  const shown = diff.lines.slice(0, DIFF_LINE_CAP);
  return (
    <pre className="kit-md__slab kit-md__slab--diff">
      <span className="kit-md__difflabel">
        {"DIFF "}
        <span style={{ color: "var(--kit-alive)" }}>{`+${String(diff.additions)}`}</span>
        <span style={{ color: "var(--kit-red)" }}>{` -${String(diff.removals)}`}</span>
      </span>
      {shown.map((line, i) => (
        <span key={`d${String(i)}`} className="kit-md__diffline" style={{ color: diffInk(line.kind) }}>
          {line.text}
        </span>
      ))}
      {/* Kit's tail: what was cut, counted, so a truncated patch never looks like a complete one. */}
      {diff.lines.length > DIFF_LINE_CAP && (
        <span className="kit-md__more">{`${String(diff.lines.length - DIFF_LINE_CAP)} more lines`}</span>
      )}
    </pre>
  );
}

/**
 * One parsed block.
 *
 * EVERY HEADING LEVEL LOOKS THE SAME, which is Kit's treatment and worth keeping: `######` cannot
 * make a model louder than `#`. The depth of a list item indents it; it does not restyle it.
 */
function BlockView({ block }: { block: Block }): JSX.Element | null {
  if (block.t === "heading") return <p className="kit-md__head"><Spans spans={block.spans} /></p>;
  if (block.t === "para") return <p className="kit-md__p"><Spans spans={block.spans} /></p>;
  if (block.t === "bullet") {
    return (
      <p className="kit-md__li" style={{ paddingLeft: `${String(block.depth + 1)}rem` }}>
        <span className="kit-md__mark">{"- "}</span>
        <Spans spans={block.spans} />
      </p>
    );
  }
  if (block.t === "ordered") {
    return (
      <p className="kit-md__li" style={{ paddingLeft: `${String(block.depth + 1)}rem` }}>
        <span className="kit-md__mark">{`${String(block.num)}. `}</span>
        <Spans spans={block.spans} />
      </p>
    );
  }
  // The quote bar is a BORDER here rather than a drawn "| ", which is what `mut` is for.
  if (block.t === "quote") return <p className="kit-md__quote"><Spans spans={block.spans} /></p>;
  if (block.t === "code") return <CodeBlock block={block} />;
  if (block.t === "table") return <TableBlock block={block} />;
  if (block.t === "hr") return <hr className="kit-md__rule" />;
  return null;
}

/**
 * A pipe table, drawn as one - and openable, because this window is narrow.
 *
 * A COMPARISON IS THE THING TABLES ARE FOR, and a five-column comparison in a panel four hundred
 * pixels wide is unreadable however carefully it is styled. So the table renders inline at whatever
 * size it has, and the whole thing opens over the window when you want to actually read it. The
 * pop-out is the same markup at a size that fits it, not a second rendering with its own rules.
 */
function TableBlock({ block }: { block: Extract<Block, { t: "table" }> }): JSX.Element {
  const [open, setOpen] = useState(false);
  const grid = (
    <table className="kit-md__table">
      <thead>
        <tr>{block.head.map((cell, c) => <th key={c}><Spans spans={cell} /></th>)}</tr>
      </thead>
      <tbody>
        {block.rows.map((row, r) => (
          <tr key={r}>{row.map((cell, c) => <td key={c}><Spans spans={cell} /></td>)}</tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="kit-md__tablewrap">
      {/* The scroller is the wrapper, so a wide table never pushes the conversation sideways. */}
      <div className="kit-md__tablescroll">{grid}</div>
      <button
        type="button"
        className="kit-md__tableout"
        title="Open this table over the window"
        onClick={() => { setOpen(true); }}
      >
        {"open"}
      </button>
      {open && (
        <div
          className="kit-md__sheet"
          role="dialog"
          aria-label="Table"
          // Clicking the ground closes it: the same gesture every overlay in this app answers to.
          onClick={() => { setOpen(false); }}
        >
          <div className="kit-md__sheetbody" onClick={(e) => { e.stopPropagation(); }}>
            <button type="button" className="kit-md__sheetclose" onClick={() => { setOpen(false); }}>
              {"close"}
            </button>
            <div className="kit-md__tablescroll">{grid}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A whole reply.
 *
 * Parsed on every render, deliberately: the parser is tolerant by design, so a reply that is still
 * streaming - an unclosed fence, half a bold marker - renders as sensible text rather than as a
 * broken tree that snaps into place at the end.
 */
export function KitMarkdown({ text }: { text: string }): JSX.Element {
  const blocks = parseMarkdown(text);
  const out: ReactNode[] = blocks.map((block, i) => <BlockView key={`b${String(i)}`} block={block} />);
  return <div className="kit-md">{out}</div>;
}
