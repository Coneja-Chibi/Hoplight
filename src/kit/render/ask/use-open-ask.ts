/**
 * The shell's side of the question panel: which question is open, and what answering it does.
 *
 * Here rather than in app.tsx because it is one concern with three moving parts that have to agree -
 * finding the open question, holding its cursor and fields, and closing it when it is answered. The
 * shell only needs to know that a panel exists and hand it a way to speak.
 */
import { useRef } from "react";
import { liveAsk, type LiveAsk } from "../live-choices";
import { useAsk, type AskSession } from "./use-ask";
import type { RenderLine, TurnView } from "../turn-events";

export interface OpenAsk {
  /** The question waiting on an answer, or null. */
  readonly open: LiveAsk | null;
  /** Cursor, fields and key handling for it. */
  readonly ask: AskSession;
}

export function useOpenAsk(
  lines: readonly RenderLine[],
  setTurn: (update: (previous: TurnView) => TurnView) => void,
  send: (message: string) => void,
): OpenAsk {
  /**
   * `answer` is declared below, so the panel reaches it through a ref rather than being hoisted.
   * A captured value would be the one from the render the callback was built in, which is the same
   * staleness that had the rail's commit writing to whichever preset was last open.
   */
  const answerRef = useRef<(message: string) => void>(() => {});
  const ask = useAsk((message) => { answerRef.current(message); });
  const open = liveAsk(lines);

  /**
   * ANSWERING SENDS, and closes the panel in the same breath.
   *
   * The two visible steps in the panel - click selects, enter sends - are what make sending straight
   * to the model safe. Marking the line answered is not cosmetic: options left live in the
   * scrollback invite answering the same question twice after the model has moved on.
   */
  answerRef.current = (message: string): void => {
    const at = open?.index;
    if (at === undefined) return;
    setTurn((previous) => ({
      ...previous,
      lines: previous.lines.map((line, i) =>
        (i === at && line.role === "choices" ? { ...line, answered: message } : line)),
    }));
    send(message);
  };

  /**
   * Point the panel at whatever question is open, and let go when none is.
   *
   * Keyed on the question TEXT as well as its position: a line arriving above it shifts the index,
   * and resetting on that alone would wipe a note somebody had already typed.
   */
  const followed = useRef<string | null>(null);
  const key = open ? `${String(open.index)}:${open.question}` : null;
  if (followed.current !== key) {
    followed.current = key;
    ask.follow(open ? open.options : null);
  }

  return { open, ask };
}
