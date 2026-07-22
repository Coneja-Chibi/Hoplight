/**
 * Troupe grouping: characters own their linked lorebooks; solos don't double; drops leave the run.
 */
import { describe, expect, test } from "bun:test";
import type { StudioEntitySummary } from "../../app-contract";
import { groupTroupes, knowledgeRefsOf, pieceKeyOf, runSet } from "./press-troupes";

const p = (id: string, kind: string, name = id): StudioEntitySummary => ({ id, kind, name });

const studio = [
  p("adrian", "character", "Adrian"),
  p("cargo", "lorebook", "Sealed Cargo"),
  p("wren", "persona", "Wren"),
  p("loose", "lorebook", "Loose Book"),
];

describe("groupTroupes", () => {
  test("a staged character pulls his linked books as riders, even unstaged ones", () => {
    const g = groupTroupes([p("adrian", "character")], studio, { "character:adrian": ["cargo"] });
    expect(g.troupes).toHaveLength(1);
    expect(g.troupes[0]!.riders.map((r) => r.id)).toEqual(["cargo"]);
    expect(g.solos).toEqual([]);
  });

  test("a staged book already riding a troupe is not doubled as a solo", () => {
    const g = groupTroupes(
      [p("adrian", "character"), p("cargo", "lorebook"), p("wren", "persona")],
      studio,
      { "character:adrian": ["cargo"] },
    );
    expect(g.troupes[0]!.riders.map((r) => r.id)).toEqual(["cargo"]);
    expect(g.solos.map((s) => s.id)).toEqual(["wren"]);
  });

  test("a dangling ref (book deleted) is skipped, never invented", () => {
    const g = groupTroupes([p("adrian", "character")], studio, { "character:adrian": ["gone", "cargo"] });
    expect(g.troupes[0]!.riders.map((r) => r.id)).toEqual(["cargo"]);
  });
});

describe("runSet", () => {
  test("owners then riders then solos, with dropped riders left out", () => {
    const g = groupTroupes(
      [p("adrian", "character"), p("loose", "lorebook")],
      studio,
      { "character:adrian": ["cargo"] },
    );
    expect(runSet(g, new Set()).map((x) => x.id)).toEqual(["adrian", "cargo", "loose"]);
    expect(runSet(g, new Set([pieceKeyOf(p("cargo", "lorebook"))])).map((x) => x.id)).toEqual([
      "adrian",
      "loose",
    ]);
  });
});

describe("knowledgeRefsOf", () => {
  test("reads body.knowledgeRefs tolerantly", () => {
    expect(knowledgeRefsOf({ body: { knowledgeRefs: ["a", 2, "b"] } })).toEqual(["a", "b"]);
    expect(knowledgeRefsOf({ body: {} })).toEqual([]);
    expect(knowledgeRefsOf(null)).toEqual([]);
  });
});
