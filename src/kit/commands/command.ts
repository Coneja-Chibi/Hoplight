/**
 * The command shape + matcher: Kit's slash commands as drop-in files (folders-as-schema, mirroring
 * tools/tool.ts). A KitCommand names itself and its aliases, carries a one-line summary (the help
 * stage reads these so help can never drift from what's wired), and runs against a CommandContext,
 * the small set of shell actions a command may take. matchCommand is a pure total function: it turns
 * a raw input line into a command + its argument, or null when nothing matches. This is what replaces
 * the flat if-chain in app.tsx's submit().
 */

export interface CommandContext {
  /** Text after the command word ("" for a bare command); for arg-taking commands later. */
  readonly arg: string;
  /** Every registered command, so a command like /help can enumerate the others. */
  readonly commands: readonly KitCommand[];
  /** Open the provider setup screen (/model, /providers). */
  openSettings: () => void;
  /** Leave Kit (/quit, /q). */
  quit: () => void;
  /** Run the active provider's proof-of-life inside a turn (/test). */
  probe: () => Promise<void>;
  /** Print a line to the transcript (markdown-rendered), e.g. /help's listing. */
  say: (text: string) => void;
}

export interface KitCommand {
  /** The command word, including the leading slash, lowercase (e.g. "/model"). */
  readonly name: string;
  /** Extra words that resolve to the same command (e.g. ["/providers"]). */
  readonly aliases?: readonly string[];
  /** One line shown by the help stage and the slash popup. */
  readonly summary: string;
  run(ctx: CommandContext): void | Promise<void>;
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
