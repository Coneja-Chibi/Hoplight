/**
 * Capture each engine's real macro vocabulary into a committed fixture.
 *
 * DEV ONLY, AND IT MUST NEVER BECOME A GATE. This needs the upstream checkouts, which exist on a
 * maintainer's machine and never in CI. The gate is `parity.test.ts`, which reads only the committed
 * fixtures and therefore runs everywhere. Keeping those apart is the whole point: an oracle that
 * quietly skips when its source is missing reports success while proving nothing, which is worse
 * than no oracle at all. So this command FAILS when a checkout is absent and never writes a partial
 * or empty capture.
 *
 * Usage:
 *   VAUD_RC_MACRO_SRC=... VAUD_LUMI_MACRO_SRC=... VAUD_MARINARA_MACRO_SRC=... bun run macros:oracle
 *   bun run macros:oracle -- lumiverse      # one engine
 *
 * Nothing here evaluates a macro. It runs each engine's own registration code to read its
 * vocabulary, which is data collection, not the evaluator ADR-012 governs.
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { discoverOracleEngines, FIXTURE_DIR } from "./discover";
import { normalizeFacts, type EngineFixture } from "./types";

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
const capturedAt = new Date().toISOString().slice(0, 10);

const engines = (await discoverOracleEngines())
  .filter((engine) => requested.length === 0 || requested.includes(engine.id));

if (engines.length === 0) {
  console.error(`macro-oracle: no extractor matched ${requested.join(", ") || "(all)"}`);
  process.exit(1);
}

await mkdir(FIXTURE_DIR, { recursive: true });

const failures: string[] = [];
for (const engine of engines) {
  const root = process.env[engine.sourceEnvVar];
  if (!root) {
    failures.push(`${engine.id}: set ${engine.sourceEnvVar} to its checkout root`);
    continue;
  }
  try {
    const facts = normalizeFacts(await engine.extract(root));
    const fixture: EngineFixture = {
      engine: engine.id,
      provenance: engine.provenance,
      sourceEnvVar: engine.sourceEnvVar,
      capturedAt,
      macroCount: facts.length,
      aliasCount: facts.reduce((sum, fact) => sum + fact.aliases.length, 0),
      macros: facts,
    };
    const path = join(FIXTURE_DIR, `${engine.id}.json`);
    await Bun.write(path, `${JSON.stringify(fixture, null, 2)}\n`);
    console.log(
      `macro-oracle: ${engine.id} captured ${fixture.macroCount} macros, ${fixture.aliasCount} aliases`,
    );
  } catch (error) {
    failures.push(`${engine.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  console.error("\nmacro-oracle: capture incomplete, nothing was guessed:");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log("macro-oracle: all requested engines captured");
