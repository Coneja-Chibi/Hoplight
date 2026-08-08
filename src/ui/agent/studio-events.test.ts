/**
 * Which filesystem noise counts as a studio change.
 *
 * The filter is the whole design. Atomic saves leave .tmp orphans, editors leave swap files, and an
 * event for each of those would have every open window re-reading the folder several times per save.
 */
import { describe, expect, test } from "bun:test";
import { kindOfPath } from "./studio-events";

describe("kindOfPath", () => {
  test("a piece in a kind folder reports its deck", () => {
    expect(kindOfPath("preset/hawthorne.json")).toBe("preset");
    expect(kindOfPath("character/ludovic-and-levi.json")).toBe("character");
  });

  test("WINDOWS BACKSLASHES ARE THE SAME PATH", () => {
    // node's watcher hands back the platform's own separator; the wire uses one spelling.
    expect(kindOfPath("preset\\hawthorne.json")).toBe("preset");
  });

  test("A DOTFILE IS AN ARTIFACT, NOT SOMEBODY'S WORK", () => {
    /**
     * Atomic replacement writes `.hawthorne.json.tmp` and renames it. Announcing that would fire a
     * reload for the intermediate state of every single save, on top of the real one.
     */
    expect(kindOfPath("preset/.hawthorne.json.tmp")).toBeNull();
    expect(kindOfPath("preset/.DS_Store")).toBeNull();
  });

  test("anything that is not json is ignored", () => {
    expect(kindOfPath("preset/notes.txt")).toBeNull();
    expect(kindOfPath("character/portrait.png")).toBeNull();
  });

  test("a loose file at the top of the studio belongs to no deck", () => {
    expect(kindOfPath("settings.json")).toBeNull();
    expect(kindOfPath("")).toBeNull();
  });

  test("a deeper path still reports its deck", () => {
    // Recursive watching reports nested paths; the deck is still the first segment.
    expect(kindOfPath("preset/sub/thing.json")).toBe("preset");
  });
});
