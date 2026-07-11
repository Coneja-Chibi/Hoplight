/**
 * Book differ: rename catch, swap pairing, empty diff, revert round-trip, word ranges.
 */
import { describe, expect, test } from "bun:test";
import type { LorebookBody, LorebookEntry } from "../../entities/lorebook/schema";
import { diffBooks, restoreEntry, revertField, wordDiffRanges } from "./diff";
import { emptyLoreEntry, emptyLorebookBody } from "./empty-book";

const entry = (id: string, patch: Partial<LorebookEntry> = {}): LorebookEntry => ({
  ...emptyLoreEntry(id),
  title: id,
  content: `content for ${id} that is long enough`,
  ...patch,
  id,
});

const bookOf = (entries: LorebookEntry[]): LorebookBody => ({
  ...emptyLorebookBody("diff"),
  entries,
});

describe("wordDiffRanges", () => {
  test("marks changed tokens", () => {
    const r = wordDiffRanges("the quick brown fox", "the slow brown dog");
    expect(r.fromRanges.length).toBeGreaterThan(0);
    expect(r.toRanges.length).toBeGreaterThan(0);
  });

  test("identical text has no ranges", () => {
    const r = wordDiffRanges("same words here", "same words here");
    expect(r.fromRanges).toEqual([]);
    expect(r.toRanges).toEqual([]);
  });
});

describe("diffBooks", () => {
  test("no-change = empty diff", () => {
    const b = bookOf([entry("a"), entry("b")]);
    const d = diffBooks(b, structuredClone(b));
    expect(d.edited).toEqual([]);
    expect(d.reordered).toEqual([]);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
  });

  test("scalar field edit", () => {
    const base = bookOf([entry("a", { probability: 100 })]);
    const cur = bookOf([entry("a", { probability: 50 })]);
    const d = diffBooks(base, cur);
    expect(d.edited).toHaveLength(1);
    expect(d.edited[0]?.changes.some((c) => c.field === "probability")).toBe(true);
  });

  test("content edit carries word ranges", () => {
    const base = bookOf([
      entry("a", { content: "the quick brown fox jumps" }),
    ]);
    const cur = bookOf([
      entry("a", { content: "the slow brown fox rests" }),
    ]);
    const d = diffBooks(base, cur);
    const ch = d.edited[0]?.changes.find((c) => c.field === "content");
    expect(ch?.words?.fromRanges.length).toBeGreaterThan(0);
    expect(ch?.words?.toRanges.length).toBeGreaterThan(0);
  });

  test("rename catch: same content > 20 chars, new title/id", () => {
    const body =
      "This is a long enough body of text for the rename catch pass to match.";
    const base = bookOf([entry("old", { title: "Old Name", content: body })]);
    const cur = bookOf([entry("new", { title: "New Name", content: body })]);
    const d = diffBooks(base, cur);
    expect(d.edited).toHaveLength(1);
    expect(d.edited[0]?.matchedBy).toBe("content");
    expect(d.edited[0]?.wasTitle).toBe("Old Name");
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
  });

  test("swap pairing: pure sortOrder cross is reordered not edited", () => {
    const base = bookOf([
      entry("a", { sortOrder: 0 }),
      entry("b", { sortOrder: 10 }),
    ]);
    const cur = bookOf([
      entry("a", { sortOrder: 10 }),
      entry("b", { sortOrder: 0 }),
    ]);
    const d = diffBooks(base, cur);
    expect(d.reordered).toHaveLength(1);
    const pair = d.reordered[0]!;
    expect([pair.aId, pair.bId].sort()).toEqual(["a", "b"]);
    expect(d.edited.filter((e) => e.changes.every((c) => c.field === "sortOrder"))).toEqual([]);
  });

  test("added and removed", () => {
    const base = bookOf([entry("a"), entry("gone")]);
    const cur = bookOf([entry("a"), entry("fresh")]);
    const d = diffBooks(base, cur);
    expect(d.added).toEqual(["fresh"]);
    expect(d.removed.map((e) => e.id)).toEqual(["gone"]);
  });

  test("revert field round-trip restores base scalar", () => {
    const base = bookOf([entry("a", { probability: 100, title: "A" })]);
    let cur = bookOf([entry("a", { probability: 25, title: "A" })]);
    const d = diffBooks(base, cur);
    const ch = d.edited[0]!.changes.find((c) => c.field === "probability")!;
    cur = revertField(cur, "a", "probability", ch.from);
    expect(cur.entries[0]?.probability).toBe(100);
    expect(diffBooks(base, cur).edited).toEqual([]);
  });

  test("revert content field round-trip", () => {
    const base = bookOf([entry("a", { content: "original long enough content here" })]);
    let cur = bookOf([entry("a", { content: "changed long enough content here" })]);
    const d = diffBooks(base, cur);
    const ch = d.edited[0]!.changes.find((c) => c.field === "content")!;
    cur = revertField(cur, "a", "content", ch.from);
    expect(cur.entries[0]?.content).toBe("original long enough content here");
  });

  test("restoreEntry appends removed entry", () => {
    const base = bookOf([entry("a"), entry("gone", { title: "Gone" })]);
    const cur = bookOf([entry("a")]);
    const d = diffBooks(base, cur);
    const next = restoreEntry(cur, d.removed[0]!, "gone-fresh");
    expect(next.entries.map((e) => e.id).sort()).toEqual(["a", "gone"]);
  });

  test("restoreEntry uses fresh id on collision", () => {
    const removed = entry("a", { title: "Old A", content: "zzz long enough content body" });
    const cur = bookOf([entry("a", { title: "New A" })]);
    const next = restoreEntry(cur, removed, "a-restored");
    expect(next.entries.map((e) => e.id).sort()).toEqual(["a", "a-restored"]);
  });
});
