/** @jsxImportSource @opentui/react */
/**
 * SayLine: an assistant reply in the transcript, a recessed band (Kit's voice sits back, your line
 * lifts) with soft prose and markdown rendered (bold/italic/code/links, headings, lists, quotes, fenced
 * code, rules) via MarkdownText. OpenTUI's own <markdown> rendered blank under the harness, so we parse
 * + render it ourselves. The parser is tolerant, so a reply renders correctly while still streaming.
 */
import type { ReactNode } from "react";
import type { EntitySummary } from "../../bridge";
import { isLongSay } from "../say-fold";
import { theme } from "../theme";
import { CopyableBand } from "./copyable-band";
import { MarkdownText } from "./markdown-text";

export function SayLine({
  text,
  streaming = false,
  open,
  onToggle,
  onCopy,
  pieces = [],
}: {
  text: string;
  streaming?: boolean;
  open?: boolean;
  onToggle?: () => void;
  onCopy?: () => void;
  pieces?: readonly EntitySummary[];
}): ReactNode {
  const foldable = !streaming && isLongSay(text);
  if (foldable && !open) {
    return (
      <box flexDirection="row" paddingLeft={2} onMouseDown={onToggle}>
        <text fg={theme.soft}>
          <span fg={theme.tealDeep}>{"· "}</span>
          said · {String(text.length)} chars ·{" "}
          <span fg={theme.rose}>click or ctrl+o</span> reopens
        </text>
      </box>
    );
  }
  return (
    <CopyableBand
      bg={theme.recess}
      spine={theme.recess}
      onMouseDown={foldable ? onToggle : undefined}
      onCopy={streaming ? undefined : onCopy}
    >
      <MarkdownText text={text} fg={theme.soft} pieces={pieces} />
    </CopyableBand>
  );
}
