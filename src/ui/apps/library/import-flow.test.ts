/**
 * annotateRead must pass adapter-produced canonical bodies through UNTOUCHED. Every ok inspect
 * result comes from a real format adapter (server-engine handleInspect), so "healing" here can only
 * destroy: the enumerated heal rebuild silently reset every canonical field outside its list -
 * caught live when a Marinara import arrived with its folders (categories) stripped.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalLorebook } from "../../../entities/lorebook/schema";
import type { InspectResult } from "../../app-contract";
import marinaraLorebook from "../../../formats/marinara/lorebook";
import {
  annotateRead,
  defaultCheckedIndexes,
  groupBadRows,
  markDupes,
  shelfKey,
  triageFiles,
  type ReadFile,
} from "./import-triage";

const FIXTURE = join(
  import.meta.dir,
  "../../../../samples/marinara/lorebooks/arcadia-world-lore.marinara.json",
);

describe("annotateRead", () => {
  test("keeps the codec body byte-identical: categories, positions, memberships survive", () => {
    const entity = marinaraLorebook.toCanonical({ text: readFileSync(FIXTURE, "utf8") });
    const out = annotateRead("arcadia.marinara.json", { ok: true, entity, kind: "lorebook" });
    const body = (out.result.entity as CanonicalLorebook).body;
    expect(body).toEqual(entity.body);
    expect((body.categories ?? []).map((c) => c.id)).toEqual(["folder-court", "folder-spies"]);
    expect(body.entries.find((e) => e.id === "e-oathbound-spies")!.categoryId).toBe("folder-spies");
    expect(out.entryCount).toBe(4);
  });

  test("related bundle lorebooks pass through untouched with a summed entry count", () => {
    const entity = marinaraLorebook.toCanonical({ text: readFileSync(FIXTURE, "utf8") });
    const out = annotateRead("card.png", {
      ok: true,
      entity: { kind: "character", body: {} },
      kind: "character",
      related: { lorebooks: [entity] },
    });
    const kept = (out.result.related?.lorebooks?.[0] as CanonicalLorebook).body;
    expect(kept).toEqual(entity.body);
    expect(out.entryCount).toBe(4);
  });
});

const okRead = (filename: string, name: string, kind = "character", extra = ""): ReadFile => ({
  filename,
  result: {
    ok: true,
    kind,
    entity: { kind, body: { name, extra } },
    receipt: { name, kindLine: "", extras: [] },
  } as unknown as InspectResult,
});

const badRead = (filename: string, error: string): ReadFile => ({
  filename,
  result: { ok: false, error },
});

describe("triageFiles: an ST backups folder sorts itself before the wire", () => {
  test("candidates pass, chat logs and foreign types group out, oversize stops early", () => {
    const files = [
      new File(["{}"], "card.json"),
      new File([""], "portrait.png"),
      new File([""], "pack.charx"),
      new File([""], "set.risum"),
      new File([""], "chat 1.jsonl"),
      new File([""], "chat 2.jsonl"),
      new File([""], "theme.css"),
      new File([""], "README"),
    ];
    const big = new File([""], "huge.json");
    Object.defineProperty(big, "size", { value: 65 * 1024 * 1024 });
    const { candidates, skipped } = triageFiles([...files, big]);
    expect(candidates.map((f) => f.name)).toEqual(["card.json", "portrait.png", "pack.charx", "set.risum"]);
    const reasons = new Map(skipped.map((s) => [s.filename, s.result.error]));
    expect(reasons.get("chat 1.jsonl")).toContain("chat log");
    expect(reasons.get("theme.css")).toContain(".css");
    expect(reasons.get("README")).toContain("not a file type");
    expect(reasons.get("huge.json")).toContain("64MB");
  });

  test(".lvbak routes to its own archive bucket, never the single-file candidate pool", () => {
    const backup = new File([""], "my-lumiverse-export.lvbak");
    const { candidates, archives, skipped } = triageFiles([backup, new File(["{}"], "card.json")]);
    expect(archives.map((f) => f.name)).toEqual(["my-lumiverse-export.lvbak"]);
    expect(candidates.map((f) => f.name)).toEqual(["card.json"]);
    expect(skipped).toEqual([]);
  });

  test(".lvbak is exempt from the 64MB triage ceiling - a real backup is multi-gigabyte by design", () => {
    const backup = new File([""], "huge.lvbak");
    Object.defineProperty(backup, "size", { value: 500 * 1024 * 1024 });
    const { candidates, archives, skipped } = triageFiles([backup]);
    expect(archives.map((f) => f.name)).toEqual(["huge.lvbak"]);
    expect(candidates).toEqual([]);
    expect(skipped).toEqual([]);
  });
});

describe("duplicate marking", () => {
  test("shelf match by kind+name marks default-unchecked; different kind never matches", () => {
    const shelf = new Map([[shelfKey("character", "Nyx"), "Nyx"]]);
    const seen = new Map<string, string>();
    const hit = markDupes(okRead("nyx.png", "  nyx "), shelf, seen);
    expect(hit.shelfDupe).toBe("Nyx");
    const miss = markDupes(okRead("nyx-book.json", "Nyx", "lorebook"), shelf, seen);
    expect(miss.shelfDupe).toBeUndefined();
  });

  test("identical content within one drop marks the SECOND copy, never the first", () => {
    const shelf = new Map<string, string>();
    const seen = new Map<string, string>();
    const first = markDupes(okRead("a.png", "Nyx"), shelf, seen);
    const second = markDupes(okRead("copy of a.png", "Nyx"), shelf, seen);
    const different = markDupes(okRead("b.png", "Nyx", "character", "v2"), shelf, seen);
    expect(first.batchDupe).toBeUndefined();
    expect(second.batchDupe).toBe("a.png");
    expect(different.batchDupe).toBeUndefined();
  });

  test("defaultCheckedIndexes excludes failures and both duplicate flavors", () => {
    const reads: ReadFile[] = [
      okRead("a.png", "A"),
      { ...okRead("b.png", "B"), shelfDupe: "B" },
      { ...okRead("c.png", "C"), batchDupe: "a.png" },
      badRead("d.jsonl", "a chat log"),
    ];
    expect(defaultCheckedIndexes(reads)).toEqual([0]);
  });
});

describe("groupBadRows", () => {
  test("groups by reason in insertion order, keeping filenames and indexes aligned", () => {
    const reads: ReadFile[] = [
      okRead("ok.png", "Ok"),
      badRead("1.jsonl", "a chat log"),
      badRead("t.css", "not a file type"),
      badRead("2.jsonl", "a chat log"),
    ];
    const groups = groupBadRows(reads);
    expect(groups.map((g) => g.error)).toEqual(["a chat log", "not a file type"]);
    expect(groups[0]!.filenames).toEqual(["1.jsonl", "2.jsonl"]);
    expect(groups[0]!.indexes).toEqual([1, 3]);
  });
});
