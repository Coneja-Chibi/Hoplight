/**
 * Rail part builder + default door.
 */
import { test, expect } from "bun:test";
import { buildRailParts, defaultPart } from "./part";

test("defaultPart opens starters when empty", () => {
  expect(defaultPart(0)).toBe("recipes");
  expect(defaultPart(2)).toBe("triggers");
});

test("buildRailParts omits package without mod", () => {
  const parts = buildRailParts({
    triggerCount: 1,
    varCount: 2,
    regexCount: 0,
    mod: null,
  });
  expect(parts.some((p) => p.id.startsWith("mod"))).toBe(false);
  expect(parts[0]?.id).toBe("recipes");
  expect(parts.some((p) => p.id === "graph")).toBe(true);
});

test("buildRailParts adds package scripts when mod present", () => {
  const parts = buildRailParts({
    triggerCount: 0,
    varCount: 0,
    regexCount: 0,
    mod: {
      regexCount: 3,
      lorebookCount: 4,
      triggerCount: 1,
      module: { name: "test", extras: {} },
      scripts: [],
    },
  });
  expect(parts.find((p) => p.id === "modlua")?.label).toBe("Package scripts");
  expect(parts.find((p) => p.id === "modregex")?.count).toBe(3);
});
