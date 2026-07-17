/**
 * Compile-check decoded triggerlua: use a temporary engine that keeps load() so we can
 * syntax-check without executing card host calls. Not the product sandbox path.
 * Run: bun scripts/rpack-wasmoon-check.ts [path.charx]
 */
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { LuaFactory, LuaLibraries } from "wasmoon";
import { decodeRisum, listScriptEffects } from "../src/formats/risu/rpack";

const path = process.argv[2] ?? "C:/Users/chiev/Downloads/한국여자대학교 V1.0.charx";
const m = unzipSync(new Uint8Array(readFileSync(path)))["module.risum"]!;
const d = decodeRisum(m);
const code = listScriptEffects(d.module).find((s) => s.kind === "triggerlua")?.code ?? "";
console.log("name", d.module.name);
console.log("chars", code.length);
console.log({
  MAX: code.includes("MAX_LLM_RETRIES"),
  INJECT: code.includes("INJECT_MARKER"),
  TRIGGER_ID: code.includes("ACTIVE_TRIGGER_ID"),
  FFFD: (code.match(/\uFFFD/g) ?? []).length,
});

const factory = new LuaFactory();
const engine = await factory.createEngine({
  openStandardLibs: false,
  injectObjects: false,
  functionTimeout: 120_000,
});
for (const lib of [
  LuaLibraries.Base,
  LuaLibraries.Table,
  LuaLibraries.String,
  LuaLibraries.Math,
  LuaLibraries.Coroutine,
  LuaLibraries.UTF8,
]) {
  engine.global.loadLibrary(lib);
}
// keep load() for compile-only check; still strip file loaders
engine.doStringSync("_G.loadfile = nil; _G.dofile = nil");

try {
  engine.global.set("__src", code);
  const result = (await engine.doString(
    `local f, err = load(__src, "module", "t")
     if not f then return err end
     return "SYNTAX_OK"`,
  )) as unknown;
  console.log("result", result);
  if (result === "SYNTAX_OK") {
    console.log("PASS: full triggerlua compiles");
    process.exitCode = 0;
  } else {
    console.log("FAIL:", result);
    process.exitCode = 1;
  }
} catch (e) {
  console.log("FAIL throw", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  engine.global.close();
}
