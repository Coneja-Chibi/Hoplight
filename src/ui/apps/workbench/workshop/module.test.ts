/**
 * Workshop module readers: pure open + lua overlay.
 */
import { test, expect } from "bun:test";
import { moduleLuaCode, readWorkshopModule, withModuleLuaCode } from "./module";

test("readWorkshopModule returns null on empty original", () => {
  expect(readWorkshopModule(null)).toBeNull();
  expect(readWorkshopModule({})).toBeNull();
});

test("readWorkshopModule reads adapter open shape", () => {
  const original = {
    risu: {
      unmapped: {
        module: {
          name: "Test Module",
          regexCount: 2,
          lorebookCount: 3,
          triggerCount: 1,
          module: {
            name: "Test Module",
            trigger: [
              {
                type: "start",
                conditions: [],
                effect: [{ type: "triggerlua", code: "return 1" }],
              },
            ],
            regex: [{}, {}],
            lorebook: [{}, {}, {}],
            extras: {},
          },
          scripts: [{ kind: "triggerlua", triggerIndex: 0, effectIndex: 0, codeLength: 8 }],
        },
      },
    },
  };
  const view = readWorkshopModule(original);
  expect(view?.name).toBe("Test Module");
  expect(view?.regexCount).toBe(2);
  expect(moduleLuaCode(view)).toBe("return 1");
  const next = withModuleLuaCode(view!, "return 2");
  expect(moduleLuaCode(next)).toBe("return 2");
});
