/**
 * What a key means inside the rewrite box.
 *
 * THE RISK IS NOT VISUAL. Below this in the gate handler, `y` allows and `n` denies. A letter that
 * escaped the box would answer the confirmation mid-word, so somebody typing "not quite" would
 * approve a write on the second character. That is why every key is claimed, recognised or not.
 */
import { describe, expect, test } from "bun:test";
import { editAction } from "./gate-edit-keys";

describe("editAction", () => {
  test("a printable character is appended", () => {
    expect(editAction({ name: "x", sequence: "x" }, "ab")).toEqual({ kind: "text", text: "abx" });
  });

  test("a space is a space, not the word", () => {
    // `name` normalises it to "space", which would put that word into somebody's prompt.
    expect(editAction({ name: "space", sequence: " " }, "ab")).toEqual({ kind: "text", text: "ab " });
  });

  test("backspace removes one character", () => {
    expect(editAction({ name: "backspace" }, "abc")).toEqual({ kind: "text", text: "ab" });
  });

  test("backspace on empty stays empty rather than going negative", () => {
    expect(editAction({ name: "backspace" }, "")).toEqual({ kind: "text", text: "" });
  });

  test("escape leaves the box", () => {
    expect(editAction({ name: "escape" }, "abc")).toEqual({ kind: "leave" });
  });

  test("enter accepts what is in it", () => {
    expect(editAction({ name: "return" }, "abc")).toEqual({ kind: "accept" });
  });

  test("THE LETTERS THAT ANSWER THE GATE ARE JUST LETTERS IN HERE", () => {
    /**
     * The whole reason this is a separate function. `y` and `n` are allow and deny one branch below;
     * in the box they have to be text, or typing "not quite" denies the write on its second key.
     */
    expect(editAction({ name: "y", sequence: "y" }, "")).toEqual({ kind: "text", text: "y" });
    expect(editAction({ name: "n", sequence: "n" }, "")).toEqual({ kind: "text", text: "n" });
    expect(editAction({ name: "d", sequence: "d" }, "")).toEqual({ kind: "text", text: "d" });
    expect(editAction({ name: "a", sequence: "a" }, "")).toEqual({ kind: "text", text: "a" });
  });

  test("an unrecognised key does nothing, and the caller still swallows it", () => {
    // Null, not a fall-through: "the box has the keyboard" has to mean all of it.
    expect(editAction({ name: "f5" }, "abc")).toBeNull();
    expect(editAction({ name: "up" }, "abc")).toBeNull();
  });

  test("a multi-character sequence is not text", () => {
    // An escape sequence for a key opentui did not name is not something to type.
    expect(editAction({ name: "?", sequence: "[A" }, "abc")).toBeNull();
  });
});
