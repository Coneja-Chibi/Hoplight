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
import { handleInspectArchive } from "./server-engine";

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
      expect(row.entity).toBeDefined();
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
    const book = body.rows!.find((r) => r.kind === "lorebook" && (r.entity as { original?: Record<string, unknown> }).original?.["sillytavern-lorebook"]);
    expect(book).toBeDefined();
    expect(book!.parseReport!.escrowed.every((p) => !p.startsWith("original.lumiverse-archive."))).toBe(true);
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
