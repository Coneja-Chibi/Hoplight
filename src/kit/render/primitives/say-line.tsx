/** @jsxImportSource @opentui/react */
/**
 * SayLine: an assistant turn in the transcript, soft prose. streaming marks a reply still arriving
 * (the look for that state, and markdown rendering, land after the aliveness wireframes are picked;
 * OpenTUI's markdown widget rendered blank under the harness and is not trusted with the transcript
 * until proven).
 */
import type { ReactNode } from "react";
import { theme } from "../theme";

export function SayLine({ text, streaming = false }: { text: string; streaming?: boolean }): ReactNode {
  void streaming;
  return <text fg={theme.soft}>{text}</text>;
}
