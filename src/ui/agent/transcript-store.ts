/**
 * Keeping the conversation across a navigation.
 *
 * THE TWO DESIGN DECISIONS USED TO CANCEL EACH OTHER OUT. The agent describes the screen you came
 * FROM, so giving it a useful surface means going and looking at something. But the shell swaps
 * apps through one slot, so going and looking unmounted the window - and the transcript lived in
 * component state, so the act of giving the agent context destroyed the conversation about it.
 *
 * sessionStorage rather than the shell store, for the reason the live surface is not in the store
 * either: this changes on every token, and every store write rebuilds the app context and repaints
 * the whole shell. Per-tab and cleared when the browser session ends, which is the right lifetime -
 * a conversation about what was on screen an hour ago is not worth restoring.
 *
 * TOTAL. Storage throws in private modes and when a quota is full, and a window that could not save
 * a transcript must still be a working window.
 */
import { readChoices } from "./kit-choice-core";
import { parseWidget } from "./command-core";
import type { ChatLine } from "./turn";

const KEY = "hoplight.agent.transcript";
/** Bounded so one long session cannot fill the quota and break unrelated storage. */
const MAX_LINES = 200;
const MAX_CHARS = 200_000;

/**
 * A restored line is a ChatLine, not a narrower shape.
 *
 * IT USED TO BE NARROWER AND IT WAS A LIE. The guard only ever checked role and text, so anything
 * else on a line - which tool it was, the question it asked, whether a long reply was folded -
 * rode through `JSON.parse` and out the other side as a field the types said was not there. Naming
 * the real type and REBUILDING each line from it means what survives a navigation is decided here
 * on purpose rather than by whatever `filter` happened not to strip.
 */
export type StoredLine = ChatLine;

const isLine = (v: unknown): v is ChatLine =>
  typeof v === "object" && v !== null
  && typeof (v as ChatLine).text === "string"
  && ["user", "assistant", "tool", "kit"].includes((v as ChatLine).role);

/**
 * One stored line, rebuilt field by field.
 *
 * The choices are re-parsed rather than trusted. They were validated on the way in from the stream,
 * and then they sat in storage - which anything on the machine can edit - so they cross a boundary
 * a second time coming back and are read a second time.
 */
const restore = (line: ChatLine): ChatLine => {
  const asked = readChoices(line.choices);
  const widget = parseWidget(line.widget);
  return {
    role: line.role,
    text: line.text,
    ...(typeof line.tool === "string" ? { tool: line.tool } : {}),
    ...(asked ? { choices: asked } : {}),
    ...(widget ? { widget } : {}),
    ...(typeof line.answered === "string" ? { answered: line.answered } : {}),
    ...(typeof line.open === "boolean" ? { open: line.open } : {}),
  };
};

/**
 * A line as it goes INTO storage, with any picture taken out of it.
 *
 * THIS IS A QUOTA DEFENCE, NOT A TIDINESS ONE. A shown picture is a base64 `data:` URL, which is
 * megabytes; the budget below counts `text.length` and would not see it, so one `/art` would push
 * the write past the storage quota, the write would throw, the catch would swallow it, and the
 * transcript would silently stop persisting from then on. The failure is invisible and total, which
 * is the worst combination.
 *
 * So the caption survives a navigation and the bytes do not. The alternative - holding the bytes
 * server-side behind an id - buys a picture that comes back after a reload, at the price of a second
 * store with its own lifetime. Running the command again is cheaper than that.
 */
const forStorage = (line: ChatLine): ChatLine => {
  if (line.widget?.kind !== "images") return line;
  const { widget: _dropped, ...rest } = line;
  return rest;
};

export function loadTranscript(): StoredLine[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Filtered rather than trusted: this is our own data, but it is data from outside the program.
    return Array.isArray(parsed) ? parsed.filter(isLine).map(restore) : [];
  } catch {
    return [];
  }
}

export function saveTranscript(lines: readonly StoredLine[]): void {
  try {
    // The TAIL is kept. A long conversation's recent turns are the ones worth coming back to.
    let keep = lines.slice(-MAX_LINES).map(forStorage);
    while (keep.length > 1 && keep.reduce((n, l) => n + l.text.length, 0) > MAX_CHARS) {
      keep = keep.slice(1);
    }
    sessionStorage.setItem(KEY, JSON.stringify(keep));
  } catch {
    // Private mode, a full quota, or no storage at all. The conversation still works; it just will
    // not survive a navigation, which is better than the window failing to render.
  }
}

export function clearTranscript(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* nothing to clear if storage is unavailable */ }
}
