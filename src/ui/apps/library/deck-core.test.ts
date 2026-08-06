/**
 * deck-core + view-contract tests - the shelves' pure math: per-kind counts and the size dial's
 * fail-closed clamp.
 */
import { describe, expect, test } from "bun:test";
import type { StudioEntitySummary } from "../../app-contract";
import { deckCounts } from "./deck-core";
import { clampSize, SIZE_RANGE } from "./view-contract";

const e = (kind: string, id: string): StudioEntitySummary => ({ id, kind, name: id });

describe("deckCounts", () => {
  test("counts per kind in the given order, zeros included", () => {
    const out = deckCounts([e("character", "a"), e("character", "b"), e("lorebook", "c")], [
      "character",
      "lorebook",
      "persona",
    ]);
    expect(out).toEqual([
      { kind: "character", count: 2 },
      { kind: "lorebook", count: 1 },
      { kind: "persona", count: 0 },
    ]);
  });
  test("unknown kinds append after the known order (open by design)", () => {
    const out = deckCounts([e("regex", "r")], ["character"]);
    expect(out).toEqual([
      { kind: "character", count: 0 },
      { kind: "regex", count: 1 },
    ]);
  });
});

describe("clampSize", () => {
  test("clamps into the legal range, fails closed to the fallback", () => {
    expect(clampSize(8.5)).toBe(8.5);
    expect(clampSize(0)).toBe(SIZE_RANGE.min);
    expect(clampSize(999)).toBe(SIZE_RANGE.max);
    expect(clampSize("large")).toBe(SIZE_RANGE.fallback);
    expect(clampSize(NaN)).toBe(SIZE_RANGE.fallback);
    expect(clampSize(undefined)).toBe(SIZE_RANGE.fallback);
  });
});


import { bundlePayloadFromInspect, commitOrderedRows, orderForCommit, rewriteKnowledgeRefsFor } from "./deck-core";
import type { ImportBundlePayload } from "./deck-core";
import type { InspectResult, SaveBundleResult, SaveStagedPayload } from "../../app-contract";
import type { ReadFile } from "./import-triage";

describe("bundlePayloadFromInspect", () => {
  test("returns null for failed inspect", () => {
    expect(bundlePayloadFromInspect({ ok: false, error: "nope" })).toBeNull();
  });
  test("primary only when no related", () => {
    const r: InspectResult = { ok: true, entity: { id: "c", kind: "character" } };
    expect(bundlePayloadFromInspect(r)).toEqual({ entity: r.entity });
  });
  test("includes lorebooks when present", () => {
    const books = [{ id: "b", kind: "lorebook" }];
    const r: InspectResult = {
      ok: true,
      entity: { id: "c", kind: "character" },
      related: { lorebooks: books },
    };
    expect(bundlePayloadFromInspect(r)).toEqual({
      entity: r.entity,
      related: { lorebooks: books },
    });
  });
});

const bookRow = (filename: string, archiveKey: string, id: string, name = "Book"): ReadFile => ({
  filename,
  archiveKey,
  result: { ok: true, kind: "lorebook", entity: { id, kind: "lorebook", body: { name } } },
});

const personaRow = (filename: string, archiveKey: string, id: string, knowledgeRefs: string[]): ReadFile => ({
  filename,
  archiveKey,
  result: { ok: true, kind: "persona", entity: { id, kind: "persona", body: { name: id, knowledgeRefs } } },
});

describe("orderForCommit", () => {
  test("within one archive, every book saves before every non-book, original relative order preserved among each", () => {
    const rows = [
      personaRow("a: P1", "a", "p1", []),
      bookRow("a: B1", "a", "b1"),
      personaRow("a: P2", "a", "p2", []),
      bookRow("a: B2", "a", "b2"),
    ];
    const ordered = orderForCommit(rows);
    expect(ordered.map((r) => (r.result as { entity: { id: string } }).entity.id)).toEqual([
      "b1",
      "b2",
      "p1",
      "p2",
    ]);
  });

  test("non-archive rows keep their original order and come before every archive group", () => {
    const standalone: ReadFile = { filename: "card.png", result: { ok: true, kind: "character", entity: { id: "c1" } } };
    const ordered = orderForCommit([personaRow("a: P", "a", "p1", []), standalone, bookRow("a: B", "a", "b1")]);
    expect(ordered[0]).toBe(standalone);
  });

  test("two different archives never interleave: each group stays contiguous", () => {
    const ordered = orderForCommit([
      personaRow("a: P", "a", "p1", []),
      personaRow("b: P", "b", "p2", []),
      bookRow("a: B", "a", "b1"),
      bookRow("b: B", "b", "b2"),
    ]);
    const archives = ordered.map((r) => r.archiveKey);
    // each archive's own two rows are adjacent, never split by the other archive's rows
    const aIdx = archives.map((k, i) => (k === "a" ? i : -1)).filter((i) => i >= 0);
    const bIdx = archives.map((k, i) => (k === "b" ? i : -1)).filter((i) => i >= 0);
    expect(aIdx[1]! - aIdx[0]!).toBe(1);
    expect(bIdx[1]! - bIdx[0]!).toBe(1);
  });
});

