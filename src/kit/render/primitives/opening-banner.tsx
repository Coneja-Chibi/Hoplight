/** @jsxImportSource @opentui/react */
/**
 * OpeningBanner: the CLI greeting. A big rainbow "Kit" ascii wordmark (the ascii-font color prop
 * takes an array, so it gradients across the letters) over an explanatory opener. The one place a
 * full spectrum appears, a deliberate splash; the working chrome stays rose. Replaces the masthead.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";

// Chi's palette: a cool-to-warm-to-cool spectrum, left to right across the wordmark.
const RAINBOW = [
  "#1a2a6c", "#0e6b6e", "#0f8f5a", "#16a37a", "#3fca8e", "#8fd14f", "#c6d64a",
  "#f5c542", "#f2913c", "#ef6a3a", "#e8253f", "#c02a5a", "#8a2b6e", "#4a2a8f",
];

export function OpeningBanner({
  studioName,
  totalPieces,
}: {
  studioName: string;
  totalPieces: number;
}): ReactNode {
  return (
    <box flexDirection="column" backgroundColor={theme.well} paddingLeft={1} paddingTop={1}>
      <ascii-font text="Kit" font="block" color={RAINBOW} />
      <box height={1} />
      <box flexDirection="row" height={1}>
        <text fg={theme.bright}>{studioName}, in the terminal.</text>
      </box>
      <box flexDirection="row" height={1}>
        <text fg={theme.soft}>
          Talk to your {String(totalPieces)} pieces in plain language. Nothing leaves your machine until you send.
        </text>
      </box>
      <box flexDirection="row" height={1}>
        <text fg={theme.soft}>Scripts stay sealed as text and never run.</text>
      </box>
      <box height={1} />
      <box flexDirection="row" height={1}>
        <text fg={theme.mut}>
          <span fg={theme.text}>/model</span> connect a provider {"   "}
          <span fg={theme.text}>/test</span> check it is alive {"   "}
          <span fg={theme.text}>/quit</span> leave
        </text>
      </box>
    </box>
  );
}
