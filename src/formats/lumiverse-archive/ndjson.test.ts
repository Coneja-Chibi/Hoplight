/**
 * The NDJSON reader, with the line ceiling as the main event. The ceiling is the one place where
 * an archive's manifest changes how strictly its own body is read, so both modes are pinned
 * against the same oversized line: legacy lets it through, a v1 promise does not.
 */
import { describe, expect, test } from "bun:test";
import {
  LEGACY_MAX_NDJSON_LINE_BYTES,
  MAX_NDJSON_LINE_BYTES,
  ndjsonLineCeiling,
  readNdjson,
  type NdjsonLineFailure,
} from "./ndjson";
import {
  assembleLvbak,
  buildLegacyNoFormatVersionLvbak,
  lvbakManifest,
} from "../_fixtures/lumiverse-archive/build-lvbak";
import { characterRow } from "../_fixtures/lumiverse-archive/rows";
import { zipEntrySource } from "./zip-source";

const streamOf = (text: string, chunkSize = 7): ReadableStream<Uint8Array> => {
  const bytes = new TextEncoder().encode(text);
  let at = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (at >= bytes.byteLength) {
        controller.close();
        return;
      }
      const end = Math.min(at + chunkSize, bytes.byteLength);
      controller.enqueue(bytes.slice(at, end));
      at = end;
    },
  });
};

interface Drained {
  rows: Array<Record<string, unknown>>;
  lines: number[];
  failures: NdjsonLineFailure[];
}

const drain = async (
  stream: ReadableStream<Uint8Array>,
  maxLineBytes = MAX_NDJSON_LINE_BYTES,
): Promise<Drained> => {
  const out: Drained = { rows: [], lines: [], failures: [] };
  for await (const { line, row } of readNdjson(stream, {
    maxLineBytes,
    onFailure: (f) => out.failures.push(f),
  })) {
    out.rows.push(row);
    out.lines.push(line);
  }
  return out;
};

describe("readNdjson", () => {
  test("yields one row per line, numbered from one", async () => {
    const result = await drain(streamOf('{"id":"a"}\n{"id":"b"}\n{"id":"c"}\n'));
    expect(result.rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(result.lines).toEqual([1, 2, 3]);
    expect(result.failures).toEqual([]);
  });

  test("survives rows split across chunk boundaries", async () => {
    const text = `${JSON.stringify({ id: "a", note: "x".repeat(500) })}\n${JSON.stringify({ id: "b" })}\n`;
    for (const chunkSize of [1, 3, 64, 100_000]) {
      const result = await drain(streamOf(text, chunkSize));
      expect([chunkSize, result.rows.map((r) => r.id)]).toEqual([chunkSize, ["a", "b"]]);
    }
  });

  test("a final line without a trailing newline is still a row", async () => {
    const result = await drain(streamOf('{"id":"a"}\n{"id":"b"}'));
    expect(result.rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  test("blank lines are neither rows nor failures", async () => {
    const result = await drain(streamOf('\n{"id":"a"}\n\n   \n{"id":"b"}\n\n'));
    expect(result.rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(result.failures).toEqual([]);
  });

  test("an empty entry produces nothing at all", async () => {
    const result = await drain(streamOf(""));
    expect(result.rows).toEqual([]);
    expect(result.failures).toEqual([]);
  });

  test("an unparseable line fails alone and the stream continues", async () => {
    const result = await drain(streamOf('{"id":"a"}\n{ broken\n{"id":"c"}\n'));
    expect(result.rows.map((r) => r.id)).toEqual(["a", "c"]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.line).toBe(2);
    expect(result.failures[0]!.reason).toContain("unparseable JSON");
  });

  test("a JSON array line is not a row", async () => {
    const result = await drain(streamOf('[1,2,3]\n{"id":"a"}\n'));
    expect(result.rows.map((r) => r.id)).toEqual(["a"]);
    expect(result.failures[0]!.reason).toBe("line is not a JSON object");
  });
});

describe("line ceilings", () => {
  test("the ceiling follows ndjsonFormatVersion", () => {
    expect(ndjsonLineCeiling(1)).toBe(MAX_NDJSON_LINE_BYTES);
    expect(ndjsonLineCeiling(2)).toBe(MAX_NDJSON_LINE_BYTES);
    expect(ndjsonLineCeiling(undefined)).toBe(LEGACY_MAX_NDJSON_LINE_BYTES);
    expect(LEGACY_MAX_NDJSON_LINE_BYTES).toBe(16 * MAX_NDJSON_LINE_BYTES);
  });

  test("an over-ceiling line fails alone, and its neighbours still arrive", async () => {
    const long = JSON.stringify({ id: "big", note: "x".repeat(300) });
    const text = `{"id":"a"}\n${long}\n{"id":"c"}\n`;
    const result = await drain(streamOf(text, 16), 100);
    expect(result.rows.map((r) => r.id)).toEqual(["a", "c"]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.line).toBe(2);
    expect(result.failures[0]!.reason).toContain("100 byte ceiling");
  });

  test("an over-ceiling final line with no trailing newline still reports", async () => {
    const result = await drain(streamOf(`{"id":"a"}\n${"x".repeat(400)}`, 16), 100);
    expect(result.rows.map((r) => r.id)).toEqual(["a"]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.line).toBe(2);
  });
});

describe("line ceilings against the legacy fixture", () => {
  const legacyEntry = "database/characters.ndjson";

  test("a line past 4 MiB passes under the legacy ceiling", async () => {
    const source = zipEntrySource(buildLegacyNoFormatVersionLvbak());
    const result = await drain(await source.open(legacyEntry), LEGACY_MAX_NDJSON_LINE_BYTES);
    expect(result.failures).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0]!.description as string).length).toBeGreaterThan(MAX_NDJSON_LINE_BYTES);
  });

  test("the same line fails once the archive promises v1 lines", async () => {
    const bytes = assembleLvbak({
      manifest: lvbakManifest(),
      tables: {
        characters: [
          characterRow({ id: "lv-char-small-1" }),
          characterRow({ id: "lv-char-huge", description: "x".repeat(5 * 1024 * 1024) }),
          characterRow({ id: "lv-char-small-2" }),
        ],
      },
      stats: null,
    });
    const source = zipEntrySource(bytes);
    const result = await drain(await source.open(legacyEntry), MAX_NDJSON_LINE_BYTES);
    // the oversized row is the only casualty
    expect(result.rows.map((r) => r.id)).toEqual(["lv-char-small-1", "lv-char-small-2"]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.line).toBe(2);
  });
});
