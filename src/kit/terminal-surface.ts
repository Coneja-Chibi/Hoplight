/**
 * Seat Kit's cell canvas into the terminal window. A terminal app can paint only whole character
 * cells; OSC 11 gives the terminal emulator's leftover pixel gutters the same stage color.
 */

export interface TerminalWriter {
  write(value: string): unknown;
}

const HEX_COLOR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

export function setTerminalBackground(terminal: TerminalWriter, color: string): void {
  const channels = HEX_COLOR.exec(color);
  if (!channels) {
    throw new Error("Terminal background must be a six-digit hex color");
  }
  terminal.write(`\u001b]11;rgb:${channels[1]}/${channels[2]}/${channels[3]}\u001b\\`);
}

export function restoreTerminalBackground(terminal: TerminalWriter): void {
  terminal.write("\u001b]111\u001b\\");
}
