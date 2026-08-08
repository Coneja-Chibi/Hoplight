/**
 * Kit's saved sessions, from the window: `/session`, `/resume`, `/rewind`, `/export`.
 *
 * THE TWO STORES RECONCILE, and that was worth checking rather than assuming. Kit saves a Session -
 * an ordered list of turns, each a written input plus the messages it produced - to a file. The
 * window keeps its conversation in sessionStorage as lines. Those are the same information in two
 * shapes, so a saved session projects onto the window's transcript with `toHistory`, and the
 * window's transcript projects back onto a Session with `buildTurn`. Neither projection invents
 * anything.
 *
 * WHAT IS DELIBERATELY NOT HERE. The window never WRITES a session file. Kit's terminal owns the
 * session it is holding and stamps it per turn; a second writer with a different idea of what the
 * current session is would be two authorities over one folder, and the failure mode is somebody's
 * terminal conversation being overwritten by a browser tab. So `/resume` reads and replaces what is
 * on screen, `/rewind` scrubs what is on screen, and `/export` writes a transcript FILE (which is a
 * new file, never a session) through Kit's own formatter.
 *
 * `fresh`, `rename`, `remove` and `fork` exist on SessionActions and no command reaches them, so
 * they refuse rather than pretending. A shell that cannot do a thing says so; it does not no-op.
 */
import { configDir } from "../../kit/providers/config";
import { join } from "node:path";
import { appendTurn, buildTurn, emptySession, type Session } from "../../kit/sessions/session-model";
import { summarize, toHistory, turnBounds } from "../../kit/sessions/projection";
import { createSessionStore, newSessionId } from "../../kit/sessions/store";
import { formatTranscript } from "../../kit/sessions/transcript";
import type { SessionActions } from "../../kit/sessions/session-actions";
import type { CommandEffect, WidgetRow } from "./command-core";

