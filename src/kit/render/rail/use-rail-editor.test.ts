/**
 * The editor's contract, which is small and worth pinning because three surfaces share it.
 *
 * The property that matters is that cancelling really discards: an editor that kept its draft would
 * reopen holding somebody's abandoned typing and stage it later as though they had meant it.
 */
import { describe, expect, test } from "bun:test";
import { editorLabel, type EditTarget } from "./use-rail-editor";

describe("editorLabel", () => {
  test("every target says what it is doing", () => {
    const targets: EditTarget[] = [
      { kind: "preset-name" },
      { kind: "block-name", id: "a" },
      { kind: "block-content", id: "a" },
      { kind: "note" },
    ];
    for (const target of targets) {
      const label = editorLabel(target);
      // A sentence rather than a kind name: this is read by somebody mid-edit, not by a switch.
      expect(label.split(" ").length).toBeGreaterThan(2);
    }
  });

  test("the four labels are distinct", () => {
    const labels = new Set([
      editorLabel({ kind: "preset-name" }),
      editorLabel({ kind: "block-name", id: "a" }),
      editorLabel({ kind: "block-content", id: "a" }),
      editorLabel({ kind: "note" }),
    ]);
    expect(labels.size).toBe(4);
  });
});