describe("rewriteKnowledgeRefsFor", () => {
  test("an id present in idMap is rewritten to the real id", () => {
    const out = rewriteKnowledgeRefsFor({ body: { knowledgeRefs: ["lore"] } }, new Map([["lore", "lore-2"]]));
    expect((out as { body: { knowledgeRefs: string[] } }).body.knowledgeRefs).toEqual(["lore-2"]);
  });

  test("an id absent from idMap is DROPPED, not left dangling", () => {
    const out = rewriteKnowledgeRefsFor({ body: { knowledgeRefs: ["ghost"] } }, new Map());
    expect((out as { body: Record<string, unknown> }).body.knowledgeRefs).toBeUndefined();
  });

  test("works the same for a persona body as a character body (saveBundle's own rewrite is character-only)", () => {
    const out = rewriteKnowledgeRefsFor(
      { kind: "persona", body: { knowledgeRefs: ["lore"] } },
      new Map([["lore", "lore-3"]]),
    );
    expect((out as { body: { knowledgeRefs: string[] } }).body.knowledgeRefs).toEqual(["lore-3"]);
  });

  test("no knowledgeRefs at all: the entity comes back untouched", () => {
    const entity = { body: { name: "X" } };
    expect(rewriteKnowledgeRefsFor(entity, new Map([["a", "b"]]))).toBe(entity);
  });
});

/** A fake in-memory studio: the SAME keep-both collision semantics as src/studio/store.ts's own
 *  writeExclusive/retry loop (requested id first, then -2, -3, ... on a taken id) - so these tests
 *  prove commitOrderedRows against a REALISTIC id-collision studio, not a mock that always echoes
 *  the requested id straight back. Records every payload it actually received. */
function fakeStudio(preExisting: string[] = []): {
  save: (payload: ImportBundlePayload) => Promise<SaveBundleResult>;
  calls: ImportBundlePayload[];
} {
  const taken = new Set(preExisting);
  const calls: ImportBundlePayload[] = [];
  const save = async (payload: ImportBundlePayload): Promise<SaveBundleResult> => {
    calls.push(payload);
    const entity = payload.entity as { id: string; kind: string; body?: { name?: string } };
    let id = entity.id;
    if (taken.has(id)) {
      let n = 2;
      while (taken.has(`${entity.id}-${n}`)) n++;
      id = `${entity.id}-${n}`;
    }
    taken.add(id);
    return { ok: true, primary: { id, kind: entity.kind, name: entity.body?.name ?? id }, related: [] };
  };
  return { save, calls };
}

/** For entity-path tests: proves a row that carries its entity NEVER commits through the staged door. */
const rejectStaged = async (): Promise<SaveBundleResult> => {
  throw new Error("staged saver called for an entity-carrying row");
};

const kindOf = (p: ImportBundlePayload): string => (p.entity as { kind: string }).kind;
const idOf = (p: ImportBundlePayload): string => (p.entity as { id: string }).id;
const refsOf = (p: ImportBundlePayload): string[] | undefined =>
  (p.entity as { body?: { knowledgeRefs?: string[] } }).body?.knowledgeRefs;

