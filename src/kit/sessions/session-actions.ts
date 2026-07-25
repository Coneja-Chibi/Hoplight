/**
 * The one contract the shell exposes for session memory: the small set of actions the playbill, the
 * rewind rail, and the slash commands all call. app.tsx builds the concrete object from the store plus
 * the pure ops and its own state setters, guarding every mutating call with `if (busy) return`. Keeping
 * this shape in the sessions subtree (not in command.ts) lets the commands and shells share it without
 * the render root having to own the type. Optional on the command context so a command fails closed
 * (says it is unavailable) when the capability is not wired.
 */
import type { CommandContext } from "../commands/command";
import type { Session } from "./session-model";
import type { SessionSummary } from "./projection";

export interface SessionActions {
  /** Every saved session, newest first (the store's tolerant list). */
  list(): Promise<SessionSummary[]>;
  /** Resume a session by id: parse-then-swap; a missing/corrupt file says an error and stays put. */
  open(id: string): Promise<void>;
  /** Rename a saved session's title. */
  rename(id: string, title: string): Promise<void>;
  /** Delete a saved session (idempotent at the store). */
  remove(id: string): Promise<void>;
  /** Start a fresh empty session (opt-in resume model: launch is always blank). */
  fresh(): void;
  /** The in-memory current session (for export and the rewind rail). */
  current(): Session;
  /** Rewind the current session to keep the first `turn` turns, discarding the tail. */
  rewind(turn: number): Promise<void>;
  /** Fork a new session from the first `turn` turns of the current one and switch into it. */
  fork(turn: number): Promise<void>;
  /** Format the current session and write it to the exports directory, saying the path. */
  exportTranscript(format: string): Promise<void>;
  /** Open the full-screen resume playbill. */
  openPlaybill(): void;
  /** Open the rewind rail over the current session. */
  openRail(): void;
}

/** The command context once the sessions capability is wired. Commands narrow to this to reach it. */
export interface SessionCommandContext extends CommandContext {
  readonly sessions?: SessionActions;
}
