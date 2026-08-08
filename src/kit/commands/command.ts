/**
 * The command shape + matcher: Kit's slash commands as drop-in files (folders-as-schema, mirroring
 * tools/tool.ts). A KitCommand names itself and its aliases, carries a one-line summary (the help
 * stage reads these so help can never drift from what's wired), and runs against a CommandContext,
 * the small set of shell actions a command may take. matchCommand is a pure total function: it turns
 * a raw input line into a command + its argument, or null when nothing matches. This is what replaces
 * the flat if-chain in app.tsx's submit().
 */

import type { GrantBook } from "../tools/_shared/grant-book";

export interface CommandContext {
  /** Text after the command word ("" for a bare command); for arg-taking commands later. */
  readonly arg: string;
  /** Every registered command, so a command like /help can enumerate the others. */
  readonly commands: readonly KitCommand[];
  /** Current canonical deck counts, exposed on demand by /decks rather than persistent chrome. */
  readonly decks: readonly { label: string; count: number }[];
  /**
   * Files in the studio folder that no deck counts, grouped by why.
   *
   * Reported rather than hidden: a count that quietly excludes most of a folder reads as the folder
   * being smaller, which is the more misleading of the two answers.
   */
  readonly unlisted?: () => Promise<{ reason: string; count: number; examples: string[] }[]>;
  /** Open the provider setup screen (/model, /providers). */
  openSettings: () => void;
  /** Open the full-screen command and keyboard reference (/help, /?). */
  openHelp: () => void;
  /** Open the target-aware semantic capability browser (/tools). */
  openTools?: () => void;
  /** Leave Kit (/quit, /q). */
  quit: () => void;
  /** Run the active provider's proof-of-life inside a turn (/test). */
  probe: () => boolean | Promise<void>;
  /** Run the read-only, bounded diagnostic playbill (/doctor). */
  doctor: () => Promise<void>;
  /** Print a line to the transcript (markdown-rendered), e.g. /help's listing. */
  say: (text: string) => void;
  /**
   * Draw a picture in the transcript (/image, /art).
   *
   * Bytes rather than a path, because the two callers have different sources: one asks the OS for the
   * clipboard, the other resolves a character's media ref. Both arrive as bytes and neither should
   * teach the command layer how to read a file. `note` is what the picture is captioned with, and it
   * is the caller's job because only the caller knows whether this is your clipboard or Wren's face.
   *
   * Optional, so a shell with no renderer bound still runs every command that does not draw.
   */
  showImage?: (bytes: Uint8Array, note: string, source?: string) => void;
  /**
   * Card art (/art). Resolving a written name to one piece can fail in ways a person needs told -
   * nothing matched, several did, or that piece carries no art - so it reports rather than throws,
   * the same shape `rail.open` uses for the same reason.
   */
  readonly art?: {
    show: (query: string) => Promise<{ ok: true } | { ok: false; detail: string }>;
  };
  /**
   * How often Kit asks before it writes (/gates).
   *
   * Reading and setting, because the answer to "stop asking twice" is a standing decision rather
   * than a per-call one, and somebody has to be able to see what it currently is.
   */
  readonly gates?: {
    mode: () => "guarded" | "autopilot" | "full" | "locked";
    set: (mode: "guarded" | "autopilot" | "full") => void;
  };
  /** The gallery strip (/gallery): the shelf of card art along the bottom. */
  readonly gallery?: {
    open: (kind?: string) => Promise<{ ok: true; count: number } | { ok: false; detail: string }>;
    close: () => void;
  };
  /** The /privacy readout: the formatted egress ledger (what has left this machine this session). The
   * shell owns the ledger state and formats it, so a command never reaches into render or session. */
  egressSummary: () => string;
  /** The /context readout: what the NEXT request would carry, before it is sent. Formatted by the
   * shell for the same reason as the ledger: it holds the history and the belt, a command does not. */
  contextPreview: () => string;
  /** The folders shared with Kit for reading (/share, /unshare). Absent when no session is wired, so
   * a command reports the feature missing rather than silently recording nothing. */
  readonly folders?: GrantBook;
  /** The preset rail (/rail). Opening resolves a name to a piece, so it can fail in ways a person
   * needs told: nothing matched, or several did. */
  readonly rail?: {
    open: (query: string) => Promise<{ ok: true } | { ok: false; detail: string }>;
    close: () => void;
  };
  /**
   * The pieces on a shelf, for a command that needs to OFFER them rather than be told one.
   *
   * Deliberately narrow: id and display name, nothing else. A completer needs the word to insert and
   * the word a person recognises, and giving commands a general read of entity bodies would make the
   * command layer a second way into the studio alongside the tools that already own that.
   *
   * Optional, so a shell without a studio bound still runs every command that does not need one.
   */
  readonly pieces?: (kind: string) => Promise<readonly { id: string; name?: string }[]>;
}

