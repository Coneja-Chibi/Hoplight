/**
 * Module Lua runner: sealed room + host shims against real package source when present.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { decodeRisum, listScriptEffects } from "../../formats/risu/rpack";
import { seedRisuState } from "./risu-api";
import { runModuleLua } from "./run-module-lua";

const KWU = "<downloads>/한국여자대학교 V1.0.charx";

describe("runModuleLua", () => {
  test("tiny script can set vars through host API", async () => {
    const state = seedRisuState([{ name: "hp", value: "1" }]);
    const { result, state: after } = await runModuleLua(
      `setChatVar("t", "hp", "99")
       log("ok")
       return getChatVar("t", "hp")`,
      state,
      { useWorker: false },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("99");
    expect(after.chatVars.hp).toBe("99");
    expect(after.log).toEqual(["ok"]);
  });

  test.skipIf(!existsSync(KWU))("KWU module loads and defines KWU table", async () => {
    const m = unzipSync(new Uint8Array(readFileSync(KWU)))["module.risum"]!;
    const code = listScriptEffects(decodeRisum(m).module).find((s) => s.kind === "triggerlua")?.code ?? "";
    expect(code.length).toBeGreaterThan(10_000);
    const state = seedRisuState([{ name: "v_campus_id", value: "kmu" }]);
    const { result } = await runModuleLua(code, state, {
      timeoutMs: 60_000,
      memoryMaxBytes: 256 * 1024 * 1024,
      useWorker: false, // main-thread path; worker path covered by run-in-worker tests
      tail: "return type(KWU) == 'table' and type(getCampusId) == 'function'",
    });
    // Prefer full success; if the module still hits a missing host edge, surface the error (not silent).
    if (!result.ok) {
      console.log("KWU load error (host surface may still grow):", result.message.slice(0, 200));
    }
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(true);
  });
});
