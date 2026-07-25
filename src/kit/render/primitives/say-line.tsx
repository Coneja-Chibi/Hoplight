/** @jsxImportSource @opentui/react */
/**
 * SayLine: an assistant reply in the transcript, a recessed band (Kit's voice sits back, your line
 * lifts) with soft prose and markdown rendered (bold/italic/code/links, headings, lists, quotes, fenced
 * code, rules) via MarkdownText. OpenTUI's own <markdown> rendered blank under the harness, so we parse
 * + render it ourselves. The parser is tolerant, so a reply renders correctly while still streaming.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";
import { Band } from "./band";
import { MarkdownText } from "./markdown-text";

export function SayLine({ text, streaming = false }: { text: string; streaming?: boolean }): ReactNode {
  void streaming;
  return (
    <Band bg={theme.recess} spine={theme.recess}>
      <MarkdownText text={text} fg={theme.soft} />
    </Band>
  );
}
