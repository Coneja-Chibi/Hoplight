/**
 * Grapheme helpers preserve complete visible characters across caps, tails, and backspace.
 */
import { expect, test } from "bun:test";
import { dropLastGrapheme, tailGraphemes, truncateGraphemes } from "./graphemes";

test("caps and tails never split astral, combining, flag, or ZWJ clusters", () => {
  const clusters = [
    "\u{1F600}",
    "e\u0301",
    "\u{1F1FA}\u{1F1F8}",
    "\u{1F469}\u200D\u{1F4BB}",
  ];
  const text = clusters.join("");
  expect(truncateGraphemes(text, 3)).toBe(`${clusters.slice(0, 3).join("")}…`);
  expect(tailGraphemes(text, 2)).toBe(clusters.slice(-2).join(""));
});

test("backspace drops one complete grapheme", () => {
  expect(dropLastGrapheme("name \u{1F469}\u200D\u{1F4BB}")).toBe("name ");
});
