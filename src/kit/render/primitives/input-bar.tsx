/** @jsxImportSource @opentui/react */
/**
 * InputBar: the composer (DECISIONS #27), heavy frame + lifted plate + rose cap. A thick "heavy"
 * box border is the neo-brute stamp (a TTY can't fake an offset shadow, it only makes a grey bar);
 * the field sits on a lighter plate for a lift without a shadow. A rose-deep "> " cap block (white
 * ink) is fused to the left border so the prompt is a real stamp, not a floating marker. The caret
 * is a blinking underscore whose color shifts through the spectrum (style set once so the terminal's
 * blink is not reset; only the color animates). No command-hint row (the slash popup surfaces those).
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRenderer } from "@opentui/react";
import { RGBA } from "@opentui/core";
import { theme } from "../theme";
import { rampAt } from "../colors";
import { SweepLine } from "./sweep-line";

const CURSOR_RAMP = [
  "#3b82f6", "#06b6d4", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899", "#a855f7", "#3b82f6",
];
const CURSOR_STEP_MS = 120;
const CURSOR_FLOW = 0.03; // color offset per tick (~4s per full spectrum sweep)

export function InputBar({
  draft,
  active,
  onInput,
  onSubmit,
}: {
  draft: string;
  /** True while a turn runs: the searchlight beam rides the box's top edge. */
  active: boolean;
  onInput: (value: string) => void;
  onSubmit: (value: string) => void;
}): ReactNode {
  const renderer = useRenderer();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    renderer.setCursorStyle({ style: "underline", blinking: true });
    const id = setInterval(() => setTick((x) => x + 1), CURSOR_STEP_MS);
    return () => clearInterval(id);
  }, [renderer]);
  useEffect(() => {
    renderer.setCursorColor(RGBA.fromHex(rampAt(CURSOR_RAMP, tick * CURSOR_FLOW)));
  }, [renderer, tick]);

  return (
    <box flexDirection="column" backgroundColor={theme.well} paddingLeft={1} paddingRight={1} paddingBottom={1}>
      {active ? <SweepLine /> : <box height={1} />}
      <box
        flexDirection="row"
        height={3}
        border
        borderStyle="heavy"
        borderColor={theme.line}
        backgroundColor={theme.panel}
        paddingRight={1}
      >
        <box backgroundColor={theme.roseDeep} paddingLeft={1} paddingRight={1}>
          <text fg={theme.white}>{">"}</text>
        </box>
        <box width={1} />
        <input
          focused
          flexGrow={1}
          value={draft}
          placeholder="talk to your studio"
          onInput={onInput}
          onSubmit={(value: unknown) => onSubmit(typeof value === "string" ? value : "")}
        />
      </box>
    </box>
  );
}
