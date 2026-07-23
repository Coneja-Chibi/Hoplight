/** @jsxImportSource @opentui/react */
/** SayLine: an assistant turn in the transcript, soft prose. */
import type { ReactNode } from "react";
import { theme } from "../theme";

export function SayLine({ text }: { text: string }): ReactNode {
  return <text fg={theme.soft}>{text}</text>;
}
