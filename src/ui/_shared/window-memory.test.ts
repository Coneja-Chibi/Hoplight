/**
 * What "Reset this window" forgets, and - the part worth pinning - what it must not.
 *
 * The button's whole promise is in its wording: your tabs, your settings and your studio survive.
 * A key added to this list by somebody who did not read that sentence would break the promise
 * silently, on a button people press when they are already frustrated.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import {
  ACTIVE_APP_KEY,
  AGENT_SESSION_KEY,
  clearWindowMemory,
  PANEL_KEY,
  QUEUE_KEY,
  RESET_KEYS,
  TRANSCRIPT_KEY,
} from "./window-memory";

describe("what a reset forgets", () => {
  test("exactly these, all of them this window's own memory", () => {
    expect(RESET_KEYS.map((k) => k.key).sort())
      .toEqual([ACTIVE_APP_KEY, AGENT_SESSION_KEY, PANEL_KEY, QUEUE_KEY, TRANSCRIPT_KEY].sort());
  });

  test("THE SESSION ID GOES WITH THE TRANSCRIPT, never on its own", () => {
    /**
     * They are one thing. A fresh conversation on screen still writing into the session behind the
     * old one would braid two conversations into a single file, and the split would only show up
     * later, in a resume that reads like two people talking past each other.
     */
    const keys = RESET_KEYS.map((k) => k.key);
    expect(keys.includes(AGENT_SESSION_KEY)).toBe(keys.includes(TRANSCRIPT_KEY));
  });

  test("RESETTING FORGETS THE SESSION, IT DOES NOT DELETE IT", () => {
    // Only the pointer is cleared. The file stays on disk and stays resumable, because "start fresh
    // here" and "throw away what I said" are different requests and only one of them was made.
    expect(RESET_KEYS.every((k) => k.where === "session" || k.where === "local")).toBe(true);
  });

  test("THE WORKBENCH TABS ARE NOT IN THE LIST", () => {
    /**
     * They live in settings.json and are meant to survive a kill, a restart, anything - that was
     * the whole point of building them. A reset that took them would be the opposite of the
     * feature, reached from a button labelled as harmless.
     */
    const keys = RESET_KEYS.map((k) => k.key);
    expect(keys.some((k) => k.includes("workspace"))).toBe(false);
    expect(keys.some((k) => k.includes("workbench"))).toBe(false);
  });

  test("THE THEME IS NOT IN THE LIST", () => {
    // Its cached copy exists only to stop a white flash before settings load; clearing it would
    // make every reset flash paper at somebody working in the dark theme.
    expect(RESET_KEYS.some((k) => k.key.includes("theme"))).toBe(false);
  });

  test("each key names the storage it actually lives in", () => {
    const where = new Map(RESET_KEYS.map((k) => [k.key, k.where]));
    // Per-tab things are session; the overlay's position is a preference and outlives the tab.
    expect(where.get(ACTIVE_APP_KEY)).toBe("session");
    expect(where.get(TRANSCRIPT_KEY)).toBe("session");
    expect(where.get(PANEL_KEY)).toBe("local");
  });
});

/** The two browser stores, in memory. Only the three methods this file touches do anything. */
function fakeStorage(): Storage {
  const held = new Map<string, string>();
  return {
    getItem: (k: string) => held.get(k) ?? null,
    setItem: (k: string, v: string) => { held.set(k, v); },
    removeItem: (k: string) => { held.delete(k); },
    clear: () => { held.clear(); },
    key: () => null,
    get length() { return held.size; },
  } as Storage;
}

describe("clearWindowMemory", () => {
  beforeEach(() => {
    globalThis.sessionStorage = fakeStorage();
    globalThis.localStorage = fakeStorage();
  });

  test("it removes every listed key from the right storage", () => {
    sessionStorage.setItem(ACTIVE_APP_KEY, "library");
    sessionStorage.setItem(TRANSCRIPT_KEY, "[]");
    localStorage.setItem(PANEL_KEY, "{}");
    localStorage.setItem("vaude.theme", "stage");

    clearWindowMemory();

    expect(sessionStorage.getItem(ACTIVE_APP_KEY)).toBeNull();
    expect(sessionStorage.getItem(TRANSCRIPT_KEY)).toBeNull();
    expect(localStorage.getItem(PANEL_KEY)).toBeNull();
    // Proven rather than assumed: the untouched key is still there afterwards.
    expect(localStorage.getItem("vaude.theme")).toBe("stage");
  });

  test("IT NEVER THROWS, even with nothing stored", () => {
    // It runs on a button press that is somebody's way out of a stuck window; throwing there leaves
    // them worse off than before they pressed it.
    expect(() => { clearWindowMemory(); clearWindowMemory(); }).not.toThrow();
  });
});
