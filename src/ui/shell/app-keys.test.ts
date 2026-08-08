/**
 * App-switching key map tests. The two that earn their keep: a chord must never fire into a text
 * surface (29dad0d, the rail eating the composer - the same defect one room over), and the numbers
 * must be counted off the manifest rather than written down, so adding an app folder cannot leave
 * the dock and the keyboard disagreeing about what ctrl+2 is.
 */
import { describe, expect, test } from "bun:test";
import type { AppManifestEntry } from "../app-contract";
import {
  APP_KEYS,
  appRoster,
  appShortcut,
  chordFor,
  isMacLike,
  isTypingTarget,
  stepApp,
  type AppKeyEvent,
  type AppRoster,
} from "./app-keys";

const manifest = (patch: Partial<AppManifestEntry>): AppManifestEntry => ({
  id: "app",
  title: "App",
  markSvg: "<svg/>",
  accent: "var(--accent)",
  order: 10,
  ...patch,
});

/** The roster as the shipped dock builds it, deliberately handed in out of order. */
const ROSTER: AppRoster = appRoster([
  manifest({ id: "settings", order: 100, dockFoot: true }),
  manifest({ id: "press", order: 30 }),
  manifest({ id: "workbench", order: 10 }),
  manifest({ id: "docs", order: 70, catalogOnly: true }),
  manifest({ id: "agent", order: 40 }),
  manifest({ id: "company", order: 90, comingSoon: true, catalogOnly: true }),
  manifest({ id: "library", order: 20 }),
]);

/** Targets spelled the way the DOM spells them - uppercase tagName, see the casing test below. */
const textarea = { tagName: "TEXTAREA", isContentEditable: false };
const input = { tagName: "INPUT", isContentEditable: false };
const button = { tagName: "BUTTON", isContentEditable: false };

/** No modifiers, no target: the caller fills in only what the case is about. */
const press = (patch: Partial<AppKeyEvent>): AppKeyEvent => ({
  key: "",
  code: "",
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  target: null,
  ...patch,
});

describe("the roster the numbers count", () => {
  test("is dock order, from the manifests, without the tiles that cannot be mounted", () => {
    // Sorted inside appRoster on purpose: the input above is scrambled, and a pure function that
    // needed the caller to sort first would disagree with the runtime the moment anyone else used it.
    expect(ROSTER.numbered).toEqual(["workbench", "library", "press", "agent"]);
    // Coming-soon and catalog-only tiles are drawn or packaged but never mounted from a number:
    // a chord pointing at one would be a key that does nothing.
    expect(ROSTER.numbered).not.toContain("company");
    expect(ROSTER.numbered).not.toContain("docs");
    // The foot is its own short row, which is why Settings needs a chord of its own.
    expect(ROSTER.foot).toEqual(["settings"]);
  });

  test("workbench falls on ctrl+1 because it is first, not because anything says so", () => {
    expect(appShortcut(press({ code: "Digit1", ctrlKey: true }), ROSTER)).toEqual({
      kind: "app",
      id: "workbench",
    });
    // Drop a new app in ahead of it and the same chord follows the dock, unedited.
    const withNewApp = appRoster([manifest({ id: "stage", order: 5 }), manifest({ id: "workbench", order: 10 })]);
    expect(appShortcut(press({ code: "Digit1", ctrlKey: true }), withNewApp)).toEqual({
      kind: "app",
      id: "stage",
    });
  });

  test("a number past the end of a short dock is nothing, not the last app", () => {
    // The caller preventDefaults on a match. Returning null here is what leaves ctrl+9 alone on a
    // four-tile dock instead of swallowing it to no effect.
    expect(appShortcut(press({ code: "Digit9", ctrlKey: true }), ROSTER)).toBeNull();
  });
});