describe("commitOrderedRows: the ISC-35 collision matrix", () => {
  test("case 1: a name collision with an EXISTING shelf entity re-suffixes the archive's book, and the persona's ref follows the REAL id, not the archive's own", async () => {
    const picked = orderForCommit([
      personaRow("a: P", "a.lvbak", "p1", ["lore"]),
      bookRow("a: Lore", "a.lvbak", "lore", "Lore"),
    ]);
    const { save, calls } = fakeStudio(["lore"]); // the shelf already has "lore"
    const { shelved, errors } = await commitOrderedRows(picked, { bundle: save, staged: rejectStaged });
    expect(errors).toEqual([]);
    expect(shelved).toBe(2);
    expect(calls.map(kindOf)).toEqual(["lorebook", "persona"]); // book saved first
    expect(refsOf(calls[1]!)).toEqual(["lore-2"]); // not "lore" - that id belongs to someone else now
  });

  test("case 2: two same-named archive books (already uniquely minted at parse) - each persona's ref lands on its OWN book's real id, even when the studio re-suffixes both", async () => {
    const picked = orderForCommit([
      personaRow("a: P1", "a.lvbak", "p1", ["lore"]),
      personaRow("a: P2", "a.lvbak", "p2", ["lore-2"]),
      bookRow("a: Lore A", "a.lvbak", "lore", "Lore"),
      bookRow("a: Lore B", "a.lvbak", "lore-2", "Lore"),
    ]);
    // the shelf ALSO already has "lore", forcing BOTH archive books to re-suffix in turn
    const { save, calls } = fakeStudio(["lore"]);
    const { shelved, errors } = await commitOrderedRows(picked, { bundle: save, staged: rejectStaged });
    expect(errors).toEqual([]);
    expect(shelved).toBe(4);
    const p1 = calls.find((c) => idOf(c) === "p1")!;
    const p2 = calls.find((c) => idOf(c) === "p2")!;
    // book A (archive id "lore") collides with the shelf's "lore" -> becomes "lore-2".
    // book B (archive id "lore-2") THEN collides with THAT - store.ts's own keep-both suffixes off
    // the REQUESTED id (base = entity.id), never a shared running counter, so this becomes
    // "lore-2-2", not "lore-3". Pinned here exactly because it is the non-obvious case: proves each
    // persona's ref still lands on its OWN book's real id even under this chained, uglier suffix.
    expect(refsOf(p1)).toEqual(["lore-2"]);
    expect(refsOf(p2)).toEqual(["lore-2-2"]);
  });

  test("case 3a: the book is simply unchecked (never in picked) - the persona's dangling ref is DROPPED, never left pointing at an id that will never exist", async () => {
    const picked = orderForCommit([personaRow("a: P", "a.lvbak", "p1", ["lore"])]);
    const { save, calls } = fakeStudio();
    const { shelved, errors } = await commitOrderedRows(picked, { bundle: save, staged: rejectStaged });
    expect(errors).toEqual([]);
    expect(shelved).toBe(1);
    expect(refsOf(calls[0]!)).toBeUndefined();
  });

  test("case 3b: the book is checked but FAILS to save - the persona's ref is still dropped, never left pointing at an entity that was never created", async () => {
    const picked = orderForCommit([
      personaRow("a: P", "a.lvbak", "p1", ["lore"]),
      bookRow("a: Lore", "a.lvbak", "lore", "Lore"),
    ]);
    const calls: ImportBundlePayload[] = [];
    const save = async (payload: ImportBundlePayload): Promise<SaveBundleResult> => {
      calls.push(payload);
      if (kindOf(payload) === "lorebook") return { ok: false, related: [], error: "disk full" };
      return { ok: true, primary: { id: idOf(payload), kind: "persona", name: "P" }, related: [] };
    };
    const { shelved, errors } = await commitOrderedRows(picked, { bundle: save, staged: rejectStaged });
    expect(errors).toEqual(["a: Lore: disk full"]);
    expect(shelved).toBe(1);
    expect(refsOf(calls[1]!)).toBeUndefined();
  });

  test("case 4: a normal character-with-embedded-book row (no archiveKey) is untouched - its own related.lorebooks bundle rides through exactly as saveBundle's own idMap already handles it", async () => {
    const embeddedBook = { id: "book-1", kind: "lorebook", body: { name: "Embedded" } };
    const character: ReadFile = {
      filename: "card.png",
      result: {
        ok: true,
        kind: "character",
        entity: { id: "char-1", kind: "character", body: { name: "Aria", knowledgeRefs: ["book-1"] } },
        related: { lorebooks: [embeddedBook] },
      },
    };
    const picked = orderForCommit([character]);
    const { save, calls } = fakeStudio();
    const { shelved, errors } = await commitOrderedRows(picked, { bundle: save, staged: rejectStaged });
    expect(errors).toEqual([]);
    expect(shelved).toBe(1);
    // ONE saveBundle call, still carrying the original related.lorebooks bundle - never split into
    // two independent saves, and knowledgeRefs is untouched (the SERVER's own idMap handles this
    // path; commitOrderedRows only ever rewrites when archiveKey is set)
    expect(calls).toHaveLength(1);
    expect(calls[0]!.related?.lorebooks).toEqual([embeddedBook]);
    expect(refsOf(calls[0]!)).toEqual(["book-1"]);
  });
});

/** A staged archive row: a staging ref + entityId + its own knowledgeRefs, deliberately NO entity
 *  (it waits server-side). Tokens differ per archive in real traffic - tests that stage two
 *  archives MUST pass distinct tokens, or they assert a world the server cannot produce. */
const stagedRow = (
  filename: string,
  archiveKey: string,
  kind: string,
  entityId: string,
  key: string,
  opts: { refs?: string[]; token?: string } = {},
): ReadFile => ({
  filename,
  archiveKey,
  result: {
    ok: true,
    kind,
    staged: { token: opts.token ?? "tok-1", key },
    entityId,
    contentHash: `hash-${key}`,
    ...(opts.refs ? { knowledgeRefs: opts.refs } : {}),
  },
});

