/** @jsxImportSource @opentui/react */
/**
 * ThoughtBox, the open rehearsal (DECISIONS #25): while the model reasons, its live thought streams
 * in a dim seam-bordered box. A slim uppercase REHEARSAL header wears the deep-rose stamp clock
 * (whole-turn elapsed) at its right. The stagehand never shares the stage with this box. Capped to
 * the freshest slice of the thought; the full text lands in the transcript when it bows out.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { theme } from "../theme";

const TAIL_CHARS = 380; // roughly six rows of a typical pane

const clock = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function ThoughtBox({ text, startedAt }: { text: string; startedAt: number }): ReactNode {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((prev) => prev + 1), 250);
    return () => clearInterval(timer);
  }, []);
  const tail = text.length > TAIL_CHARS ? text.slice(text.length - TAIL_CHARS) : text;
  return (
    <box flexDirection="column" border borderColor={theme.line} backgroundColor={theme.floor}>
      <box flexDirection="row" backgroundColor={theme.floor} paddingLeft={1} paddingRight={1}>
        <text fg={theme.mut}>REHEARSAL</text>
        <box flexGrow={1} />
        <box backgroundColor={theme.roseDeep} paddingLeft={1} paddingRight={1}>
          <text fg={theme.white}>{clock(Date.now() - startedAt)}</text>
        </box>
      </box>
      <box paddingLeft={1} paddingRight={1}>
        <text fg={theme.mut}>{tail || "..."}</text>
      </box>
    </box>
  );
}
