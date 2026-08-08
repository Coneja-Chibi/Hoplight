/**
 * Every key the rail answers to, decided in one place.
 *
 * WHY THIS EXISTS. There were eighteen bindings in an if-chain, added one at a time over months.
 * Each was reasonable the day it went in and nobody ever laid them out together, so the set drifted
 * into contradictions that only showed up in use: `r` renamed a block and `shift+R` renamed the whole
 * preset, one key apart; Enter opened a row or applied every staged change depending on state; Escape
 * meant three different things, one of which threw work away; Tab and Enter both opened a row.
 *
 * A LIST YOU CAN READ IS A LIST YOU CAN CHECK. As a table, "does any key mean two things" is a
 * question somebody can answer by looking, and a test can answer by iterating. As an if-chain it was
 * a question nobody could answer at all.
 *
 * ONE KEY, ONE MEANING. That is the rule this file exists to hold, and there is a test that reads the
 * table and fails if it is ever broken again.
 */

/** Everything the rail can be asked to do. */
export type RailAction =
  | "focus-next"
  | "cursor-up" | "cursor-down"
  | "step-prev" | "step-next"
  | "open-row"
  | "edit-body" | "rename-block" | "rename-preset" | "note"
  | "toggle" | "remove" | "select-all"
  | "save"
  | "move-up" | "move-down"
  | "extend-up" | "extend-down"
  | "drop-edits"
  | "wider" | "narrower" | "density"
  | "menu"
  | "close";

/** Just the parts of a key event the map reads. */
export interface RailKey {
  readonly name?: string | undefined;
  readonly sequence?: string | undefined;
  readonly ctrl?: boolean | undefined;
  readonly shift?: boolean | undefined;
  readonly meta?: boolean | undefined;
  readonly option?: boolean | undefined;
}

/** One row of the table: what to press, what it does, and how to say so. */
export interface Binding {
  readonly action: RailAction;
  /** How the key is written on screen. */
  readonly label: string;
  /** What it does, in words somebody reads once. */
  readonly says: string;
  /** Shown in the footer. Five of these, and no more. */
  readonly footer?: boolean;
  /**
   * A deliberate second key for an action that already has one.
   *
   * The rule worth holding is that no CHORD means two things. "No action has two keys" is stricter
   * than that and costs real conventions - Delete and Backspace both delete in every list ever
   * built. Marked so the duplicate is a decision somebody made, not one that crept in.
   */
  readonly alias?: boolean;
  /** Which part of the menu it belongs under. */
  readonly group: "block" | "preset" | "view";
  readonly name: string;
  readonly ctrl?: boolean;
  readonly shift?: boolean;
  readonly option?: boolean;
  /** Matched on the typed sequence instead of the key name, for punctuation. */
  readonly sequence?: string;
}

/**
 * The table.
 *
 * TAB MOVES FOCUS, which is what Tab means everywhere, and replaces ctrl+b - a chord nothing on
 * screen could teach you and which gated every other key in the rail. Tab used to expand a row, a job
 * Enter already did.
 *
 * ENTER OPENS A ROW AND ONLY THAT. It used to also apply every staged change when anything was
 * pending, so the same key was a harmless look or a write depending on state nobody could see.
 * Saving is `s`, always.
 *
 * ESCAPE CLOSES WHAT IS OPEN and nothing else. Dropping staged edits was its third meaning and the
 * only destructive one; it is a named item in the menu now, where it can be read before it is chosen.
 */
