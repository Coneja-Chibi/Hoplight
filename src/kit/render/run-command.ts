/**
 * What a slash command is allowed to do, and what happens when one throws.
 *
 * Split out of the render root because it is one concept with one rule: a command reaches the shell
 * through THIS object and nothing else. Assembling it inline made the shell's submit path read as if
 * commands had general access to the session, when the whole point of CommandContext is that they do
 * not - it is a deliberately small set of actions, and keeping the list in one file is what makes it
 * reviewable as a boundary rather than as scattered closures.
 *
 * A command that throws becomes a transcript line, never a crash. Commands are drop-in files, so one
 * of them failing has to cost that command and not the session.
 */
import type { SessionCommandContext } from "../sessions/session-actions";
import type { KitCommand } from "../commands/command";

/** Run a matched command against its context, reporting a failure instead of propagating it. */
export function runCommand(
  command: KitCommand,
  ctx: SessionCommandContext,
  onError: (message: string) => void,
): boolean {
  const say = (error: unknown): void =>
    onError(error instanceof Error ? error.message : String(error));
  try {
    const result = command.run(ctx);
    // An async command has already been ACCEPTED by the time it suspends, so it reports true now and
    // reports its own failure later. Waiting here would freeze the composer on a slow command.
    if (result instanceof Promise) {
      void result.catch(say);
      return true;
    }
    // Only an explicit `false` means "not handled"; a command returning nothing did its job.
    return result !== false;
  } catch (error) {
    say(error);
    return true;
  }
}
