/**
 * Bundle grouping: owners pull their linked pieces as riders; solos don't double; drops leave the
 * run; a single-file run skips the zip.
 *
 * PRESETS ARE OWNERS NOW, which is the repair this file pins: the preset schema promised that a
 * linked regex set rides on export ("reports a set that could not ride rather than dropping it")
 * while the Press never read behaviorRefs at all - so a preset's regex left the building alone and
 * the export read as "stripped". Quick-reply refs ride the same seam.
 */
import { describe, expect, test } from "bun:test";
import type { StudioEntitySummary } from "../../app-contract";
import {
  groupBundles,
  knowledgeRefsOf,
  packageRun,
  pieceKeyOf,
  riderRefsOf,
  runSet,
  type RiderRef,
} from "./press-bundles";

const p = (id: string, kind: string, name = id): StudioEntitySummary => ({ id, kind, name });
const lore = (id: string): RiderRef => ({ kind: "lorebook", id });

const studio = [
  p("adrian", "character", "Adrian"),
  p("cargo", "lorebook", "Sealed Cargo"),
  p("wren", "persona", "Wren"),
  p("loose", "lorebook", "Loose Book"),
  p("astral", "preset", "Astral"),
  p("dice", "regex", "Dice Painter"),
  p("buttons", "quickreply", "Astral Buttons"),
];

describe("groupBundles", () => {
  test("a staged character pulls his linked books as riders, even unstaged ones", () => {
    const g = groupBundles([p("adrian", "character")], studio, { "character:adrian": [lore("cargo")] });
    expect(g.bundles).toHaveLength(1);
    expect(g.bundles[0]!.riders.map((r) => r.id)).toEqual(["cargo"]);
    expect(g.solos).toEqual([]);
  });

  test("A STAGED PRESET PULLS ITS REGEX AND QUICK-REPLY SETS, the repair this file exists for", () => {
    const g = groupBundles([p("astral", "preset")], studio, {
      "preset:astral": [{ kind: "regex", id: "dice" }, { kind: "quickreply", id: "buttons" }],
    });
    expect(g.bundles).toHaveLength(1);
    expect(g.bundles[0]!.riders.map((r) => `${r.kind}:${r.id}`)).toEqual(["regex:dice", "quickreply:buttons"]);
    expect(g.solos).toEqual([]);
  });

  test("a staged piece already riding a bundle is not doubled as a solo", () => {
    const g = groupBundles(
      [p("astral", "preset"), p("dice", "regex"), p("wren", "persona")],
      studio,
      { "preset:astral": [{ kind: "regex", id: "dice" }] },
    );
    expect(g.bundles[0]!.riders.map((r) => r.id)).toEqual(["dice"]);
    expect(g.solos.map((s) => s.id)).toEqual(["wren"]);
  });

  test("rider refs resolve by KIND AND ID, so a regex and a lorebook sharing an id cannot cross", () => {
    const shared = [...studio, p("dice", "lorebook", "Dice Lore")];
    const g = groupBundles([p("astral", "preset")], shared, {
      "preset:astral": [{ kind: "regex", id: "dice" }],
    });
    expect(g.bundles[0]!.riders.map((r) => r.kind)).toEqual(["regex"]);
  });

  test("a dangling ref (piece deleted) is skipped, never invented", () => {
    const g = groupBundles([p("adrian", "character")], studio, {
      "character:adrian": [lore("gone"), lore("cargo")],
    });
    expect(g.bundles[0]!.riders.map((r) => r.id)).toEqual(["cargo"]);
  });
});

describe("riderRefsOf", () => {
  test("a character links lorebooks; a preset links regex and quick-reply sets", () => {
    expect(riderRefsOf({ kind: "character" }, { body: { knowledgeRefs: ["a", 2, "b"] } }))
      .toEqual([{ kind: "lorebook", id: "a" }, { kind: "lorebook", id: "b" }]);
    expect(riderRefsOf({ kind: "preset" }, { body: { behaviorRefs: ["r1"], quickReplyRefs: ["q1"] } }))
      .toEqual([{ kind: "regex", id: "r1" }, { kind: "quickreply", id: "q1" }]);
  });

  test("other kinds and unusable shapes link nothing rather than guessing", () => {
    expect(riderRefsOf({ kind: "persona" }, { body: { knowledgeRefs: ["a"] } })).toEqual([]);
    expect(riderRefsOf({ kind: "preset" }, null)).toEqual([]);
  });
});

describe("runSet", () => {
  test("owners then riders then solos, with dropped riders left out", () => {
    const g = groupBundles(
      [p("adrian", "character"), p("loose", "lorebook")],
      studio,
      { "character:adrian": [lore("cargo")] },
    );
    expect(runSet(g, new Set()).map((x) => x.id)).toEqual(["adrian", "cargo", "loose"]);
    expect(runSet(g, new Set([pieceKeyOf(p("cargo", "lorebook"))])).map((x) => x.id)).toEqual([
      "adrian",
      "loose",
    ]);
  });
});

describe("packageRun", () => {
  test("ONE PIECE IN, ONE FILE OUT: a single file downloads bare under its own name", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(packageRun({ "astral.json": bytes }))
      .toEqual({ kind: "single", filename: "astral.json", bytes });
  });

  test("two or more files are a zip; zero is nothing", () => {
    const a = new Uint8Array([1]);
    const b = new Uint8Array([2]);
    const packed = packageRun({ "x.json": a, "y.json": b });
    expect(packed?.kind).toBe("zip");
    expect(packageRun({})).toBeNull();
  });
});

describe("knowledgeRefsOf", () => {
  test("reads body.knowledgeRefs tolerantly", () => {
    expect(knowledgeRefsOf({ body: { knowledgeRefs: ["a", 2, "b"] } })).toEqual(["a", "b"]);
    expect(knowledgeRefsOf({ body: {} })).toEqual([]);
    expect(knowledgeRefsOf(null)).toEqual([]);
  });
});
