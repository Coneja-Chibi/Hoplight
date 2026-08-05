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
  groupReportFailures,
  markDupes,
  shelfKey,
  summarizeImportedTotals,
  summarizeSkippedTables,
  triageFiles,
  unresolvedArchiveRefs,
  withArchiveLinkCaveat,
  type ReadFile,
} from "./import-triage";
import type { LvbakImportReport } from "../../../formats/lumiverse-archive/report";

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

const emptyReport = (): LvbakImportReport => ({
  imported: { character: [], lorebook: [], preset: [], persona: [], regex: [] },
  failed: [],
  skippedTables: [],
  missingBinaries: [],
  unresolvedLinks: [],
  warnings: [],
});

describe("summarizeImportedTotals", () => {
  test("only the kinds an archive actually carried, pluralized correctly", () => {
    const imported = emptyReport().imported;
    imported.character = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }];
    imported.lorebook = [{ id: "d", name: "D" }];
    expect(summarizeImportedTotals(imported)).toBe("3 character cards, 1 lorebook imported.");
  });

  test("nothing imported: an empty string, so the caller can supply its own fallback line", () => {
    expect(summarizeImportedTotals(emptyReport().imported)).toBe("");
  });
});

describe("summarizeSkippedTables", () => {
  test("the exact honesty line: named counts, comma-joined, one sentence", () => {
    const skipped = [
      { table: "chats", rows: 3 },
      { table: "messages", rows: 12 },
    ];
    expect(summarizeSkippedTables(skipped)).toBe("3 chats, 12 messages did not come along.");
  });

  test("a null count (no manifest-stats) reads as 'some', never a guessed zero", () => {
    expect(summarizeSkippedTables([{ table: "packs", rows: null }])).toBe("some packs did not come along.");
  });

  test("a known-but-unusual table still pluralizes correctly (all nine KNOWN_SKIPPED_TABLES words)", () => {
    expect(summarizeSkippedTables([{ table: "lumia_items", rows: 2 }])).toBe("2 Lumia items did not come along.");
  });

  test("a table outside TABLE_WORD (a future export) is humanized without a forced, possibly-wrong 's'", () => {
    expect(summarizeSkippedTables([{ table: "future_widgets", rows: 5 }])).toBe(
      "5 future widgets did not come along.",
    );
  });

  test("nothing skipped: an empty string", () => {
    expect(summarizeSkippedTables([])).toBe("");
  });
});

describe("groupReportFailures", () => {
  test("reuses groupBadRows' own bucketing: shared reasons collapse, insertion order holds", () => {
    const groups = groupReportFailures([
      { table: "characters", rowId: "c1", name: "Aria", reason: "bad extensions" },
      { table: "personas", rowId: "p1", reason: "bad metadata" },
      { table: "characters", rowId: "c2", name: "Beta", reason: "bad extensions" },
    ]);
    expect(groups.map((g) => g.error)).toEqual(["bad extensions", "bad metadata"]);
    expect(groups[0]!.filenames).toEqual(["Aria", "Beta"]);
  });

  test("a row with no name falls back to its rowId, and no id falls back to its table", () => {
    const groups = groupReportFailures([
      { table: "regex_scripts", rowId: "", reason: "x" },
      { table: "presets", rowId: "p9", reason: "y" },
    ]);
    const byReason = new Map(groups.map((g) => [g.error, g.filenames]));
    expect(byReason.get("x")).toEqual(["regex_scripts"]);
    expect(byReason.get("y")).toEqual(["p9"]);
  });
});

const archiveRow = (kind: string, knowledgeRefs?: string[], id = "x"): InspectResult =>
  ({
    ok: true,
    kind,
    entity: { id, kind, body: { name: "X", knowledgeRefs } },
    receipt: { name: "X", kindLine: "", extras: [] },
  }) as unknown as InspectResult;

const archiveReadRow = (filename: string, archiveKey: string, result: InspectResult): ReadFile => ({
  filename,
  result,
  archiveKey,
});

describe("withArchiveLinkCaveat", () => {
  test("a reference in the unresolved set gets the caveat appended, never replacing existing extras", () => {
    const character = archiveRow("character", ["shared-book"]);
    (character as { receipt: { extras: string[] } }).receipt.extras = ["It brought its own lorebook."];
    const out = withArchiveLinkCaveat(character, new Set(["shared-book"]));
    expect(out.receipt!.extras).toEqual([
      "It brought its own lorebook.",
      "Links to a lorebook from the same backup, but that book is not checked (or did not import) - check it too, or this link will not carry over.",
    ]);

    const persona = withArchiveLinkCaveat(archiveRow("persona", ["shared-book"]), new Set(["shared-book"]));
    expect(persona.receipt!.extras.some((e) => e.includes("Links to a lorebook"))).toBe(true);
  });

  test("a reference NOT in the unresolved set (the system will handle it correctly): no caveat", () => {
    const out = withArchiveLinkCaveat(archiveRow("character", ["shared-book"]), new Set());
    expect(out.receipt!.extras).toEqual([]);
  });

  test("no knowledgeRefs, a non-character/persona kind, or a failed row: untouched", () => {
    const unresolved = new Set(["x"]);
    expect(withArchiveLinkCaveat(archiveRow("character", []), unresolved)).toEqual(archiveRow("character", []));
    expect(withArchiveLinkCaveat(archiveRow("lorebook", ["x"]), unresolved).receipt!.extras).toEqual([]);
    const failed: InspectResult = { ok: false, error: "nope" };
    expect(withArchiveLinkCaveat(failed, unresolved)).toBe(failed);
  });
});

describe("unresolvedArchiveRefs", () => {
  test("a checked, ok lorebook row resolves its id; an unchecked one does not", () => {
    const reads: ReadFile[] = [
      archiveReadRow("a: Lore", "a.lvbak", archiveRow("lorebook", undefined, "lore")),
      archiveReadRow("a: P", "a.lvbak", archiveRow("persona", ["lore"])),
    ];
    // book checked (index 0) and persona checked (index 1): nothing unresolved
    expect(unresolvedArchiveRefs(reads, new Set([0, 1]), "a.lvbak")).toEqual(new Set());
    // book UNCHECKED: its id is referenced but never resolvable
    expect(unresolvedArchiveRefs(reads, new Set([1]), "a.lvbak")).toEqual(new Set(["lore"]));
  });

  test("a failed book row never resolves its id even if its index is 'checked'", () => {
    const reads: ReadFile[] = [
      archiveReadRow("a: Lore", "a.lvbak", { ok: false, error: "boom" }),
      archiveReadRow("a: P", "a.lvbak", archiveRow("persona", ["lore"])),
    ];
    expect(unresolvedArchiveRefs(reads, new Set([0, 1]), "a.lvbak")).toEqual(new Set(["lore"]));
  });

  test("scoped per archive: a same-id row from a DIFFERENT archive never resolves this one's reference", () => {
    const reads: ReadFile[] = [
      archiveReadRow("b: Lore", "b.lvbak", archiveRow("lorebook", undefined, "lore")),
      archiveReadRow("a: P", "a.lvbak", archiveRow("persona", ["lore"])),
    ];
    expect(unresolvedArchiveRefs(reads, new Set([0, 1]), "a.lvbak")).toEqual(new Set(["lore"]));
  });

  test("a reference to something outside the drop entirely (no row anywhere) is unresolved", () => {
    const reads: ReadFile[] = [archiveReadRow("a: P", "a.lvbak", archiveRow("persona", ["ghost-book"]))];
    expect(unresolvedArchiveRefs(reads, new Set([0]), "a.lvbak")).toEqual(new Set(["ghost-book"]));
  });
});