describe("the typing guard", () => {
  test("a chord pressed inside a textarea is not a chord", () => {
    // THE bug this file exists to prevent. Kit shipped it once (29dad0d): a global handler that
    // guarded only on its own surface being open, preventing keys the focused editor needed, and
    // typing a prompt lost every space. This shell is nothing but large text editors.
    expect(appShortcut(press({ code: "Digit2", ctrlKey: true, target: textarea }), ROSTER)).toBeNull();
    expect(appShortcut(press({ code: "Digit2", ctrlKey: true, target: input }), ROSTER)).toBeNull();
    expect(appShortcut(press({ key: ",", ctrlKey: true, target: textarea }), ROSTER)).toBeNull();
    expect(
      appShortcut(press({ key: "ArrowRight", ctrlKey: true, altKey: true, target: textarea }), ROSTER),
    ).toBeNull();
  });

  test("the same chord one element over still works", () => {
    // The guard has to be a guard, not an off switch: refusing everywhere would be a green test
    // suite over a feature that never fires.
    expect(appShortcut(press({ code: "Digit2", ctrlKey: true, target: button }), ROSTER)).toEqual({
      kind: "app",
      id: "library",
    });
  });

  test("reads tagName the way the DOM actually writes it", () => {
    // The DOM reports "TEXTAREA", uppercase. A guard comparing raw against "textarea" passes every
    // test written from hand-made lowercase fixtures and never fires once in the running app, so
    // these fixtures are spelled the way a real event spells them.
    expect(isTypingTarget({ tagName: "TEXTAREA", isContentEditable: false })).toBe(true);
    expect(isTypingTarget({ tagName: "INPUT", isContentEditable: false })).toBe(true);
    expect(isTypingTarget({ tagName: "BUTTON", isContentEditable: false })).toBe(false);
  });

  test("anything inside a contenteditable counts, which is how the code editors are covered", () => {
    // The DOM sets isContentEditable on descendants too, so the code editors are guarded without
    // this file having to know they exist.
    expect(isTypingTarget({ tagName: "SPAN", isContentEditable: true })).toBe(true);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("modifiers", () => {
  test("a bare number is left alone", () => {
    // Typing "1" into a surface that is not an input (a list with its own hotkeys, a canvas) must
    // not move the user out of the room.
    expect(appShortcut(press({ code: "Digit1", key: "1" }), ROSTER)).toBeNull();
  });

  test("cmd is the accelerator too, and holding both is neither", () => {
    expect(appShortcut(press({ code: "Digit3", metaKey: true }), ROSTER)).toEqual({
      kind: "app",
      id: "press",
    });
    // ctrl+cmd+1 is a third chord that belongs to nobody; claiming it would swallow a key the map
    // never advertised.
    expect(appShortcut(press({ code: "Digit3", ctrlKey: true, metaKey: true }), ROSTER)).toBeNull();
  });

  test("modifiers the row did not ask for are refused", () => {
    // The rail's rule, and the reason ctrl+shift+1 and ctrl+alt+1 stay free for a later feature
    // instead of quietly aliasing this one.
    expect(appShortcut(press({ code: "Digit1", ctrlKey: true, shiftKey: true }), ROSTER)).toBeNull();
    expect(appShortcut(press({ code: "Digit1", ctrlKey: true, altKey: true }), ROSTER)).toBeNull();
  });

  test("settings answers to ctrl+comma, matched on the character", () => {
    // Punctuation is matched on the typed character because the character IS what the user aims at;
    // the number row is matched on the physical key, since "the first tile" should be the same
    // finger on a layout where the digits are shifted.
    expect(appShortcut(press({ key: ",", ctrlKey: true }), ROSTER)).toEqual({
      kind: "app",
      id: "settings",
    });
  });
});

describe("stepping along the dock", () => {
  test("ctrl+alt+arrows name a direction, never an app", () => {
    // The table cannot know which room is on screen, and an app id resolved here would be one
    // computed from state this module is not allowed to read.
    expect(appShortcut(press({ key: "ArrowRight", ctrlKey: true, altKey: true }), ROSTER)).toEqual({
      kind: "next",
    });
    expect(appShortcut(press({ key: "ArrowLeft", ctrlKey: true, altKey: true }), ROSTER)).toEqual({
      kind: "prev",
    });
    // Without alt the arrows belong to whatever is focused - a list, a tab strip, a text run.
    expect(appShortcut(press({ key: "ArrowRight", ctrlKey: true }), ROSTER)).toBeNull();
  });

  test("wraps at both ends", () => {
    expect(stepApp(ROSTER.numbered, "workbench", 1)).toBe("library");
    expect(stepApp(ROSTER.numbered, "agent", 1)).toBe("workbench");
    expect(stepApp(ROSTER.numbered, "workbench", -1)).toBe("agent");
  });

  test("an app with no tile starts the walk at the top instead of guessing", () => {
    // Docs and the Apps catalog are mountable with no dock tile, so "the one after this" has no
    // answer for them; landing on the first tile is somewhere the user can see themselves arrive.
    expect(stepApp(ROSTER.numbered, "docs", 1)).toBe("workbench");
    expect(stepApp(ROSTER.numbered, "", 1)).toBe("workbench");
    expect(stepApp([], "workbench", 1)).toBeNull();
  });
});

describe("the hints on the tiles", () => {
  test("come from the same rows that fire, so they cannot drift", () => {
    expect(chordFor("workbench", ROSTER, false)).toBe("ctrl+1");
    expect(chordFor("agent", ROSTER, false)).toBe("ctrl+4");
    expect(chordFor("settings", ROSTER, false)).toBe("ctrl+,");
    expect(chordFor("workbench", ROSTER, true)).toBe("cmd+1");
  });

  test("an app with no chord says so rather than inventing one", () => {
    expect(chordFor("docs", ROSTER, false)).toBeNull();
    expect(chordFor("company", ROSTER, false)).toBeNull();
  });

  test("mac is read off the agent string, not off a global", () => {
    expect(isMacLike("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(true);
    expect(isMacLike("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(false);
  });
});

describe("the table itself", () => {
  test("no chord means two things", () => {
    // The rule the whole file exists to hold, checked by reading the table rather than by anybody
    // remembering to. The rail's key map failed this for months as an if-chain.
    const seen = new Set<string>();
    for (const binding of APP_KEYS) {
      const chord = [
        binding.accel === true ? "accel" : "",
        binding.shift === true ? "shift" : "",
        binding.alt === true ? "alt" : "",
        binding.code ?? binding.key?.toLowerCase() ?? "",
      ].join("+");
      expect(seen.has(chord)).toBe(false);
      seen.add(chord);
    }
  });

  test("every row is reachable: it declares a key or a code, and something to say", () => {
    for (const binding of APP_KEYS) {
      expect(binding.key !== undefined || binding.code !== undefined).toBe(true);
      expect(binding.label.length).toBeGreaterThan(0);
      expect(binding.says.length).toBeGreaterThan(0);
    }
  });
});
