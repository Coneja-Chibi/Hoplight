/**
 * What Settings tells the agent, and what it structurally cannot.
 *
 * This is the screen that holds a connect code, a mesh address and a certificate fingerprint, and
 * the text built here lands in the SYSTEM position of a request that leaves the machine. The
 * assertions below are mostly about the reader: if a secret is never an argument, no later edit to
 * the room can hand one over, and that is a stronger claim than any "does not contain" check on the
 * handful of values a test happened to imagine.
 */
import { describe, expect, test } from "bun:test";
import { readSettingsSurface, settingsAgentState } from "./agent-surface";

const tabs = [
  { id: "appearance", label: "Appearance" },
  { id: "remote-access", label: "Remote access" },
  { id: "about", label: "About" },
];

const base = {
  tabs,
  activeId: "appearance",
  theme: "stage",
  houseAccentSet: false,
  homeApp: "library",
  firstDeck: "character",
  publishTargets: ["SillyTavern"],
  remoteAccessOn: false,
};

describe("readSettingsSurface", () => {
  test("IT READS A FIXED KEY LIST, so an unknown setting cannot ride along", () => {
    /**
     * settings.json is an open record: drop-in setup steps write their own keys into it without
     * touching the shape file. A generic "read every setting" would therefore carry whatever the
     * next step invents - which is where a token would live if one ever arrived. This is the test
     * that pins the reader to its six named keys.
     */
    const store: Record<string, unknown> = {
      theme: "paper",
      "some.future.step.apiToken": "sk-live-do-not-ship-this",
      remoteAccessEnabled: true,
    };
    const read = readSettingsSurface((k) => store[k], tabs, "about");

    expect(read.theme).toBe("paper");
    expect(read.remoteAccessOn).toBe(true);
    expect(JSON.stringify(read)).not.toContain("sk-live-do-not-ship-this");
  });

  test("the accent survives as a yes/no, never as its value", () => {
    // The question worth answering is "has this studio been styled", and the answer is a boolean.
    // Carrying the hex would put a colour literal into a file that names none.
    const read = readSettingsSurface((k) => (k === "houseAccent" ? "#3b82f6" : undefined), tabs, "appearance");

    expect(read.houseAccentSet).toBe(true);
    expect(JSON.stringify(read)).not.toContain("3b82f6");
  });

  test("a malformed setting reads as absent rather than as itself", () => {
    // parseSettings is fail-closed per key and this reader must not be looser than the parser that
    // wrote the file, or a number in the theme slot becomes a sentence claiming the theme is 7.
    const read = readSettingsSurface(
      (k) => (k === "theme" ? 7 : k === "publishTargets" ? "SillyTavern" : undefined),
      tabs,
      "appearance",
    );

    expect(read.theme).toBe("");
    expect(read.publishTargets).toEqual([]);
  });
});

describe("settingsAgentState", () => {
  test("the visible tab is the focused item, so 'where do I change that' has an answer", () => {
    // Settings is six rooms behind one tile; naming only the app would make every answer a guess
    // about which tab somebody is standing on.
    const state = settingsAgentState({ ...base, activeId: "remote-access" });

    expect(state.headline).toBe("Settings, on the Remote access tab.");
    expect(state.items?.find((i) => i.id === "remote-access")?.focused).toBe(true);
    expect(state.items?.find((i) => i.id === "about")?.focused).toBeUndefined();
  });

  test("REMOTE ACCESS IS REPORTED AS ON, never as how to reach it", () => {
    /**
     * Whether this studio is reachable from another device is worth an agent knowing. The connect
     * code, the mesh address and the certificate fingerprint sitting on the same tab are what make
     * it reachable, and they are the reason this file takes a boolean instead of the tab's state.
     */
    const state = settingsAgentState({ ...base, remoteAccessOn: true });
    const note = state.notes?.find((n) => n.includes("Remote access is on")) ?? "";

    expect(note).toContain("deliberately not described");
  });

  test("the surface says no key is described here, rather than staying quiet about it", () => {
    // There is no provider control in this room and the vault is server-side, so a model asked
    // "which model am I on" would otherwise start guessing from whatever else is in the brief.
    const state = settingsAgentState(base);
    const note = state.notes?.join(" ") ?? "";

    expect(note).toContain("No provider key, token or vault content");
    expect(note).toContain("Whether a model is connected is not configured here");
  });

  test("an unset value is said to be unset, not reported as a default that was chosen", () => {
    // "The theme is paper" and "nobody has picked a theme" lead to different suggestions, and the
    // studio renders identically either way.
    const state = settingsAgentState({ ...base, theme: "", homeApp: "", publishTargets: [] });
    const notes = state.notes?.join(" ") ?? "";

    expect(notes).toContain("has never been set");
    expect(notes).toContain("No publish targets were picked");
    expect(notes).not.toContain("The studio opens on .");
  });
});