/** How old a stamp reads at a glance. Enough to tell this morning from last week. */
function ago(at: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${String(minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  return `${String(Math.round(hours / 24))}d ago`;
}

/**
 * The window's conversation as a Session.
 *
 * ONE TURN PER THING SOMEBODY SAID, with the replies that followed attached to it. That is exactly
 * the shape Kit builds as a turn settles, so the export produced from it is the same document a
 * terminal export would be, and the rewind bounds line up with what is on screen.
 */
export function sessionFromMessages(
  messages: readonly { readonly role: "user" | "assistant"; readonly content: string }[],
  id: string,
  now: number,
): Session {
  let session = emptySession(id, now);
  let input: string | null = null;
  let replies: { role: "user" | "assistant"; content: string }[] = [];
  const flush = (): void => {
    if (input === null) return;
    session = appendTurn(session, buildTurn(input, [{ role: "user", content: input }, ...replies], now));
    input = null;
    replies = [];
  };
  for (const message of messages) {
    if (message.role === "user") {
      flush();
      input = message.content;
      continue;
    }
    // An assistant line before anybody spoke cannot belong to a turn. Kept as its own, so a
    // transcript that begins with a greeting still exports every word it contains.
    if (input === null) input = "";
    replies.push({ role: "assistant", content: message.content });
  }
  flush();
  return session;
}

/** A saved session's turns, as the lines the window draws. */
const linesOf = (session: Session): { role: "user" | "assistant"; text: string }[] =>
  toHistory(session)
    // Tool messages are a model's working, not the conversation; the window has no band for one and
    // showing it as speech would put a machine's JSON in the register of something somebody said.
    .filter((m) => m.role !== "tool" && m.content.trim() !== "")
    .map((m) => ({ role: m.role === "assistant" ? "assistant" as const : "user" as const, text: m.content }));

/**
 * Build the window's SessionActions over Kit's real store, recording what each one did.
 *
 * `record` is the same collector the rest of the command context writes into, so a session command
 * and a `ctx.say` from any other command land in the transcript in the order they happened.
 */
export function windowSessions(
  messages: readonly { readonly role: "user" | "assistant"; readonly content: string }[],
  record: (effect: CommandEffect) => void,
  /**
   * Hand back work this started but nobody will await.
   *
   * `openPlaybill` IS DECLARED VOID AND IS CALLED WITHOUT AN AWAIT. In the terminal it flips a view
   * flag, so being synchronous costs nothing; here it has to read a directory, and `/session`
   * returned an empty effect list while the read was still in flight - the command ran, said
   * nothing, and looked exactly like the bug this whole change exists to fix. The shell must not
   * report finished while work it started is still going.
   */
  defer: (work: Promise<unknown>) => void,
  now: () => number = Date.now,
): SessionActions {
  const store = createSessionStore();
  /**
   * ONE SYNTHETIC SESSION PER REQUEST, minted fresh. It is never written, so its id exists only to
   * satisfy the shape and to keep `/resume`'s "other sessions" filter from excluding a real one.
   */
  const current = sessionFromMessages(messages, newSessionId(), now());

  const unavailable = (what: string): void => {
    record({ kind: "say", text: `The window cannot ${what}. Kit's terminal owns the saved session it is holding.` });
  };

  return {
    list: () => store.list(),

    async open(id) {
      const found = await store.read(id);
      if (!found) {
        record({ kind: "say", text: "That session could not be read. It may have been deleted or damaged." });
        return;
      }
      const lines = linesOf(found);
      record({ kind: "transcript", lines });
      record({
        kind: "say",
        text: `Resumed **${summarize(found).displayTitle}** - ${String(found.turns.length)} turn(s), `
          + `${String(lines.length)} line(s). This replaced what was on screen; the saved file is untouched.`,
      });
    },

    openPlaybill() {
      defer(listSessions());
    },

    current: () => current,

    async exportTranscript(format) {
      if (current.turns.length === 0) {
        record({ kind: "say", text: "There is nothing to export yet." });
        return;
      }
      const transcript = formatTranscript(current, format);
      const path = await store.writeExport(join(configDir(), "exports"), transcript.filename, transcript.body);
      record({ kind: "say", text: `Exported this conversation to ${path}` });
    },

    openRail() {
      const bounds = turnBounds(current);
      if (bounds.length === 0) {
        record({ kind: "say", text: "Nothing to rewind to yet. This conversation has fewer than two turns." });
        return;
      }
      record({
        kind: "rows",
        title: "Rewind this conversation",
        rows: bounds.map((bound) => ({
          label: bound.preview,
          note: bound.turn === 0 ? "keep nothing" : `keep ${String(bound.turn)} turn(s)`,
          keep: bound.turn,
        })),
        hint: "This scrubs the window's own conversation. No saved session is edited.",
      });
    },

    // The four Kit's terminal owns. Named individually rather than by one shared stub, so the
    // message says which act was refused.
    rename: async () => { unavailable("rename a saved session"); },
    remove: async () => { unavailable("delete a saved session"); },
    rewind: async () => { unavailable("rewrite a saved session"); },
    fork: async () => { unavailable("fork a saved session"); },
    fresh: () => { unavailable("start a new saved session"); },
  };

  /** The playbill's rows, read and recorded. Started by `openPlaybill`, awaited by the caller. */
  async function listSessions(): Promise<void> {
    const summaries = await store.list();
    if (summaries.length === 0) {
      record({ kind: "say", text: "No saved sessions yet. Kit writes one per conversation in the terminal." });
      return;
    }
    const stamp = now();
    const rows: WidgetRow[] = summaries.slice(0, 40).map((summary) => ({
      label: summary.displayTitle,
      note: `${String(summary.turnCount)} turn(s) · ${ago(summary.updatedAt, stamp)}`,
      // The row types the command a person would have typed, so choosing one and typing it are the
      // same act and the transcript records it either way.
      send: `/resume ${summary.displayTitle}`,
    }));
    record({
      kind: "rows",
      title: "Saved sessions",
      rows,
      hint: "Choosing one replaces this window's conversation. Nothing on disk is changed.",
    });
  }
}