export interface KitCommand {
  /** The command word, including the leading slash, lowercase (e.g. "/model"). */
  readonly name: string;
  /** Extra words that resolve to the same command (e.g. ["/providers"]). */
  readonly aliases?: readonly string[];
  /** One line shown by the help stage and the slash popup. */
  readonly summary: string;
  /** Which help section it files under (setup / session / moving / ...); absent falls to Other.
   * Matches HelpCommand.group so /help and the (future) help stage group identically. */
  readonly group?: string;
  /**
   * Candidates for the ARGUMENT after the command word, when it takes one.
   *
   * The slash popup completed the command name and then stopped dead, so `/rail empty-base` had to be
   * typed out in full - a piece id, exactly, from memory, with no list to look at. That is the point
   * in the sentence where a person is least likely to know the answer and most likely to typo it.
   *
   * Declared per command rather than centrally, because only the command knows what its argument IS:
   * `/rail` wants preset ids, `/share` wants folders. `prefix` is what has been typed after the
   * command word so far (possibly empty). Returning [] means "nothing to suggest", which is not the
   * same as "no argument" - the popup simply shows nothing rather than guessing.
   */
  complete?(prefix: string, ctx: CompletionContext): Promise<readonly ArgSuggestion[]>;
  run(ctx: CommandContext): boolean | void | Promise<boolean | void>;
}

/**
 * What a completer may see. Deliberately much narrower than CommandContext.
 *
 * Completion runs on a KEYSTROKE, not on a command, so it must not be able to open a screen, quit,
 * start a turn or write anything - and a context that could would eventually be used to. It also
 * means the composer can offer suggestions without the shell assembling a whole command context for
 * every letter typed.
 */
export interface CompletionContext {
  /** The pieces on a shelf: id, plus the display name a person actually recognises. */
  readonly pieces?: (kind: string) => Promise<readonly { id: string; name?: string }[]>;
  /** The shared folders, for a command whose argument is one. */
  readonly folders?: GrantBook;
}

/** One argument candidate: the value to insert, plus what it is, so a list of ids is readable. */
export interface ArgSuggestion {
  /** The text that replaces the argument when chosen. */
  readonly value: string;
  /** A short right-hand note - a display name, a count, a kind. Never required. */
  readonly note?: string;
}

/**
 * The closest real command to something that did not match, or null when nothing is close.
 *
 * "Unknown command. Try /help" makes a person read a list to find a word they nearly typed. This
 * catches the three ways a guess actually misses: a prefix (`/us` for `/usage`), a word contained in
 * the real one, and a single typo. Anything further away returns null rather than a confident wrong
 * suggestion, because being pointed at the wrong command is worse than being pointed at the list.
 */
export function nearestCommand(
  commands: readonly KitCommand[],
  word: string,
): KitCommand | null {
  const needle = word.toLowerCase().replace(/^\/+/, "");
  if (!needle) return null;
  const names = (command: KitCommand): string[] =>
    [command.name, ...(command.aliases ?? [])].map((n) => n.replace(/^\/+/, ""));

  for (const test of [
    (n: string) => n.startsWith(needle) || needle.startsWith(n),
    (n: string) => n.includes(needle) || needle.includes(n),
    (n: string) => oneEditApart(n, needle),
  ]) {
    const hit = commands.find((command) => names(command).some(test));
    if (hit) return hit;
  }
  return null;
}

/** Within one insertion, deletion or substitution. Enough for a typo, tight enough to stay honest. */
function oneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let slack = 1;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1;
      j += 1;
      continue;
    }
    if (slack-- === 0) return false;
    // A substitution advances both; an insertion advances only the longer side.
    if (short.length === long.length) i += 1;
    j += 1;
  }
  return true;
}

/** Resolve a raw input to a command + its argument. Null when it is not a slash command we know. */
export const matchCommand = (
  commands: readonly KitCommand[],
  raw: string,
): { command: KitCommand; arg: string } | null => {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;
  const space = trimmed.search(/\s/);
  const word = (space === -1 ? trimmed : trimmed.slice(0, space)).toLowerCase();
  const arg = space === -1 ? "" : trimmed.slice(space + 1).trim();
  const command = commands.find((c) => c.name === word || c.aliases?.includes(word));
  return command ? { command, arg } : null;
};
