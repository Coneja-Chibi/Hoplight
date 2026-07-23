/** @jsxImportSource @opentui/react */
/**
 * InputBar: the composer (DECISIONS #27), heavy frame + lifted plate + rose cap. A thick "heavy"
 * box border is the neo-brute stamp (a TTY can't fake an offset shadow, it only makes a grey bar);
 * the field sits on a lighter plate for a lift without a shadow. A rose-deep "> " cap block (white
 * ink) is fused to the left border so the prompt is a real stamp, not a floating marker. The caret is
 * a blinking underscore whose color shifts through the spectrum, set on the input itself (it draws
 * its own cursor) via a ref, imperatively, so animating the color never re-renders the field or jumps
 * the caret. No command-hint row (the slash popup surfaces commands on demand).
 */
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { InputRenderable } from "@opentui/core";
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
  const inputRef = useRef<InputRenderable | null>(null);
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.cursorStyle = { style: "underline", blinking: true };
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      input.cursorColor = rampAt(CURSOR_RAMP, n * CURSOR_FLOW);
    }, CURSOR_STEP_MS);
    return () => clearInterval(id);
  }, []);

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
          ref={inputRef}
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
