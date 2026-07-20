/**
 * Build the public core import graph for Node and execute it with the installed Node runtime.
 * Artifacts live in a unique OS temp directory and are removed in all outcomes.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const outdir = await mkdtemp(join(tmpdir(), "vaude-node-core-"));
try {
  const build = await Bun.build({
    entrypoints: [resolve("scripts/node-core-entry.ts")],
    outdir,
    target: "node",
    format: "esm",
  });
  if (!build.success || build.outputs.length !== 1) {
    for (const log of build.logs) console.error(log);
    throw new Error("node-core: build failed");
  }
  const run = Bun.spawnSync(["node", build.outputs[0]!.path], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if (run.exitCode !== 0) throw new Error(`node-core: Node exited ${run.exitCode}`);
  console.log("node-core: compatible");
} finally {
  await rm(outdir, { recursive: true, force: true });
}
