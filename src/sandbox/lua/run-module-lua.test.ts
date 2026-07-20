/**
 * Module Lua runner: sealed room + host shims against real package source when present.
 */
import { describe, expect, test } from "bun:test";
import {
  decodeRisum,
  encodeRisum,
  listScriptEffects,
  serializeModuleJson,
  textToModulePlain,
  type RisuModule,
} from "../../formats/risu/rpack";
import { seedRisuState } from "./risu-api";
import { runModuleLua } from "./run-module-lua";

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

  test("a hermetic module package loads and defines its public table", async () => {
    const code = `${"-- inert package padding\n".repeat(600)}\nKWU = { campus = "kmu" }\nfunction getCampusId() return KWU.campus end`;
    const module: RisuModule = {
      name: "Hermetic campus module",
      trigger: [{ effect: [{ type: "triggerlua", code }] }],
      extras: {},
    };
    const modulePlain = textToModulePlain(serializeModuleJson(module));
    const bytes = encodeRisum({ module, modulePlain, assets: [] });
    const extracted = listScriptEffects(decodeRisum(bytes).module).find((script) => script.kind === "triggerlua")?.code ?? "";
    expect(extracted).toBe(code);
    expect(extracted.length).toBeGreaterThan(10_000);
    const state = seedRisuState([{ name: "v_campus_id", value: "kmu" }]);
    const { result } = await runModuleLua(extracted, state, {
      useWorker: false, // main-thread path; worker path covered by run-in-worker tests
      tail: "return type(KWU) == 'table' and type(getCampusId) == 'function'",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(true);
  });
});
