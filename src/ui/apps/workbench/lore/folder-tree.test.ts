/**
 * Folder-forest logic for the Marinara binder lens - pinned to the engine semantics the locked
 * wireframe (vs-lore-mari-folders) cites: buildFolderForest fallback-to-root, the reparent cycle
 * rule, ancestor gating, promote-delete, sibling clone. The escrow read is proven against the real
 * sample export (samples/marinara/lorebooks/arcadia-world-lore.marinara.json).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LorebookBody, LorebookCategory } from "../../../../entities/lorebook/schema";
import marinaraLorebook from "../../../../formats/marinara/lorebook";
import {
  addFolder,
  buildFolderForest,
  canReparentFolder,
  cloneFolder,
  deleteFolderPromote,
  effectivelyDisabledFolderIds,
  folderCounts,
  legalParents,
  patchCategory,
  readMarinaraEdges,
  reorderSiblingFolder,
  reparentFolder,
  writeMarinaraEdges,
} from "./folder-tree";

const cat = (id: string, sortOrder: number, enabled?: boolean): LorebookCategory =>
  enabled === undefined ? { id, name: id, sortOrder } : { id, name: id, sortOrder, enabled };

const edgesOf = (pairs: Record<string, string | null>): Map<string, string | null> =>
  new Map(Object.entries(pairs));

const FIXTURE = join(import.meta.dir, "../../../../../samples/marinara/lorebooks/arcadia-world-lore.marinara.json");

function arcadia(): { body: LorebookBody; original: unknown } {
  const entity = marinaraLorebook.toCanonical({ text: readFileSync(FIXTURE, "utf8") });
  return { body: entity.body, original: entity.original };
}

describe("readMarinaraEdges", () => {
  test("reads the nested pair from the real sample export", () => {
    const { original } = arcadia();
    const edges = readMarinaraEdges(original);
    expect(edges.get("folder-court")).toBeNull();
    expect(edges.get("folder-spies")).toBe("folder-court");
  });

  test("returns an empty map on missing or malformed escrow", () => {
    expect(readMarinaraEdges(undefined).size).toBe(0);
    expect(readMarinaraEdges({}).size).toBe(0);
    expect(readMarinaraEdges({ "marinara-lorebook": { raw: { data: { folders: "nope" } } } }).size).toBe(0);
  });
});

describe("buildFolderForest", () => {
  test("projects the arcadia nesting: Espionage under Silver Court", () => {
    const { body, original } = arcadia();
    const forest = buildFolderForest(body.categories ?? [], readMarinaraEdges(original));
    expect(forest.map((n) => n.category.id)).toEqual(["folder-court"]);
    expect(forest[0]!.children.map((n) => n.category.id)).toEqual(["folder-spies"]);
  });

  test("sorts each sibling group by sortOrder independently", () => {
    const cats = [cat("a", 20), cat("b", 10), cat("a1", 20), cat("a2", 10)];
    const forest = buildFolderForest(cats, edgesOf({ a1: "a", a2: "a" }));
    expect(forest.map((n) => n.category.id)).toEqual(["b", "a"]);
    expect(forest[1]!.children.map((n) => n.category.id)).toEqual(["a2", "a1"]);
  });

  test("a dangling parent falls back to the root (engine rule: nothing becomes uneditable)", () => {
    const forest = buildFolderForest([cat("a", 10)], edgesOf({ a: "ghost" }));
    expect(forest.map((n) => n.category.id)).toEqual(["a"]);
  });

  test("a cyclic chain falls back to the root", () => {
    const forest = buildFolderForest([cat("a", 10), cat("b", 20)], edgesOf({ a: "b", b: "a" }));
    expect(forest.map((n) => n.category.id).sort()).toEqual(["a", "b"]);
  });
});

describe("canReparentFolder", () => {
  const cats = [cat("root", 10), cat("mid", 20), cat("leaf", 30), cat("other", 40)];
  const edges = edgesOf({ mid: "root", leaf: "mid" });
  const known = new Set(cats.map((c) => c.id));

  test("null (the root) is always legal", () => {
    expect(canReparentFolder(edges, "root", null, known)).toBe(true);
  });
  test("self-parent is refused", () => {
    expect(canReparentFolder(edges, "mid", "mid", known)).toBe(false);
  });
  test("a descendant target is refused (the cycle rule)", () => {
    expect(canReparentFolder(edges, "root", "leaf", known)).toBe(false);
    expect(canReparentFolder(edges, "root", "mid", known)).toBe(false);
  });
  test("an unknown target is refused", () => {
    expect(canReparentFolder(edges, "mid", "ghost", known)).toBe(false);
  });
  test("a sibling subtree is legal", () => {
    expect(canReparentFolder(edges, "root", "other", known)).toBe(true);
  });
  test("legalParents filters exactly to the survivors", () => {
    expect(legalParents(cats, edges, "root").map((c) => c.id)).toEqual(["other"]);
    expect(legalParents(cats, edges, "leaf").map((c) => c.id)).toEqual(["root", "mid", "other"]);
  });
});

describe("effectivelyDisabledFolderIds", () => {
  test("a disabled ancestor gates the whole subtree, enabled children included", () => {
    const cats = [cat("top", 10, false), cat("child", 20, true), cat("grand", 30)];
    const gated = effectivelyDisabledFolderIds(cats, edgesOf({ child: "top", grand: "child" }));
    expect(gated).toEqual(new Set(["top", "child", "grand"]));
  });
  test("an enabled chain gates nothing", () => {
    const cats = [cat("top", 10), cat("child", 20)];
    expect(effectivelyDisabledFolderIds(cats, edgesOf({ child: "top" })).size).toBe(0);
  });
});

describe("counts + flat ops", () => {
  test("folderCounts: direct entries + direct subfolders (arcadia: 1+1 and 1+0)", () => {
    const { body, original } = arcadia();
    const counts = folderCounts(body.categories ?? [], readMarinaraEdges(original), body.entries);
    expect(counts.get("folder-court")).toEqual({ entries: 1, folders: 1 });
    expect(counts.get("folder-spies")).toEqual({ entries: 1, folders: 0 });
  });

  test("addFolder appends at the root after every sibling; patchCategory renames in place", () => {
    const { body, original } = arcadia();
    const added = addFolder(body, readMarinaraEdges(original), "Archives");
    const addedCat = (added.body.categories ?? []).find((c) => c.id === added.id)!;
    expect(addedCat.name).toBe("Archives");
    expect(addedCat.sortOrder).toBeGreaterThan(20);
    expect(added.edges.get(added.id)).toBeNull();
    const renamed = patchCategory(added.body, added.id, { name: "The Stacks" });
    expect((renamed.categories ?? []).find((c) => c.id === added.id)!.name).toBe("The Stacks");
  });
});

describe("deleteFolderPromote (engine removeFolder default)", () => {
  test("entries drop to the root, direct children lift to the root, nothing is lost", () => {
    const { body, original } = arcadia();
    const out = deleteFolderPromote(body, readMarinaraEdges(original), "folder-court");
    expect((out.body.categories ?? []).map((c) => c.id)).toEqual(["folder-spies"]);
    const silver = out.body.entries.find((e) => e.id === "e-silver-court")!;
    expect(silver.categoryId).toBeNull();
    // the child folder lifted to the root, its own membership intact
    expect(out.edges.get("folder-spies")).toBeNull();
    expect(out.body.entries.find((e) => e.id === "e-oathbound-spies")!.categoryId).toBe("folder-spies");
    expect(out.body.entries.length).toBe(body.entries.length);
  });
});

describe("cloneFolder (engine: sibling deep copy, root renamed)", () => {
  test("copies the subtree + member entries; the copy is a sibling named (Copy)", () => {
    const { body, original } = arcadia();
    const edges = readMarinaraEdges(original);
    const out = cloneFolder(body, edges, "folder-court");
    const cats = out.body.categories ?? [];
    expect(cats.length).toBe(4);
    const copyRoot = cats.find((c) => c.name === "Silver Court (Copy)")!;
    expect(out.edges.get(copyRoot.id)).toBeNull();
    const copyChild = cats.find((c) => c.name === "Espionage" && c.id !== "folder-spies")!;
    expect(out.edges.get(copyChild.id)).toBe(copyRoot.id);
    // both member entries duplicated into the copies, originals untouched
    expect(out.body.entries.length).toBe(body.entries.length + 2);
    expect(out.body.entries.filter((e) => e.categoryId === copyRoot.id).length).toBe(1);
    expect(out.body.entries.filter((e) => e.categoryId === copyChild.id).length).toBe(1);
  });
});

describe("reparent + sibling reorder", () => {
  test("reparentFolder applies a legal move and refuses an illegal one untouched", () => {
    const cats = [cat("a", 10), cat("b", 20), cat("c", 30)];
    const edges = edgesOf({ b: "a" });
    const moved = reparentFolder(edges, cats, "c", "b");
    expect(moved.get("c")).toBe("b");
    const refused = reparentFolder(moved, cats, "a", "c");
    expect(refused.get("a") ?? null).toBeNull();
  });

  test("reorderSiblingFolder renumbers only the shared container", () => {
    const body = {
      ...arcadia().body,
      categories: [cat("a", 10), cat("b", 20), cat("c", 30), cat("x1", 10)],
    };
    const edges = edgesOf({ x1: "a" });
    const out = reorderSiblingFolder(body, edges, "c", "a", "above");
    const order = (out.categories ?? [])
      .filter((c) => ["a", "b", "c"].includes(c.id))
      .sort((p, q) => p.sortOrder - q.sortOrder)
      .map((c) => c.id);
    expect(order).toEqual(["c", "a", "b"]);
    expect((out.categories ?? []).find((c) => c.id === "x1")!.sortOrder).toBe(10);
  });
});

describe("writeMarinaraEdges", () => {
  test("updates existing escrow rows, keeps their unrelated fields, prunes deleted folders", () => {
    const { body, original } = arcadia();
    const edges = new Map<string, string | null>([["folder-court", null], ["folder-spies", null]]);
    const out = writeMarinaraEdges(original, edges, body.categories ?? []);
    const rows = ((out["marinara-lorebook"] as Record<string, unknown>).raw as { data: { folders: Record<string, unknown>[] } }).data.folders;
    expect(rows.length).toBe(2);
    const spies = rows.find((r) => r.id === "folder-spies")!;
    expect(spies.parentFolderId).toBeNull();
    expect(spies.createdAt).toBe("2026-06-20T10:02:00.000Z");
    const pruned = writeMarinaraEdges(original, edges, (body.categories ?? []).filter((c) => c.id !== "folder-spies"));
    const prunedRows = ((pruned["marinara-lorebook"] as Record<string, unknown>).raw as { data: { folders: Record<string, unknown>[] } }).data.folders;
    expect(prunedRows.map((r) => r.id)).toEqual(["folder-court"]);
  });

  test("seeds a minimal envelope + rows for a book with no Marinara escrow", () => {
    const cats = [cat("f1", 10), cat("f2", 20)];
    const out = writeMarinaraEdges({}, edgesOf({ f2: "f1" }), cats);
    const raw = (out["marinara-lorebook"] as Record<string, unknown>).raw as Record<string, unknown>;
    expect(raw.type).toBe("marinara_lorebook");
    const rows = (raw.data as { folders: Record<string, unknown>[] }).folders;
    expect(rows.find((r) => r.id === "f2")!.parentFolderId).toBe("f1");
    expect(rows.find((r) => r.id === "f1")!.parentFolderId).toBeNull();
  });

  test("round-trips through the codec: reparented escrow survives export", () => {
    const { body, original } = arcadia();
    // un-nest Espionage, then export through the real adapter and re-read
    const edges = new Map<string, string | null>([["folder-court", null], ["folder-spies", null]]);
    const entity = {
      schemaVersion: 1,
      kind: "lorebook" as const,
      id: "t",
      body,
      original: writeMarinaraEdges(original, edges, body.categories ?? []) as never,
    };
    const emitted = marinaraLorebook.fromCanonical(entity as never);
    const reread = readMarinaraEdges(
      marinaraLorebook.toCanonical({ text: emitted.text! }).original,
    );
    expect(reread.get("folder-spies")).toBeNull();
  });
});
