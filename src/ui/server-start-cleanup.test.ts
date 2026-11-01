/** A failed primary bind releases the optional listener already created for this boot. */
import { expect, test, spyOn } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startUi } from "./server";
import type { PackagedAssets } from "./assets";
test("failed primary startup releases its private listener", async () => {
  const dir = await mkdtemp(join(tmpdir(), "primary-bind-cleanup-"));
  const original = Bun.serve, owned: { port: number | undefined; stop: (close?: boolean) => void }[] = [];
  const serve = spyOn(Bun, "serve").mockImplementation((opts) => {
    if (owned.length) throw new Error("fixture primary bind refusal");
    const server = original(opts); owned.push(server); return server;
  });
  try {
    expect(() => startUi(41239, dir, {} as PackagedAssets)).toThrow("fixture primary bind refusal");
    expect(owned).toHaveLength(1);
    expect(await fetch("http://127.0.0.1:" + owned[0]!.port).then(() => false, () => true)).toBe(true);
  } finally { serve.mockRestore(); for (const server of owned) await server.stop(true); await rm(dir, { recursive: true, force: true }); }
});
