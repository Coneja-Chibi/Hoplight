/**
 * The key layer, tested on the properties that were actually broken.
 *
 * The old KEYMAP was a display catalog whose header promised help and behaviour could never drift,
 * with nothing enforcing it. The test that matters is therefore not "ctrl+w returns kill-word-back" -
 * it is that EVERY advertised row resolves, so the help screen cannot advertise a dead key again.
 */
import { describe, expect, test } from "bun:test";
import { chordOf, HANDLED_INTENTS, intentOf, KEYMAP, type Intent } from "./intent";

describe("help cannot advertise a key that does nothing", () => {
  test("every KEYMAP row's chord resolves back to that row's intent", () => {
    // This is the whole contract. A row added with a typo'd chord fails here, in CI, instead of
    // being printed on the help stage and quietly doing nothing when pressed.
    const broken: string[] = [];
    for (const b of KEYMAP) {
      const parts = b.chord.split("+");
      const name = parts[parts.length - 1]!;
      const event = {
        name,
        ctrl: parts.includes("ctrl"),
        meta: parts.includes("meta"),
        option: parts.includes("alt"),
        shift: parts.includes("shift"),
      };
      const got = intentOf(event);
      if (got !== b.intent) broken.push(`${b.chord} -> ${got ?? "null"}, expected ${b.intent}`);
    }
    expect(broken).toEqual([]);
  });

  test("every advertised row reaches something that HANDLES it", () => {
    /**
     * The test above proves a chord resolves to an intent. That is not the same as the key doing
     * anything, and the gap was real: rows for ctrl+Y, ctrl+R and ctrl+L resolved perfectly and were
     * wired to nothing, so the help stage advertised three MORE dead keys than before this file
     * existed - while the suite stayed green.
     *
     * A row added without a handler now fails here, which is the guarantee the original keymap
     * header claimed and never had.
     */
    const unhandled = KEYMAP
      .filter((b) => !HANDLED_INTENTS.has(b.intent))
      .map((b) => `${b.chord} -> ${b.intent}`);
    expect(unhandled).toEqual([]);
  });

  test("no two rows claim the same chord", () => {
    // Two rows for one chord means one of them silently never fires, which is the same class of
    // lie as advertising an unbound key.
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const b of KEYMAP) {
      const prior = seen.get(b.chord);
      if (prior) clashes.push(`${b.chord}: ${prior} and ${b.intent}`);
      else seen.set(b.chord, b.intent);
    }
    expect(clashes).toEqual([]);
  });

  test("the bindings Kit has always advertised are all bound", () => {
    // The exact list the old display-only KEYMAP printed. Each of these was on the help screen while
    // possibly reaching no handler at all.
    const promised: Array<[Record<string, unknown>, Intent]> = [
      [{ name: "return" }, "send"],
      [{ name: "return", shift: true }, "newline"],
      [{ name: "f", ctrl: true }, "search"],
      [{ name: "up" }, "recall-prev"],
      [{ name: "down" }, "recall-next"],
      [{ name: "pageup" }, "page-up"],
      [{ name: "pagedown" }, "page-down"],
      [{ name: "o", ctrl: true }, "fold-trace"],
    ];
    for (const [event, intent] of promised) expect(intentOf(event)).toBe(intent);
  });
});

describe("chord spelling", () => {
  test("modifier order is fixed, so one keypress has exactly one spelling", () => {
    expect(chordOf({ name: "left", ctrl: true, shift: true })).toBe("ctrl+shift+left");
    // Same keypress described in a different order by the terminal still lands on the same chord.
    expect(chordOf({ name: "left", shift: true, ctrl: true })).toBe("ctrl+shift+left");
  });

  test("shift is dropped from a BARE printable key, so a capital cannot fire a command", () => {
    expect(chordOf({ name: "a", shift: true })).toBe("a");
  });

  test("but shift survives once another modifier is held, or ctrl+shift+X is unreachable", () => {
    // The first version dropped shift from every printable key, which made every ctrl+shift+letter
    // row in KEYMAP impossible to produce: help printed it, and the chord could never occur.
    expect(chordOf({ name: "a", ctrl: true, shift: true })).toBe("ctrl+shift+a");
    expect(chordOf({ name: "d", ctrl: true, shift: true })).toBe("ctrl+shift+d");
  });

  test("shift IS part of the chord for a named key", () => {
    expect(chordOf({ name: "return", shift: true })).toBe("shift+return");
  });
});

describe("an unbound key is null, never a guess", () => {
  test("ordinary typing carries no intent, so it reaches the composer", () => {
    // The failure this prevents: inventing an intent for a plain character would swallow typing.
    for (const ch of ["a", "z", "1", " ", "."]) expect(intentOf({ name: ch })).toBeNull();
  });

  test("an unknown chord and an empty event are both null", () => {
    expect(intentOf({ name: "f13", ctrl: true })).toBeNull();
    expect(intentOf({})).toBeNull();
  });

  test("a chord that only differs by a modifier does not fall through to the plain key", () => {
    // ctrl+z is unbound; it must NOT resolve to whatever "z" would.
    expect(intentOf({ name: "z", ctrl: true })).toBeNull();
  });
});

describe("alt arrives under two names", () => {
  /**
   * The bug this pins cost a real feature and a wrong diagnosis. Alt+V was reported dead, and the
   * first explanation was that the terminal could not deliver alt at all. It could: opentui's raw
   * parser matches the ESC-prefix convention and reports it as `meta`, while `option` is set only
   * from a Kitty modifier bit. Reading one flag missed every alt chord on every terminal without the
   * Kitty protocol, which is most of them.
   */
  test("the raw ESC-prefix convention is alt, not meta", () => {
    expect(chordOf({ name: "v", meta: true, source: "raw" })).toBe("alt+v");
    // No source at all is the same case: a bare meta with no protocol behind it is an ESC prefix.
    expect(chordOf({ name: "v", meta: true })).toBe("alt+v");
  });

  test("the kitty modifier bit is alt too", () => {
    expect(chordOf({ name: "v", option: true, source: "kitty" })).toBe("alt+v");
  });

  test("a real meta modifier under kitty stays meta", () => {
    expect(chordOf({ name: "v", meta: true, source: "kitty" })).toBe("meta+v");
  });

  test("super is always meta, whichever parser saw it", () => {
    expect(chordOf({ name: "v", super: true, source: "raw" })).toBe("meta+v");
  });
});
