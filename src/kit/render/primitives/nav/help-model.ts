/**
 * help-model: the pure core of the help stage. buildHelp folds the command registry and the keybinding
 * catalog into one grouped, ordered model (each section holds its commands then its keybindings, so a
 * binding files beside the commands it belongs with, matching the stage sketch); reduce maps a keypress
 * to the next scroll/dismiss state. Both are total, never throw, never mutate their input, the same
 * shape as turn-events.ts and settings/model.ts.
 *
 * buildHelp reads its own minimal HelpCommand shape rather than the full KitCommand so the nav cluster
 * never reaches into command internals: any KitCommand satisfies it structurally, and the optional
 * group is deny-by-absence (an absent or unknown group lands in the Other bucket, a command is never
 * dropped). The section list is derived here from the registry, never hand-maintained, so a dropped-in
 * command with a new group appears without editing the stage.
 */
import type { Keybinding } from "./keymap";

/** The slice of a command the help stage needs; KitCommand satisfies this structurally. */
export interface HelpCommand {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly summary: string;
  /** Optional section id (setup / moving / session / ...); absent falls to the Other bucket. */
  readonly group?: string;
}

/** One rendered row: a key column (a command word + aliases, or a chord) and its one-line note. */
export interface HelpRow {
  readonly keys: string;
  readonly note: string;
}

export interface HelpSection {
  readonly title: string;
  readonly rows: readonly HelpRow[];
}

export interface HelpModel {
  readonly sections: readonly HelpSection[];
}

/** Scroll offset (rows) the shell applies to the content pane, and whether the stage is still open. */
export interface HelpState {
  readonly scroll: number;
  readonly open: boolean;
}

/** A keypress reduced to what the stage cares about. */
export interface KeyInput {
  readonly name: string;
}

const OTHER = "other";

/** Known groups in render order, with their section headings. Unknown groups sort in after these. */
const KNOWN: ReadonlyArray<{ id: string; title: string }> = [
  { id: "setup", title: "SETUP" },
  { id: "moving", title: "MOVING AROUND" },
  { id: "session", title: "SESSION" },
];

const groupOf = (value: string | undefined): string => {
  const g = (value ?? "").trim().toLowerCase();
  return g === "" ? OTHER : g;
};

const commandRow = (command: HelpCommand): HelpRow => {
  const also = command.aliases && command.aliases.length > 0 ? `  (${command.aliases.join(", ")})` : "";
  return { keys: `${command.name}${also}`, note: command.summary };
};

const bindingRow = (binding: Keybinding): HelpRow => ({ keys: binding.keys, note: binding.label });

/** Append a row under its group id, opening the bucket on first sight. */
const bucket = (map: Map<string, HelpRow[]>, id: string, row: HelpRow): void => {
  const rows = map.get(id);
  if (rows) rows.push(row);
  else map.set(id, [row]);
};

/** The section ids to render, in order: known groups first, then unknown named groups (alpha), Other
 * last. Only ids that actually carry rows are included (deny-by-absence, no empty headings). */
const orderedGroups = (present: ReadonlySet<string>): string[] => {
  const known = KNOWN.map((k) => k.id).filter((id) => present.has(id));
  const unknown = [...present]
    .filter((id) => id !== OTHER && !KNOWN.some((k) => k.id === id))
    .sort((a, b) => a.localeCompare(b));
  const other = present.has(OTHER) ? [OTHER] : [];
  return [...known, ...unknown, ...other];
};

const titleOf = (id: string): string =>
  KNOWN.find((k) => k.id === id)?.title ?? (id === OTHER ? "OTHER" : id.toUpperCase());

/**
 * Bucket commands and keybindings into ordered sections. Total: an empty command list still yields the
 * keybinding-bearing sections (never a blank screen); an unknown or absent group lands in Other.
 */
export function buildHelp(
  commands: readonly HelpCommand[],
  keymap: readonly Keybinding[],
): HelpModel {
  const commandsBy = new Map<string, HelpRow[]>();
  for (const command of commands) bucket(commandsBy, groupOf(command.group), commandRow(command));
  const bindingsBy = new Map<string, HelpRow[]>();
  for (const binding of keymap) {
    // ALIAS ROWS ARE NOT HELP ROWS. A pair like Left / Right is one printed line covering two
    // bindings, so the second carries an empty label and must not become a blank row on the stage.
    // (It did, briefly: the help screen grew empty lines the moment aliases were introduced.)
    if (binding.label === "") continue;
    bucket(bindingsBy, groupOf(binding.group), bindingRow(binding));
  }
  const present = new Set<string>([...commandsBy.keys(), ...bindingsBy.keys()]);
  const sections = orderedGroups(present).map((id) => ({
    title: titleOf(id),
    rows: [...(commandsBy.get(id) ?? []), ...(bindingsBy.get(id) ?? [])],
  }));
  return { sections };
}

const PAGE = 8;

export const initHelp = (): HelpState => ({ scroll: 0, open: true });

/**
 * Fold a keypress into the stage state. esc or q closes (even mid-scroll, so the overlay never traps);
 * up/down and PgUp/PgDn move the content pane; any other key returns the same state unchanged.
 */
export function reduce(state: HelpState, key: KeyInput): HelpState {
  switch (key.name) {
    case "escape":
    case "q":
      return { ...state, open: false };
    case "up":
      return { ...state, scroll: Math.max(0, state.scroll - 1) };
    case "down":
      return { ...state, scroll: state.scroll + 1 };
    case "pageup":
      return { ...state, scroll: Math.max(0, state.scroll - PAGE) };
    case "pagedown":
      return { ...state, scroll: state.scroll + PAGE };
    default:
      return state;
  }
}
