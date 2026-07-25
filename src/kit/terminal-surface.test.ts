/** Proves Kit seats its cell canvas into the terminal's otherwise unpaintable pixel gutters. */
import { describe, expect, test } from "bun:test";
import { restoreTerminalBackground, setTerminalBackground } from "./terminal-surface";

describe("terminal surface background", () => {
  test("sets the terminal default background from a theme hex and can restore it", () => {
    const writes: string[] = [];
    const terminal = { write: (value: string): void => { writes.push(value); } };

    setTerminalBackground(terminal, "#0e0c10");
    restoreTerminalBackground(terminal);

    expect(writes).toEqual([
      "\u001b]11;rgb:0e/0c/10\u001b\\",
      "\u001b]111\u001b\\",
    ]);
  });

  test("rejects malformed colors instead of writing a partial control sequence", () => {
    const writes: string[] = [];
    expect(() => setTerminalBackground(
      { write: (value: string): void => { writes.push(value); } },
      "not-a-color",
    )).toThrow("six-digit hex");
    expect(writes).toEqual([]);
  });
});
