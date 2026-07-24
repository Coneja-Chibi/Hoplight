/**
 * keymap: the static catalog of Kit's keyboard bindings, one drop-in data table. The help stage reads
 * it (buildHelp buckets each entry into its group section beside the slash commands) and the
 * footer/status hints read it too, so what help teaches and what the keys actually do can never drift.
 * Data only, no I/O, no logic: adding a binding is adding a row here, nothing central to touch.
 *
 * group matches the command groups (setup / moving / session) so a binding files into the same
 * section as the commands it belongs with; an unknown group falls to the Other bucket in buildHelp.
 */

/** One keyboard binding as the help stage and the hint rows render it. */
export interface Keybinding {
  /** The key or chord, shown verbatim (e.g. "ctrl+f", "PgUp / PgDn", "Enter"). */
  readonly keys: string;
  /** What it does, one short line. */
  readonly label: string;
  /** Which help section it files under; matches KitCommand.group. */
  readonly group: string;
}

/** Kit's live bindings. Order within a group is render order under that section. Grouping follows the
 * stage sketch: every movement binding files under MOVING AROUND beside the /help command. */
export const KEYMAP: readonly Keybinding[] = [
  { keys: "Enter", label: "send your message", group: "moving" },
  { keys: "Shift+Enter", label: "add a new line", group: "moving" },
  { keys: "ctrl+f", label: "search the transcript", group: "moving" },
  { keys: "up / down", label: "recall what you typed before", group: "moving" },
  { keys: "PgUp / PgDn", label: "scroll the transcript", group: "moving" },
  { keys: "End", label: "jump to the latest reply", group: "moving" },
  { keys: "Home", label: "jump to the top", group: "moving" },
  { keys: "ctrl+o", label: "fold or reopen the latest trace", group: "moving" },
] as const;
