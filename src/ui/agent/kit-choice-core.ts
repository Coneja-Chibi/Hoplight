/**
 * Reading a `ask_choice` payload, once, at the boundary.
 *
 * WHY A PARSER AND NOT A CAST. This shape is produced by a tool call and travels twice before it is
 * drawn: over the turn's event stream, and then in and out of sessionStorage when the window is
 * unmounted by a navigation. Both are outside the program. A cast would let a malformed frame reach
 * the renderer as `options: undefined` and take the transcript down with it, and a hostile or
 * simply broken payload could put an unbounded wall of text on screen as an "option".
 *
 * The panel's own arithmetic - which printed number reaches which row, what enter would send, how a
 * note rides along - is Kit's `ask-core`, imported. There is one set of those rules.
 */
import type { AskOption } from "../../kit/render/ask/ask-core";

/** A question the agent asked, as the panel draws it. */
export interface AskChoices {
  readonly question: string;
  readonly options: readonly AskOption[];
}

/**
 * Kit's own limits, from src/kit/tools/ask-choice.ts.
 *
 * The tool's schema already enforces these on the way out; they are re-checked on the way in
 * because a limit that only exists at the far end of a wire is not a limit. At least two, because
 * offering one option is not a question.
 */
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 12;
const MAX_QUESTION = 200;
const MAX_VALUE = 200;
const MAX_NOTE = 200;

const text = (value: unknown, cap: number): string =>
  typeof value === "string" ? value.trim().slice(0, cap) : "";

/**
 * The question and its options, or null when there is nothing drawable.
 *
 * NULL IS THE ORDINARY ANSWER for every ragged shape: no payload, no options, one option, options
 * that are not objects. The caller draws nothing, and the tool row still says `ask_choice` ran - so
 * a malformed question degrades to the transcript it would have had before, never to a crash.
 */
export function readChoices(raw: unknown): AskChoices | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const question = text(record["question"], MAX_QUESTION);
  if (!question) return null;
  if (!Array.isArray(record["options"])) return null;

  const options: AskOption[] = [];
  for (const entry of record["options"].slice(0, MAX_OPTIONS)) {
    if (typeof entry !== "object" || entry === null) continue;
    const option = entry as Record<string, unknown>;
    const value = text(option["value"], MAX_VALUE);
    if (!value) continue;
    const note = text(option["note"], MAX_NOTE);
    options.push(note ? { value, note } : { value });
  }
  // Offering one option is not a question - Kit's rule, stated in the tool's own schema.
  return options.length >= MIN_OPTIONS ? { question, options } : null;
}
