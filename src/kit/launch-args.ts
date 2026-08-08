/**
 * What Kit was asked for on the command line.
 *
 * Pure, because an argument parser is exactly the thing that looks obviously correct and is not: a
 * flag that swallows the next token, a value that starts with a dash, `--` meaning stop. Reading it
 * is not evidence, so it is decided here and pressed on in tests.
 *
 * DELIBERATELY TINY. Kit is a terminal app, not a CLI with subcommands - everything else it can do,
 * it does from inside. Only the things you must decide BEFORE the screen exists belong here, and so
 * far that is one question: start blank, or pick up where you left off.
 */

export interface LaunchArgs {
  /**
   * Resume a saved session at launch.
   *
   * `null` starts blank, which stays the default: launching into somebody's last conversation
   * without being asked is how you reply to the wrong thread. `true` means the most recent one; a
   * string names one outright.
   */
  readonly resume: true | string | null;
  /** Print usage and exit rather than opening. */
  readonly help: boolean;
  /** Anything not recognised, so the caller can say so instead of ignoring it. */
  readonly unknown: readonly string[];
}

const RESUME_FLAGS = new Set(["-r", "--resume"]);
const HELP_FLAGS = new Set(["-h", "--help"]);

/**
 * Parse Kit's arguments.
 *
 * `-r` alone resumes the latest; `-r <id>` or `--resume=<id>` names one. A value is only taken when
 * it does not start with a dash, so `kit -r --help` asks for help rather than trying to resume a
 * session called "--help".
 */
export function parseLaunchArgs(argv: readonly string[]): LaunchArgs {
  let resume: true | string | null = null;
  let help = false;
  const unknown: string[] = [];

  for (let at = 0; at < argv.length; at++) {
    const arg = argv[at]!;
    if (HELP_FLAGS.has(arg)) { help = true; continue; }
    if (arg.startsWith("--resume=")) {
      const id = arg.slice("--resume=".length);
      resume = id.length > 0 ? id : true;
      continue;
    }
    if (RESUME_FLAGS.has(arg)) {
      const next = argv[at + 1];
      // Only a real value, never the next flag: `-r` is useful on its own and must stay that way.
      if (next !== undefined && !next.startsWith("-")) { resume = next; at++; }
      else resume = true;
      continue;
    }
    unknown.push(arg);
  }

  return { resume, help, unknown };
}

/** What `--help` prints. Short on purpose: the app explains itself once it is open. */
export const LAUNCH_USAGE = [
  "kit - your Hoplight studio, in the terminal",
  "",
  "  kit                 open a fresh session",
  "  kit -r              pick up the most recent session, rail and all",
  "  kit -r <id>         pick up a particular one",
  "  kit --help          this",
  "",
  "Everything else happens inside: type / for the command list.",
].join("\n");
