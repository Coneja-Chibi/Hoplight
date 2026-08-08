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
 * THESE COMMANDS STILL WRITE NOTHING, and that is now a narrower statement than it used to be. This
 * file said "the window never WRITES a session file" - true when it was written, and the reason was
 * sound: the terminal stamps the session it is holding every turn, and a second writer with its own
 * idea of the current session would be two authorities over one folder, the failure being somebody's
 * terminal conversation overwritten by a browser tab.
 *
 * The conclusion was too broad. A conversation held here was never saved at all, so `/resume` could
 * only ever offer the terminal's work and yours died with the tab. The window now stamps its OWN
 * session per turn, under an id that carries a prefix nothing else uses - see window-session.ts,
 * where the refusal lives. Two authorities over one session was the hazard; two surfaces each owning
 * their own is not.
 *
 * What is still deliberately absent HERE: `/resume` reads and replaces what is on screen, `/rewind`
 * scrubs what is on screen, and `/export` writes a transcript FILE (a new file, never a session)
 * through Kit's own formatter. None of them writes a session, because the per-turn stamp already
 * does that and a command that also did would be the second authority all over again.
 *
 * `fresh`, `rename`, `remove` and `fork` exist on SessionActions and no command reaches them, so
 * they refuse rather than pretending. A shell that cannot do a thing says so; it does not no-op.
 */
import { configDir } from "../../kit/providers/config";
import { join } from "node:path";
import { appendTurn, buildTurn, emptySession, type Session } from "../../kit/sessions/session-model";
import { summarize, toHistory, turnBounds } from "../../kit/sessions/projection";
import { createSessionStore, newSessionId } from "../../kit/sessions/store";
import { isWindowSessionId, newWindowSessionId } from "./window-session";
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

      /**
       * RESUMING ADOPTS THE CONVERSATION, it does not just display it.
       *
       * Putting the turns on screen was the whole of resume, and it left the window still writing
       * to some other session - so you resumed a chat, said something to it, restarted, resumed the
       * same chat, and the thing you had just said was not there. It had been saved, into a
       * different file, which is worse than not saving at all because the record looks fine from
       * every angle except the one you check from.
       *
       * A COPY, NEVER THE ORIGINAL. Writing back into `found` is the one thing this file has always
       * refused: the terminal may be holding that very session and stamping it per turn, and two
       * writers is how a conversation loses turns. `parent` records where it came from.
       */
      /**
       * A SESSION THIS WINDOW ALREADY OWNS IS CONTINUED, NEVER COPIED.
       *
       * Forking on every resume was the first build of this, and it littered: resuming your own
       * conversation four times left four near-identical files, each titled by the same opening
       * line, the work spread across them and no way to tell them apart in the picker. The fork
       * exists to avoid writing into a session the TERMINAL may be holding - which is a fact about
       * who owns the id, not about the act of resuming.
       */
      if (isWindowSessionId(found.id)) {
        record({ kind: "session", id: found.id });
        record({
          kind: "say",
          text: `Resumed **${summarize(found).displayTitle}** - ${String(found.turns.length)} turn(s), `
            + `${String(lines.length)} line(s). This one is already yours, so anything you say carries on in it.`,
        });
        return;
      }

      const at = now();
      const mine: Session = {
        ...found,
        id: newWindowSessionId(),
        // Forked from the whole of it, so a reader can see where this continuation came from.
        parent: { id: found.id, turn: found.turns.length },
        createdAt: at,
        updatedAt: at,
      };
      let adopted = false;
      try {
        await store.write(mine);
        adopted = true;
        record({ kind: "session", id: mine.id });
      } catch {
        // Say so rather than pretending: continuing will still answer, it just will not be kept here.
      }

      record({
        kind: "say",
        text: `Resumed **${summarize(found).displayTitle}** - ${String(found.turns.length)} turn(s), `
          + `${String(lines.length)} line(s). This replaced what was on screen; the file you resumed `
          + (adopted
            ? "is untouched, and anything you say from here is saved as a continuation of it."
            : "is untouched. This copy could not be saved, so what you say from here will not be kept."),
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
