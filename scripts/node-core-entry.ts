/**
 * Runtime smoke entry for the public core graph. The harness bundles this for Node, then executes
 * it with Node so a Bun-only import in core fails at the compatibility gate.
 */
import assert from "node:assert/strict";
import * as core from "../src/core";

assert.equal(core.CANONICAL_SCHEMA_VERSION, "1");
assert.equal(typeof core.loadFormats, "function");
assert.equal(typeof core.registry.detect, "function");

/**
 * A 411 byte forced-ZIP64 archive built by the fixture writer: manifest.json (deflate) and a.bin
 * (stored). Inlined rather than imported so this stays a measurement of the core graph alone.
 * Exercising the streaming reader here is the point: without a real call the bundler drops it and
 * the gate would never load it under Node.
 */
const ZIP64_SAMPLE =
  "UEsDBC0AAAgIAAAAIVy3zrxQ//////////8NABQAbWFuaWZlc3QuanNvbgEAEAAYAAAAAAAAABoA" +
  "AAAAAAAAq1YqKMpPKU1OLVKyUsopzc0sSy0qTlWqBQBQSwMELQAACAAAAAAhXB2AvFX/////////" +
  "/wUAFABhLmJpbgEAEAADAAAAAAAAAAMAAAAAAAAAAQIDUEsBAi0ALQAACAgAAAAhXLfOvFD/////" +
  "/////w0AHAAAAAAAAAAAAAAA/////21hbmlmZXN0Lmpzb24BABgAGAAAAAAAAAAaAAAAAAAAAAAA" +
  "AAAAAAAAUEsBAi0ALQAACAAAAAAhXB2AvFX//////////wUAHAAAAAAAAAAAAAAA/////2EuYmlu" +
  "AQAYAAMAAAAAAAAAAwAAAAAAAABZAAAAAAAAAFBLBgYsAAAAAAAAAC0ALQAAAAAAAAAAAAIAAAAA" +
  "AAAAAgAAAAAAAACmAAAAAAAAAJMAAAAAAAAAUEsGBwAAAAA5AQAAAAAAAAEAAABQSwUG////////" +
  "/////////////wAA";

async function streamingCoreSmoke(): Promise<void> {
  const bytes = Uint8Array.from(Buffer.from(ZIP64_SAMPLE, "base64"));
  const source = core.bytesSource(bytes);
  const entries = await core.listZipEntriesBounded(source, core.CARD_ARCHIVE_BOUNDS);
  assert.deepEqual(
    entries.map((e) => e.name),
    ["manifest.json", "a.bin"],
  );

  const reader = (
    await core.openZipEntryStream(source, entries[0]!, { bounds: core.CARD_ARCHIVE_BOUNDS })
  ).getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    chunks.push(step.value);
  }
  assert.equal(Buffer.concat(chunks).toString("utf8"), '{"producer":"lumiverse"}');
}

// No top-level await: the bundle is executed as a plain script, so the entry drives its own async.
streamingCoreSmoke().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
