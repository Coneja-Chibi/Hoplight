/**
 * The shell's own key routing, tested where it can be tested without a terminal.
 *
 * The split that got app.tsx under its line cap moved this decision out of the render body, and the
 * bug it shipped on the way was a stale read rather than a wrong mapping. So the mapping is proven
 * here and the freshness is proven by the type: the hook takes a ref, not a value. The property that
 * matters most is the `active` guard, because a binding that fires underneath an open card is the
 * failure a per-case condition would eventually reintroduce.
 */
import { describe, expect, test } from "bun:test";
import type { KeyEvent } from "@opentui/core";
import { consumesKey, shellKeyAction, type ShellKeyAction } from "./shell-keys-core";

const key = (name: string, mods: { ctrl?: boolean; shift?: boolean } = {}): KeyEvent =>
  ({ name, ctrl: mods.ctrl ?? false, shift: mods.shift ?? false }) as unknown as KeyEvent;

describe("shellKeyAction", () => {
  test("routes each shell binding", () => {
    const cases: [KeyEvent, ShellKeyAction][] = [
      [key("escape"), "interrupt"],
      [key("o", { ctrl: true }), "fold"],
      [key("f", { ctrl: true }), "search"],
      [key("end"), "scroll-bottom"],
      [key("home"), "scroll-top"],
      [key("pageup"), "page-up"],
      [key("pagedown"), "page-down"],
    ];
    for (const [event, expected] of cases) expect(shellKeyAction(event, true)).toBe(expected);
  });

  test("stands down entirely when something else owns the keyboard", () => {
    // The guard is one place on purpose: a binding that forgot it would fire underneath an open
    // search card or gate, where the same key means something else.
    for (const name of ["escape", "end", "home", "pageup", "pagedown"]) {
      expect(shellKeyAction(key(name), false)).toBeNull();
    }
    expect(shellKeyAction(key("o", { ctrl: true }), false)).toBeNull();
    expect(shellKeyAction(key("f", { ctrl: true }), false)).toBeNull();
  });

  test("claims nothing it does not own", () => {
    expect(shellKeyAction(key("a"), true)).toBeNull();
    expect(shellKeyAction(key("enter"), true)).toBeNull();
    // Bare o and f are typed text; only the ctrl chords are the shell's.
    expect(shellKeyAction(key("o"), true)).toBeNull();
    expect(shellKeyAction(key("f"), true)).toBeNull();
  });

  test("fold is the one action that lets the key through", () => {
    expect(consumesKey("fold")).toBe(false);
    for (const action of ["interrupt", "search", "scroll-bottom", "page-up"] as ShellKeyAction[]) {
      expect(consumesKey(action)).toBe(true);
    }
  });
});
