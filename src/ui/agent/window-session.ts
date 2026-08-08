/**
 * The window's own saved session, stamped per turn.
 *
 * WHY THIS EXISTS. The window could read sessions and never wrote one, so every conversation held
 * here lived in sessionStorage: it survived a reload, died with the tab, and `/resume` could only
 * offer sessions the TERMINAL had written. Asked to resume its own work, the window handed you
 * somebody else's conversation, because yours was never saved.
 *
 * THE FEAR THAT STOPPED IT WAS REAL AND THE ANSWER WAS TOO BROAD. Two writers over ONE session file
 * is a genuine hazard - the terminal stamps its session every turn, and a browser tab stamping the
 * same file would lose turns to whoever wrote last. But that is an argument for each surface owning
 * its own session, not for one of them never saving.
 *
 * SO THE OWNERSHIP IS IN THE ID, not in a convention somebody has to remember. A window session id
 * carries a prefix, and this module refuses to write anything without it. A page cannot name a
 * terminal session and have it appended to, however the request is shaped, because the refusal is at
 * the boundary rather than in the caller's good manners.
 */
import { appendTurn, buildTurn, emptySession, type Session } from "../../kit/sessions/session-model";
import { createSessionStore, newSessionId } from "../../kit/sessions/store";
import type { ModelMessage } from "../../kit/providers/provider";

/** What marks a session as the window's. The terminal's ids are bare uuids and never match. */
const WINDOW_PREFIX = "w-";

/** The store's own filename rule, re-checked here so an id is safe before it reaches a path. */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export const newWindowSessionId = (): string => `${WINDOW_PREFIX}${newSessionId()}`;

/**
 * Is this an id the window is allowed to write?
 *
 * FAIL CLOSED, and deliberately narrow: prefix, charset, and length. The id becomes a filename, so
 * this is the last place a `../` or a two-kilobyte string can be turned away before it is one.
 */
export const isWindowSessionId = (value: unknown): value is string =>
  typeof value === "string"
  && value.length > WINDOW_PREFIX.length
  && value.length <= 80
  && value.startsWith(WINDOW_PREFIX)
  && SAFE_ID.test(value);

/**
 * The messages this turn added, with the standing instruction taken back out.
 *
 * THE PROMPT THE MODEL SAW IS NOT THE PROMPT THE PERSON WROTE. The window prepends the system
 * guidance and the screen brief to the question before handing it to the loop, so the first message
 * of the delta holds a fenced description of whatever app was open. Saved as-is, every session file
 * would carry a copy of somebody's screen, and a replay would show it as words they typed.
 */
export function turnMessages(
  all: readonly ModelMessage[],
  historyLength: number,
  question: string,
): ModelMessage[] {
  const delta = all.slice(historyLength).map((m) => ({ ...m }));
  const first = delta[0];
  if (first && first.role === "user") first.content = question;
  return delta;
}

/**
 * Append one finished turn to the window's session.
 *
 * TOTAL: a session that cannot be written must not take the turn down with it. The conversation
 * already happened and is on screen; losing the record of it is bad, and losing the answer as well
 * because the record failed would be worse.
 */
export type RecordResult =
  | { readonly saved: true; readonly id: string; readonly turns: number }
  | { readonly saved: false; readonly why: string };

export async function recordWindowTurn(input: {
  readonly sessionId: string;
  readonly question: string;
  readonly messages: readonly ModelMessage[];
  readonly historyLength: number;
  readonly now?: () => number;
}): Promise<RecordResult> {
  if (!isWindowSessionId(input.sessionId)) {
    return { saved: false, why: `not a window session id: ${String(input.sessionId).slice(0, 40)}` };
  }
  const delta = turnMessages(input.messages, input.historyLength, input.question);
  if (delta.length === 0) {
    /**
     * The turn produced nothing to record. Worth SAYING rather than passing over: it is what an
     * aborted turn looks like, and also what a turn that never reached a provider looks like, and
     * the two are hard to tell apart from the outside.
     */
    return {
      saved: false,
      why: `no new messages (${input.messages.length} total, ${String(input.historyLength)} were history)`,
    };
  }
  const at = (input.now ?? Date.now)();
  try {
    const store = createSessionStore();
    const held: Session = (await store.read(input.sessionId)) ?? emptySession(input.sessionId, at);
    const next = appendTurn(held, buildTurn(input.question, delta, at));
    await store.write(next);
    return { saved: true, id: next.id, turns: next.turns.length };
  } catch (error) {
    /**
     * THE TURN STILL STANDS - but the failure is reported now instead of swallowed. Silently
     * dropping it meant a conversation that was never saved looked exactly like one that was, and
     * the only way to find out was to go looking for a file that had never existed.
     */
    return { saved: false, why: error instanceof Error ? error.message : String(error) };
  }
}
