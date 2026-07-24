/**
 * The bell channel: the terminal beep (BEL, 0x07). The cheapest nudge, fired on an unfocused or
 * focus-unknown settle. Impure edge: writes only when stdout is a TTY, so a piped run is a silent
 * no-op. BEL is built via fromCharCode to keep the raw control byte out of source.
 */
import type { NotifyAction, NotifyChannel } from "../channel";

const BEL = String.fromCharCode(7);

/** Ring the terminal bell once. */
export const ringBell = (): void => {
  if (process.stdout.isTTY) process.stdout.write(BEL);
};

const channel: NotifyChannel = {
  name: "bell",
  emit: (action: NotifyAction): void => {
    if (action.channel === "bell") ringBell();
  },
};

export default channel;
