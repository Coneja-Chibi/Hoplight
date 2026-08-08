/**
 * What the ask panel shows, and what pressing enter would send.
 *
 * Pure, because the interesting parts are arithmetic nobody looks at: which printed number belongs to
 * which row once two dividers are in the list, what a cursor does at either end, and whether a
 * selection is an answer yet. The version this replaces had none of that - it drew four rows and
 * hoped - and the result was a panel that did not read as touchable and did something unexpected
 * when touched.
 *
 * A NOTE IS NOT AN ANSWER. It qualifies whichever answer you pick, so it is a field rather than a row
 * in the list of answers, and it can be written before or after choosing.
 */

/** One offered answer, as the model gave it. */
export interface AskOption {
  readonly value: string;
  /** The short reason, drawn under its own option rather than out in the right margin. */
  readonly note?: string | undefined;
}

/** Everything the panel needs to draw itself. */
export interface AskState {
  readonly options: readonly AskOption[];
  /** Which pickable row the cursor is on. */
  readonly cursor: number;
  /** What has been typed into "write your own", if anything. */
  readonly own: string;
  /** The note, which rides along with whatever is picked. */
  readonly note: string;
}

/** A row the panel draws. Dividers are drawn but never selected and never numbered. */
export type AskRow =
  | { readonly kind: "option"; readonly value: string; readonly note?: string | undefined }
  | { readonly kind: "own" }
  | { readonly kind: "chat" }
  | { readonly kind: "rule" };

/** A row plus the number printed beside it, or null for a divider. */
export interface NumberedRow {
  readonly row: AskRow;
  readonly number: number | null;
}

/** What "chat about this instead" sends, so the model hears a refusal rather than silence. */
export const CHAT_INSTEAD = "Let's talk about this rather than pick one.";

/**
 * The rows, in order.
 *
 * THE RULE SEPARATES ANSWERING FROM ESCAPING. Writing your own is still an answer, so it sits above
 * the line with the offered ones; chatting instead is not, so it sits below. The note is nowhere
 * here on purpose - it was a numbered row for one draft, which put "add a note" among the things
 * that answer the question, and it answers nothing.
 */
export function askRows(options: readonly AskOption[]): AskRow[] {
  const rows: AskRow[] = options.map((option) => ({
    kind: "option",
    value: option.value,
    ...(option.note === undefined ? {} : { note: option.note }),
  }));
  rows.push({ kind: "rule" });
  rows.push({ kind: "own" });
  rows.push({ kind: "rule" });
  rows.push({ kind: "chat" });
  return rows;
}

/**
 * The rows with their printed numbers.
 *
 * ONLY PICKABLE ROWS COUNT, so the number beside a row is the key that reaches it. Numbering the
 * dividers would make the printed "5" and the 5 key mean different rows, which is the kind of
 * mismatch nobody reports because they assume they misread it.
 */
export function numberedRows(options: readonly AskOption[]): NumberedRow[] {
  let n = 0;
  return askRows(options).map((row) => {
    if (row.kind === "rule") return { row, number: null };
    n += 1;
    return { row, number: n };
  });
}

/** Just the rows a cursor can land on, in order. Index here is what `cursor` means. */
export function pickableRows(options: readonly AskOption[]): AskRow[] {
  return askRows(options).filter((row) => row.kind !== "rule");
}

/** Move the cursor, wrapping at both ends because a short list you cannot loop is a dead end. */
export function moveCursor(state: AskState, delta: number): number {
  const count = pickableRows(state.options).length;
  if (count === 0) return 0;
  return (state.cursor + delta + count) % count;
}

/** The row a printed number reaches, or null when nothing is printed with that number. */
export function rowForNumber(options: readonly AskOption[], number: number): AskRow | null {
  const rows = pickableRows(options);
  return number >= 1 && number <= rows.length ? rows[number - 1]! : null;
}

/**
 * What enter would send right now, or null when the selection is not an answer yet.
 *
 * NULL IS A REAL STATE, not a failure: "write your own" is selected but empty until something is
 * typed into it, and sending an empty answer would put a blank message in the conversation and make
 * the model guess. The panel shows this by having nothing armed.
 */
export function armedAnswer(state: AskState): string | null {
  const rows = pickableRows(state.options);
  const row = rows[state.cursor];
  if (!row) return null;
  if (row.kind === "option") return row.value;
  if (row.kind === "chat") return CHAT_INSTEAD;
  if (row.kind === "own") {
    const typed = state.own.trim();
    return typed.length > 0 ? typed : null;
  }
  return null;
}

/**
 * The whole message an answer becomes, note included.
 *
 * ONE MESSAGE, NOT TWO. "Trackers, but only for the ones with art" is a single thought, and sending
 * the pick and the caveat as separate turns would let the model answer the first before reading the
 * second. Returns null when there is nothing to send.
 */
export function askMessage(state: AskState): string | null {
  const answer = armedAnswer(state);
  if (answer === null) return null;
  const note = state.note.trim();
  return note.length > 0 ? `${answer}\n\nNote: ${note}` : answer;
}
