/**
 * One key, one intent, one place.
 *
 * THE BUG THIS FIXES. `keymap.ts` opens by promising that "what help teaches and what the keys
 * actually do can never drift" - and nothing enforced it, because KEYMAP was a DISPLAY catalog. The
 * help stage and the hint rows read it; every actual handler was hand-written per component against
 * raw `useKeyboard`. So Kit advertised Shift+Enter, PgUp/PgDn, Home, End and ctrl+o whether or not
 * any component listened, and a person reading the help screen was told about keys that did nothing.
 *
 * Under the doc-vs-code rule that is IMPLEMENT rather than REWRITE: the contract is worth having, so
 * it is made true instead of deleted. Every binding now carries an `intent`, one resolver turns a
 * KeyEvent into an intent, and components subscribe to INTENTS. Adding a binding stays "add a row,
 * nothing central to touch", which is what the file always claimed.
 *
 * Pure and total: no I/O, no state, never throws, and an unrecognised key is `null` rather than a
 * guess. A guess here would fire the wrong action on somebody's keyboard layout.
 */

/** Everything Kit can be asked to do with a key. Extend by adding a row to KEYMAP, not a branch. */
export type Intent =
  // composing
  | "send" | "newline" | "cancel"
  // moving inside the field
  | "char-left" | "char-right" | "word-left" | "word-right" | "line-start" | "line-end"
  // editing
  | "delete-back" | "delete-forward" | "kill-word-back" | "kill-to-start" | "kill-to-end" | "yank"
  // history
  | "recall-prev" | "recall-next" | "reverse-search"
  // lists and rails
  | "up" | "down" | "page-up" | "page-down" | "top" | "bottom" | "open" | "back"
  | "rail-toggle" | "rail-wider" | "rail-narrower" | "rail-density"
  // the app
  | "search" | "fold-trace" | "clear" | "quit" | "help" | "paste-image"
  // safety
  | "allow" | "deny";

/** The shape Kit's key events arrive in; a structural subset of opentui's KeyEvent. */
export interface KeyLike {
  name?: string;
  sequence?: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  option?: boolean;
  /** Which parser produced this. Decides what a bare `meta` means; see chordOf. */
  source?: "raw" | "kitty";
  super?: boolean;
}

/** One binding: the chord as a person reads it, what it does, and which help section it files under. */
export interface Keybinding {
  /** The chord, canonical and lowercase: "ctrl+w", "shift+return", "pgup". */
  readonly chord: string;
  /** The chord as the help stage and hint rows print it. */
  readonly keys: string;
  readonly label: string;
  readonly group: string;
  readonly intent: Intent;
}

/**
 * Canonicalise an event into a chord string.
 *
 * Modifier order is fixed (ctrl, meta, option, shift) so a chord has exactly one spelling and a table
 * lookup cannot miss on ordering.
 *
 * SHIFT IS DROPPED ONLY FROM A BARE PRINTABLE KEY. Typing a capital "A" must not be a different
 * binding from "a" - shift is already expressed in the character, and treating it as a modifier would
 * let a capital letter typed into the composer fire a command. But once ANY other modifier is held,
 * shift is a real distinguishing part of the chord: ctrl+shift+d and ctrl+d are different keys, and
 * the terminal reports them apart (that is what the Kitty protocol's `disambiguate` buys).
 *
 * The first version dropped shift from every printable key, which quietly made every ctrl+shift+letter
 * binding unreachable - the row existed, help printed it, and the chord could never be produced.
 */
export function chordOf(event: KeyLike): string | null {
  const name = (event.name ?? "").toLowerCase();
  if (!name) return null;
  const ctrl = event.ctrl === true;
  /**
   * ALT ARRIVES UNDER TWO NAMES, and reading only one of them is how a whole family of chords went
   * missing. Under the Kitty protocol alt is `option`. Under the raw parser it is the older ESC-prefix
   * convention - alt+v is ESC then "v" - which opentui matches and reports as `meta`. Every terminal
   * has sent the second form for decades; the first is the newcomer.
   *
   * `meta` therefore means alt on the raw path and the real meta modifier on the kitty path, so the
   * source decides. Without `source` the older convention wins, because a bare `meta` with no protocol
   * behind it is an ESC prefix in practice, and treating it as Cmd made every alt row unreachable.
   */
  const kitty = event.source === "kitty";
  const alt = event.option === true || (event.meta === true && !kitty);
  const meta = event.super === true || (event.meta === true && kitty);
  const bare = !ctrl && !meta && !alt;
  const printable = name.length === 1;
  const parts: string[] = [];
  if (ctrl) parts.push("ctrl");
  if (meta) parts.push("meta");
  if (alt) parts.push("alt");
  if (event.shift && !(bare && printable)) parts.push("shift");
  parts.push(name);
  return parts.join("+");
}

/**
 * Kit's bindings. Order within a group is render order under that section in help.
 *
 * The readline set (ctrl+a/e/w/u/k/y) is deliberate rather than nostalgic: it is what every terminal
 * input on the machine already does, so hands that have used a shell already know Kit's composer.
 * That is the convention law applied to keys - structure conventional, novelty only in craft.
 */
