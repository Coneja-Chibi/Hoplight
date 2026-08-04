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
  run(ctx: CommandContext): boolean | void | Promise<boolean | void>;
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
