/**
 * The popup over the composer, while a slash line is being typed.
 *
 * TWO STAGES, and the second is the one that was missing everywhere else: after the command word
 * comes its ARGUMENT, and that is the point in the sentence where somebody is least likely to know
 * the answer. `/gates ` offers the three modes; `/art ` offers the characters in the studio. Those
 * lists come from each command's own `complete()`, over the wire, because a completer is code that
 * reads the studio.
 *
 * THE KEYBOARD OWNS IT. Up, down, tab, enter and escape all belong to the popup while it is open,
 * which means the composer has to ask before it treats Enter as send. That is the arrangement in the
 * terminal too, and getting it wrong in the other direction - Enter sending a half-typed command
 * word - is the failure people notice.
 */
import { useEffect, useState, type JSX } from "react";
import type { CommandInfo } from "./command-core";

export interface SlashChoice {
  /** The word or value inserted when this is chosen. */
  readonly value: string;
  /** The line beside it: a command's summary, or an argument's display name. */
  readonly note: string;
}

/** The commands a half-typed word could become, as popup rows. */
export const commandChoices = (matches: readonly CommandInfo[]): SlashChoice[] =>
  matches.map((info) => ({ value: info.name, note: info.summary }));

export function SlashMenu({
  title,
  choices,
  active,
  onPick,
}: {
  title: string;
  choices: readonly SlashChoice[];
  active: number;
  onPick: (index: number) => void;
}): JSX.Element | null {
  /**
   * The highlighted row is scrolled to. A list taller than its box otherwise moves the selection
   * out of sight on the fourth arrow press, which reads as the keyboard having stopped working.
   */
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    box?.querySelector<HTMLElement>(".kit-slash__row--on")?.scrollIntoView({ block: "nearest" });
  }, [box, active]);

  if (choices.length === 0) return null;
  return (
    <div className="kit-slash" ref={setBox} role="listbox" aria-label={title}>
      <div className="kit-slash__head">{title}</div>
      {choices.map((choice, at) => (
        <button
          key={`${choice.value}${String(at)}`}
          type="button"
          role="option"
          aria-selected={at === active}
          className={at === active ? "kit-slash__row kit-slash__row--on" : "kit-slash__row"}
          /**
           * MOUSE DOWN, NOT CLICK. The composer is a textarea with focus; a click fires after the
           * blur, so by the time it lands the caret has left the box somebody is typing into and
           * the inserted text arrives somewhere they are not looking.
           */
          onMouseDown={(event) => { event.preventDefault(); onPick(at); }}
        >
          <span className="kit-slash__word">{choice.value}</span>
          <span className="kit-slash__say">{choice.note}</span>
        </button>
      ))}
    </div>
  );
}
