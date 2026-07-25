/** @jsxImportSource @opentui/react */
/**
 * KeyHint: a row of keyboard hints, a bright key followed by a muted label. The CLI signature,
 * shared by the input bar and (soon) the Panel Deck status line. One widget, drawn once, reused.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";

export interface Hint {
  key: string;
  label?: string;
}

export function KeyHint({ hints }: { hints: ReadonlyArray<Hint> }): ReactNode {
  return (
    <text fg={theme.mut}>
      {hints.map((hint, index) => (
        <span key={index}>
          {index > 0 ? "   " : ""}
          <span fg={theme.text}>{hint.key}</span>
          {hint.label ? ` ${hint.label}` : ""}
        </span>
      ))}
    </text>
  );
}