export const RAIL_KEYS: readonly Binding[] = [
  { action: "open-row", name: "return", label: "enter", says: "open this block", footer: true, group: "block" },
  { action: "edit-body", name: "e", label: "e", says: "edit the text", footer: true, group: "block" },
  { action: "toggle", name: "space", label: "space", says: "switch it on or off", footer: true, group: "block" },
  { action: "save", name: "s", label: "s", says: "save everything staged", footer: true, group: "preset" },
  { action: "menu", name: "?", sequence: "?", label: "?", says: "everything else", footer: true, group: "view" },

  { action: "rename-block", name: "r", label: "r", says: "rename this block", group: "block" },
  { action: "remove", name: "delete", label: "del", says: "remove the selected blocks", group: "block" },
  { action: "remove", name: "backspace", label: "backspace", says: "remove the selected blocks", group: "block", alias: true },
  { action: "move-up", name: "up", option: true, label: "alt+up", says: "move it up", group: "block" },
  { action: "move-down", name: "down", option: true, label: "alt+down", says: "move it down", group: "block" },

  { action: "rename-preset", name: "t", label: "t", says: "rename the preset", group: "preset" },
  { action: "note", name: "n", label: "n", says: "leave a note", group: "preset" },
  { action: "select-all", name: "a", ctrl: true, label: "ctrl+a", says: "select every block", group: "preset" },
  /**
   * Dropping staged edits used to be escape pressed twice, which made escape mean three things and
   * put the only destructive one behind the key people press to get out of trouble. Named, and on
   * the chord that means undo everywhere else.
   */
  { action: "drop-edits", name: "z", ctrl: true, label: "ctrl+z", says: "throw away everything staged", group: "preset" },

  { action: "focus-next", name: "tab", label: "tab", says: "back to typing", group: "view" },
  { action: "cursor-up", name: "up", label: "up", says: "move the cursor", group: "view" },
  { action: "cursor-down", name: "down", label: "down", says: "move the cursor", group: "view" },
  { action: "extend-up", name: "up", shift: true, label: "shift+up", says: "add the row above to the selection", group: "view" },
  { action: "extend-down", name: "down", shift: true, label: "shift+down", says: "add the row below", group: "view" },
  { action: "step-prev", name: "left", label: "left", says: "the preset before this one", group: "view" },
  { action: "step-next", name: "right", label: "right", says: "the preset after this one", group: "view" },
  { action: "narrower", name: "left", ctrl: true, shift: true, label: "ctrl+shift+left", says: "narrower", group: "view" },
  { action: "wider", name: "right", ctrl: true, shift: true, label: "ctrl+shift+right", says: "wider", group: "view" },
  { action: "density", name: "d", ctrl: true, shift: true, label: "ctrl+shift+d", says: "fit more rows", group: "view" },
  { action: "close", name: "escape", label: "esc", says: "close this", group: "view" },
];

const wants = (binding: Binding, key: RailKey): boolean => {
  // Absent means "must NOT be held". A binding that ignored modifiers would swallow the chord
  // versions of its own key, which is how ctrl+shift+left once resized AND stepped a preset.
  if ((binding.ctrl === true) !== (key.ctrl === true)) return false;
  if ((binding.shift === true) !== (key.shift === true)) return false;
  if ((binding.option === true) !== (key.option === true)) return false;
  if (key.meta === true) return false;
  if (binding.sequence !== undefined) return key.sequence === binding.sequence;
  return binding.name === key.name;
};

/**
 * What this key means, or null to let it through.
 *
 * MOST SPECIFIC WINS by construction: the table is walked in order and the chorded entries sit above
 * the bare ones for the same key, so ctrl+shift+left resizes rather than stepping.
 */
export function railAction(key: RailKey): RailAction | null {
  const found = RAIL_KEYS.find((binding) => wants(binding, key));
  return found ? found.action : null;
}

/** The five in the footer, in the order they are shown. */
export const footerKeys = (): readonly Binding[] => RAIL_KEYS.filter((b) => b.footer === true);

/** Everything, grouped, for the `?` menu. */
export const keysInGroup = (group: Binding["group"]): readonly Binding[] =>
  // Aliases are real keys and bad menu rows: one action listed twice reads as two things.
  RAIL_KEYS.filter((b) => b.group === group && b.alias !== true);