export const KEYMAP: readonly Keybinding[] = [
  // composing
  { chord: "return", keys: "Enter", label: "send your message", group: "moving", intent: "send" },
  { chord: "shift+return", keys: "Shift+Enter", label: "add a new line", group: "moving", intent: "newline" },
  { chord: "escape", keys: "Esc", label: "stop the current turn", group: "moving", intent: "cancel" },

  // moving inside the field
  { chord: "left", keys: "Left / Right", label: "move by one character", group: "editing", intent: "char-left" },
  { chord: "right", keys: "", label: "", group: "editing", intent: "char-right" },
  { chord: "ctrl+left", keys: "Ctrl+Left / Right", label: "move by one word", group: "editing", intent: "word-left" },
  { chord: "ctrl+right", keys: "", label: "", group: "editing", intent: "word-right" },
  { chord: "home", keys: "Home / End", label: "jump to the start or end of the line", group: "editing", intent: "line-start" },
  { chord: "end", keys: "", label: "", group: "editing", intent: "line-end" },
  { chord: "ctrl+a", keys: "Ctrl+A / Ctrl+E", label: "start or end of the line", group: "editing", intent: "line-start" },
  { chord: "ctrl+e", keys: "", label: "", group: "editing", intent: "line-end" },

  // editing
  { chord: "backspace", keys: "Backspace", label: "delete the character behind", group: "editing", intent: "delete-back" },
  { chord: "delete", keys: "Delete", label: "delete the character ahead", group: "editing", intent: "delete-forward" },
  { chord: "ctrl+w", keys: "Ctrl+W", label: "delete the word behind", group: "editing", intent: "kill-word-back" },
  { chord: "ctrl+u", keys: "Ctrl+U", label: "delete back to the start", group: "editing", intent: "kill-to-start" },
  { chord: "ctrl+k", keys: "Ctrl+K", label: "delete forward to the end", group: "editing", intent: "kill-to-end" },
  // history
  { chord: "up", keys: "Up / Down", label: "recall what you typed before", group: "moving", intent: "recall-prev" },
  { chord: "down", keys: "", label: "", group: "moving", intent: "recall-next" },

  // lists and rails
  { chord: "pageup", keys: "PgUp / PgDn", label: "scroll the transcript", group: "moving", intent: "page-up" },
  { chord: "pagedown", keys: "", label: "", group: "moving", intent: "page-down" },
  { chord: "ctrl+b", keys: "Ctrl+B", label: "open or close the outline rail", group: "moving", intent: "rail-toggle" },
  { chord: "ctrl+shift+left", keys: "Ctrl+Shift+Left / Right", label: "make the rail narrower or wider", group: "moving", intent: "rail-narrower" },
  { chord: "ctrl+shift+right", keys: "", label: "", group: "moving", intent: "rail-wider" },
  { chord: "ctrl+shift+d", keys: "Ctrl+Shift+D", label: "fit every row, or keep them roomy", group: "moving", intent: "rail-density" },

  // the app
  { chord: "ctrl+f", keys: "Ctrl+F", label: "search the transcript", group: "moving", intent: "search" },
  { chord: "ctrl+o", keys: "Ctrl+O", label: "fold or reopen the latest trace", group: "moving", intent: "fold-trace" },
  // Ctrl+G rather than Alt+V, and the difference is not taste. opentui only sets `option` from a
  // Kitty keyboard modifier bit, and Windows Terminal does not speak that protocol, so an alt chord
  // is advertised and then never arrives. Alt+V still works where Kitty is live; this is the row
  // help can promise on every terminal.
  { chord: "ctrl+g", keys: "Ctrl+G", label: "paste an image from the clipboard", group: "editing", intent: "paste-image" },
] as const;

/**
 * The intents something in Kit actually HANDLES.
 *
 * This exists because the first version of this file recreated the bug it was written to kill. Rows
 * were added for ctrl+Y (yank), ctrl+R (reverse search) and ctrl+L (clear) - all reasonable, none
 * wired to anything - so the help stage advertised three more dead keys than before, and the test
 * passed, because it only checked that a chord RESOLVES TO AN INTENT. Resolving is not handling.
 *
 * Keeping the list here rather than inferring it is deliberate: a handler lives in a component, and
 * no amount of static analysis can tell "this component listens for `send`" from "this component
 * mentions the word send". An explicit list is bookkeeping, but it is bookkeeping CI can check, and
 * the alternative was a help screen nobody could trust.
 *
 * Most of the editing set is handled by opentui's own textarea bindings (ctrl+a/e/w/k/u, word jumps,
 * home/end) rather than by Kit - which is why they are listed and why they work.
 */
export const HANDLED_INTENTS: ReadonlySet<Intent> = new Set<Intent>([
  "send", "newline", "cancel",
  "char-left", "char-right", "word-left", "word-right", "line-start", "line-end",
  "delete-back", "delete-forward", "kill-word-back", "kill-to-start", "kill-to-end",
  "recall-prev", "recall-next",
  "page-up", "page-down",
  "rail-toggle", "rail-wider", "rail-narrower", "rail-density",
  "search", "fold-trace", "paste-image",
]);

/** chord -> intent, built once. A Map (not object indexing) so "__proto__" can never resolve. */
const BY_CHORD: ReadonlyMap<string, Intent> = new Map(KEYMAP.map((b) => [b.chord, b.intent]));

/**
 * The intent this key carries, or null when nothing is bound to it.
 *
 * Null is a real answer and must stay one: a component that receives null passes the key through to
 * whatever wants it (a printable character reaching the composer is the common case), and inventing
 * an intent here would swallow ordinary typing.
 */
export function intentOf(event: KeyLike): Intent | null {
  const chord = chordOf(event);
  return chord ? BY_CHORD.get(chord) ?? null : null;
}

/** Every binding that maps to an intent, for help rendering. Rows with no label are aliases. */
export const bindingsFor = (intent: Intent): Keybinding[] => KEYMAP.filter((b) => b.intent === intent);
