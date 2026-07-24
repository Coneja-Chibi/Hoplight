/**
 * The title channel: OSC 2 set-title, plus save/restore of the terminal's original title through the
 * XTWINOPS window-title stack (CSI 22;2t push on mount, CSI 23;2t pop on release). The stack is what
 * lets Kit restore the user's real title without a portable way to READ it back. Impure edge: writes
 * escape codes only when stdout is a TTY, so a piped run is a silent no-op. use-notify.ts owns the
 * mount/unmount lifecycle and drives saveTitle/restoreTitle; the default NotifyChannel handles the
 * per-settle title action. ESC/BEL are built via fromCharCode to keep raw control bytes out of source.
 */
import type { NotifyAction, NotifyChannel } from "../channel";

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);

const write = (seq: string): void => {
  if (process.stdout.isTTY) process.stdout.write(seq);
};

/** Set the terminal window title (OSC 2). */
export const setTitle = (text: string): void => write(`${ESC}]2;${text}${BEL}`);

/** Push the current window title onto the terminal's title stack (paired with restoreTitle). */
export const saveTitle = (): void => write(`${ESC}[22;2t`);

/** Pop the saved window title back off the stack, restoring what the user had before Kit started. */
export const restoreTitle = (): void => write(`${ESC}[23;2t`);

const channel: NotifyChannel = {
  name: "title",
  emit: (action: NotifyAction): void => {
    if (action.channel === "title") setTitle(action.text);
  },
};

export default channel;
