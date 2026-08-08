/**
 * handleInspectArchive, tested against the handler directly (no StudioStore, no security rig - it
 * takes only a Request, same shape as handleInspect). Proves the three whole-archive abort cases
 * read as warm words, not raw exception text, and that a real archive's entities come back
 * sheet-renderable, one InspectResult-shaped row per entity, plus the full LvbakImportReport.
 */
import { describe, expect, test } from "bun:test";
import {
  buildFutureSchemaLvbak,
  buildMinimalLvbak,
  buildWrongProducerZip,
} from "../formats/_fixtures/lumiverse-archive/build-lvbak";
import type { InspectArchiveResult } from "./app-contract";
import { archiveErrorMessage, handleInspectArchive } from "./server-engine";

const req = (body: Uint8Array, filename = "backup.lvbak", contentType = "application/octet-stream"): Request =>
  new Request("http://127.0.0.1:8321/api/inspect-archive", {
    method: "POST",
    headers: { "content-type": contentType, "x-filename": filename },
    // cast: TS's BodyInit lib type predates Uint8Array<ArrayBufferLike>; Bun accepts it fine.
    body: body as unknown as BodyInit,
  });

describe("handleInspectArchive: a real archive", () => {
  test("buildMinimalLvbak: 200, ok, one InspectResult-shaped row per entity, plus the full report", async () => {
    const res = await handleInspectArchive(req(buildMinimalLvbak()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as InspectArchiveResult;
    expect(body.ok).toBe(true);
    expect(body.rows).toBeDefined();
    expect(body.rows!.length).toBeGreaterThan(0);
    // 1 world_books lorebook + 1 embedded book + persona + character + preset + regex set
    expect(body.rows!.length).toBe(6);

    for (const row of body.rows!) {
      expect(row.ok).toBe(true);
      expect(row.formatId).toBe("lumiverse-archive");
      expect(row.kind).toBeDefined();
      expect(row.staged).toBeDefined(); // the entity itself stays server-side; see the staged describe
      expect(row.receipt?.name).toBeTruthy();
      // FRIENDLY["lumiverse-archive"] = "Lumiverse", never the raw internal id
      expect(row.receipt?.kindLine).toContain("made for Lumiverse.");
      expect(row.parseReport).toBeDefined();
      // never a related grouping: an archive's embedded books/regex sets already arrive as their
      // own top-level rows, so listing them again here would double them in a sheet
      expect(row.related).toBeUndefined();
    }

    const character = body.rows!.find((r) => r.kind === "character");
    expect(character).toBeDefined();

    expect(body.report).toBeDefined();
    expect(body.report!.imported.character).toHaveLength(1);
    expect(body.report!.imported.lorebook).toHaveLength(2);
    expect(body.report!.imported.persona).toHaveLength(1);
    expect(body.report!.imported.preset).toHaveLength(1);
    expect(body.report!.imported.regex).toHaveLength(1);
    expect(body.report!.failed).toEqual([]);
  });

  test("a lorebook row's parseReport is derived from its OWN codec's escrow, not the archive's bookkeeping bucket", async () => {
    // Regression guard: buildParseReport(entity, "lumiverse-archive") would read the archive
    // escrow's own unmapped.table/unmapped.links bookkeeping as if it were dropped canonical
    // data. The right sourceId is the entity's own primary (first) original entry - here, the
    // SillyTavern worldbook codec that actually parsed it.
    const res = await handleInspectArchive(req(buildMinimalLvbak()));
    const body = (await res.json()) as InspectArchiveResult;
    // Rows no longer carry entities, so assert over EVERY book row: none may report the archive's
    // own bookkeeping escrow as if it were dropped canonical data (a superset of the old check,
    // which singled out the row whose escrow held the SillyTavern worldbook codec).
    const books = body.rows!.filter((r) => r.kind === "lorebook");
    expect(books.length).toBeGreaterThan(0);
    for (const book of books) {
      expect(book.parseReport!.escrowed.every((p) => !p.startsWith("original.lumiverse-archive."))).toBe(true);
    }
  });
});

describe("handleInspectArchive: staged references, never entity payloads", () => {
  test("every ok row carries a staged ref, entityId, and contentHash - and NO entity", async () => {
    // The whole point of staging: a 5 GiB backup's entities must never ride the response.
    // Committing happens by reference through /api/studio/save-staged.
    const res = await handleInspectArchive(req(buildMinimalLvbak()));
    const body = (await res.json()) as InspectArchiveResult;
    expect(body.ok).toBe(true);
    for (const row of body.rows!) {
      expect(row.entity).toBeUndefined();
      expect(row.staged?.token).toBeTruthy();
      expect(row.staged?.key).toBeTruthy();
      expect(typeof row.entityId).toBe("string");
      expect(typeof row.contentHash).toBe("string");
    }
    const keys = new Set(body.rows!.map((r) => r.staged!.key));
    expect(keys.size).toBe(body.rows!.length);
    const tokens = new Set(body.rows!.map((r) => r.staged!.token));
    expect(tokens.size).toBe(1); // one staging per upload
  });

  test("summary rows carry what the sheet used to read off the entity: knowledgeRefs and entryCount", async () => {
    // Without these the link caveat and the "N entries" chip silently die on archive rows - the
    // review that caught it proved both dead by running the fixture through the sheet helpers.
    const res = await handleInspectArchive(req(buildMinimalLvbak()));
    const body = (await res.json()) as InspectArchiveResult;
    const character = body.rows!.find((r) => r.kind === "character")!;
    expect(character.knowledgeRefs?.length).toBeGreaterThan(0);
    for (const book of body.rows!.filter((r) => r.kind === "lorebook")) {
      expect(book.entryCount).toBeGreaterThan(0);
    }
  });
});

describe("archiveErrorMessage: honest words for every failure class", () => {
  test("an unexpected error (the 2 GiB stringify RangeError's class) never blames the backup", () => {
    const msg = archiveErrorMessage(new RangeError("Out of memory"));
    expect(msg).not.toContain("does not look like a Lumiverse backup");
    expect(msg.toLowerCase()).toContain("hoplight");
  });

  test("the importer's own deliberate rejection keeps the plain not-a-backup line", () => {
    const msg = archiveErrorMessage(
      new Error('lumiverse-archive: not a recognizable .lvbak archive (no manifest.json naming producer "lumiverse" with a database/ tree beside it)'),
    );
    expect(msg).toContain("Lumiverse backup archive");
  });
});

describe("handleInspectArchive: whole-archive aborts", () => {
  test("buildFutureSchemaLvbak: 200, ok:false, warm words naming both schema versions", async () => {
    const res = await handleInspectArchive(req(buildFutureSchemaLvbak()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as InspectArchiveResult;
    expect(body.ok).toBe(false);
    expect(body.rows).toBeUndefined();
    expect(body.error).toContain("2");
    expect(body.error).toContain("1");
    expect(body.error).not.toContain("LvbakSchemaError");
  });

  test("buildWrongProducerZip: 200, ok:false, warm 'not a Lumiverse backup' line", async () => {
    const res = await handleInspectArchive(req(buildWrongProducerZip()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as InspectArchiveResult;
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Lumiverse backup archive");
    expect(body.error).not.toContain("lumiverse-archive:"); // never the raw thrown-Error prefix
  });
});

describe("handleInspectArchive: request-shape guards", () => {
  test("wrong content-type: 415", async () => {
    const res = await handleInspectArchive(req(buildMinimalLvbak(), "backup.lvbak", "application/zip"));
    expect(res.status).toBe(415);
  });

  test("a filename not ending in .lvbak: 400, before any bytes are staged to disk", async () => {
    const res = await handleInspectArchive(req(buildMinimalLvbak(), "backup.zip"));
    expect(res.status).toBe(400);
  });

  test("empty body: 400", async () => {
    const res = await handleInspectArchive(req(new Uint8Array(0)));
    expect(res.status).toBe(400);
  });
});

describe("handleInspectArchive: single-flight cap", () => {
  test("a request that overlaps an already in-flight inspect gets a warm 429; the first still succeeds", async () => {
    // handleInspectArchive is async and its whole synchronous prefix (content-type, filename,
    // the in-flight check-and-set) runs before its first `await` (mkdtemp) - so calling it twice
    // back to back, without awaiting the first, genuinely overlaps them: by the time the second
    // call's own synchronous prefix runs, the first has already set the flag.
    const p1 = handleInspectArchive(req(buildMinimalLvbak()));
    const p2 = handleInspectArchive(req(buildMinimalLvbak()));
    const [res1, res2] = await Promise.all([p1, p2]);

    expect(res2.status).toBe(429);
    // 429 is a REQUEST-level rejection, same shape as every other guard in this handler (415, 400):
    // { error }, never the { ok: false, error } InspectArchiveResult shape - that one's reserved
    // for a 200 whose ARCHIVE PROCESSING itself failed (schema mismatch, corruption), a different
    // class of failure than "refused before we even tried."
    const body2 = (await res2.json()) as { error: string };
    expect(body2.error).toContain("Another backup is still being read");

    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as InspectArchiveResult;
    expect(body1.ok).toBe(true);
  });

  test("the flag releases once the in-flight request finishes: a later, non-overlapping request still succeeds", async () => {
    const first = await handleInspectArchive(req(buildMinimalLvbak()));
    expect(first.status).toBe(200);
    const second = await handleInspectArchive(req(buildMinimalLvbak()));
    expect(second.status).toBe(200);
  });

  test("the flag releases even after a whole-archive abort, not just a success", async () => {
    const aborted = await handleInspectArchive(req(buildWrongProducerZip()));
    expect(aborted.status).toBe(200); // whole-archive aborts still respond 200 with ok:false
    const next = await handleInspectArchive(req(buildMinimalLvbak()));
    expect(next.status).toBe(200);
    const body = (await next.json()) as InspectArchiveResult;
    expect(body.ok).toBe(true);
  });
});
