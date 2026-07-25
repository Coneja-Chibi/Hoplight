/**
 * The desktop channel: an OS notification via terminal escape codes, the heaviest nudge, fired only on
 * a strictly-unfocused settle. Emits both OSC 777 (title + body; urxvt and kin) and OSC 9 (single line;
 * iTerm2, WezTerm) for broad coverage; a terminal honoring both is rare enough that a double toast is
 * an acceptable cost, and a terminal honoring neither drops both silently. Impure edge: writes only
 * when stdout is a TTY. Control bytes are built via fromCharCode to keep them out of source.
 */
import type { NotifyAction, NotifyChannel } from "../channel";

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const TITLE = "Kit";

const write = (seq: string): void => {
  if (process.stdout.isTTY) process.stdout.write(seq);
};

/** Fire a desktop notification carrying a fixed "Kit" title and the given body. */
export const notifyDesktop = (body: string): void => {
  write(`${ESC}]777;notify;${TITLE};${body}${BEL}`);
  write(`${ESC}]9;${body}${BEL}`);
};

const channel: NotifyChannel = {
  name: "desktop",
  emit: (action: NotifyAction): void => {
    if (action.channel === "desktop") notifyDesktop(action.body);
  },
};

export default channel;
