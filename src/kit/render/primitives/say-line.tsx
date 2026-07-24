/** @jsxImportSource @opentui/react */
/**
 * SayLine: an assistant turn in the transcript, soft prose with markdown rendered (bold/italic/code/
 * links, headings, lists, quotes, fenced code, rules) via MarkdownText. OpenTUI's own <markdown>
 * rendered blank under the harness, so we parse + render it ourselves. The parser is tolerant, so a
 * reply renders correctly while still streaming. streaming is kept for a future in-progress marker.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";
import { MarkdownText } from "./markdown-text";

export function SayLine({ text, streaming = false }: { text: string; streaming?: boolean }): ReactNode {
  void streaming;
  return <MarkdownText text={text} fg={theme.soft} />;
}
