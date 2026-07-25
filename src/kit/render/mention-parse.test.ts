/** Proves stored piece markers resolve deterministically and unknown markers remain plain text. */
import { expect, test } from "bun:test";
import { parsePieceMentions } from "./mention-parse";

const pieces = [
  { id: "basil-1", kind: "character", name: "Basil", hasPortrait: true },
  { id: "half-moon", kind: "lorebook", name: "Half-Moon" },
];

test("splits resolved piece markers from surrounding prose", () => {
  expect(parsePieceMentions("Ask @character:basil-1 about @lorebook:half-moon.", pieces)).toEqual([
    { type: "text", text: "Ask " },
    { type: "piece", marker: "@character:basil-1", piece: pieces[0]! },
    { type: "text", text: " about " },
    { type: "piece", marker: "@lorebook:half-moon", piece: pieces[1]! },
    { type: "text", text: "." },
  ]);
});

test("leaves missing pieces readable as their original marker", () => {
  expect(parsePieceMentions("Ask @character:missing.", pieces)).toEqual([
    { type: "text", text: "Ask @character:missing." },
  ]);
});
