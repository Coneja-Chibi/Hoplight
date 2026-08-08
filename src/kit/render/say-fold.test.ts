/**
 * Which replies show their text.
 *
 * The rule that was missing: a long answer streamed in full, settled, and collapsed itself to one
 * line in the same instant. The longer and more useful the answer, the less of it you were allowed
 * to read, and the only way back was clicking it open every single time.
 */
import { describe, expect, test } from "bun:test";
import { isLongSay, LONG_SAY_CHARS, saysOpen } from "./say-fold";

const say = (open?: boolean) => ({ role: "say", ...(open === undefined ? {} : { open }) });
const you = () => ({ role: "you" });

describe("isLongSay", () => {
  test("the threshold is exclusive", () => {
    expect(isLongSay("x".repeat(LONG_SAY_CHARS))).toBe(false);
    expect(isLongSay("x".repeat(LONG_SAY_CHARS + 1))).toBe(true);
  });
});

describe("saysOpen", () => {
  test("the newest reply is open", () => {
    // The reply you are reading is not scrollback.
    const lines = [say(), you(), say()];
    expect(saysOpen(lines, 2, lines[2]!)).toBe(true);
  });

  test("older replies stay folded", () => {
    // Which is the whole point of folding: scrollback should not be a wall.
    const lines = [say(), you(), say()];
    expect(saysOpen(lines, 0, lines[0]!)).toBe(false);
  });

  test("a lone reply is open", () => {
    const lines = [you(), say()];
    expect(saysOpen(lines, 1, lines[1]!)).toBe(true);
  });

  test("anything said after it does not count unless it is a reply", () => {
    // A tool row or an image landing below the answer must not fold the answer.
    const lines = [say(), { role: "tool" }, { role: "image" }];
    expect(saysOpen(lines, 0, lines[0]!)).toBe(true);
  });

  test("a deliberate collapse of the newest reply sticks", () => {
    // Once somebody has clicked, that is an instruction; springing back open would fight them.
    const lines = [you(), say(false)];
    expect(saysOpen(lines, 1, lines[1]!)).toBe(false);
  });

  test("a deliberately opened old reply stays open", () => {
    const lines = [say(true), you(), say()];
    expect(saysOpen(lines, 0, lines[0]!)).toBe(true);
  });

  test("it depends only on position, so a resumed transcript folds the same way", () => {
    // Not a timestamp and not "was this streamed": replaying the same lines must look identical.
    const lines = [say(), you(), say(), you(), say()];
    expect(lines.map((line, at) => saysOpen(lines, at, line))).toEqual([false, false, false, false, true]);
  });
});