describe("commitOrderedRows: staged archive rows commit by reference", () => {
  /** Same keep-both id semantics as fakeStudio, but keyed off entityId - the server's side of the
   *  staged door. Records every payload so tests can pin exactly what crossed the wire. */
  function fakeStagedStudio(preExisting: string[] = []): {
    staged: (payload: SaveStagedPayload) => Promise<SaveBundleResult>;
    calls: SaveStagedPayload[];
  } {
    const taken = new Set(preExisting);
    const byKey: Record<string, { kind: string; id: string }> = {
      "k-lore": { kind: "lorebook", id: "lore" },
      "k-p1": { kind: "persona", id: "p1" },
      "k-char": { kind: "character", id: "char" },
    };
    const calls: SaveStagedPayload[] = [];
    const staged = async (payload: SaveStagedPayload): Promise<SaveBundleResult> => {
      calls.push(payload);
      const row = byKey[payload.key]!;
      let id = row.id;
      if (taken.has(id)) {
        let n = 2;
        while (taken.has(`${row.id}-${n}`)) n++;
        id = `${row.id}-${n}`;
      }
      taken.add(id);
      return { ok: true, primary: { id, kind: row.kind, name: id }, related: [] };
    };
    return { staged, calls };
  }

  const rejectBundle = async (): Promise<SaveBundleResult> => {
    throw new Error("bundle saver called for a staged row");
  };

  test("a staged book saves first with NO refIds; the staged persona then carries the book's REAL post-collision id in refIds", async () => {
    const picked = orderForCommit([
      stagedRow("a: P", "a.lvbak", "persona", "p1", "k-p1", { refs: ["lore"] }),
      stagedRow("a: Lore", "a.lvbak", "lorebook", "lore", "k-lore"),
    ]);
    const { staged, calls } = fakeStagedStudio(["lore"]); // shelf collision forces "lore" -> "lore-2"
    const { shelved, errors } = await commitOrderedRows(picked, { bundle: rejectBundle, staged });
    expect(errors).toEqual([]);
    expect(shelved).toBe(2);
    expect(calls[0]!).toEqual({ token: "tok-1", key: "k-lore", refIds: {} }); // empty map, nothing shelved yet
    expect(calls[1]!).toEqual({ token: "tok-1", key: "k-p1", refIds: { lore: "lore-2" } });
  });

  test("a staged book that fails to save leaves an EMPTY refIds: the server's rewrite then drops the dangling ref, same as entity-path case 3b", async () => {
    const picked = orderForCommit([
      stagedRow("a: P", "a.lvbak", "persona", "p1", "k-p1", { refs: ["lore"] }),
      stagedRow("a: Lore", "a.lvbak", "lorebook", "lore", "k-lore"),
    ]);
    const calls: SaveStagedPayload[] = [];
    const staged = async (payload: SaveStagedPayload): Promise<SaveBundleResult> => {
      calls.push(payload);
      if (payload.key === "k-lore") return { ok: false, related: [], error: "disk full" };
      return { ok: true, primary: { id: "p1", kind: "persona", name: "P" }, related: [] };
    };
    const { shelved, errors } = await commitOrderedRows(picked, { bundle: rejectBundle, staged });
    expect(errors).toEqual(["a: Lore: disk full"]);
    expect(shelved).toBe(1);
    expect(calls[1]!.refIds).toEqual({});
  });

  test("a staged character rides the same door and the idMap resets across archives (a second archive's rows never see the first's refIds)", async () => {
    const a = [
      stagedRow("a: Lore", "a.lvbak", "lorebook", "lore", "k-lore", { token: "tok-a" }),
      stagedRow("a: C", "a.lvbak", "character", "char", "k-char", { refs: ["lore"], token: "tok-a" }),
    ];
    const b = [stagedRow("b: P", "b.lvbak", "persona", "p1", "k-p1", { refs: ["lore"], token: "tok-b" })];
    const { staged, calls } = fakeStagedStudio(["lore"]);
    const { shelved, errors } = await commitOrderedRows(orderForCommit([...a, ...b]), { bundle: rejectBundle, staged });
    expect(errors).toEqual([]);
    expect(shelved).toBe(3);
    const char = calls.find((c) => c.key === "k-char")!;
    expect(char.refIds).toEqual({ lore: "lore-2" });
    const otherArchivePersona = calls.find((c) => c.key === "k-p1")!;
    expect(otherArchivePersona.refIds).toEqual({}); // the first archive's map never leaks across
  });
});