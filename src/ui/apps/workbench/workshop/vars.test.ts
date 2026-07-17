/**
 * Variable parse / seed.
 */
import { test, expect } from "bun:test";
import { formatVarLines, parseVarLines, seedVars } from "./vars";

test("parse and format round-trip lines", () => {
  const rows = parseVarLines("hp=100\nstatus=ok\n");
  expect(rows).toEqual([
    { name: "hp", value: "100" },
    { name: "status", value: "ok" },
  ]);
  expect(formatVarLines(rows)).toBe("hp=100\nstatus=ok");
});

test("seedVars unions trigger names with file defaults", () => {
  const rows = seedVars(
    [
      {
        event: "output",
        conditions: [{ type: "var", var: "mood", operator: "=", value: "warm" }],
        effects: [{ type: "setvar", var: "affection", operator: "+=", value: "1" }],
      },
    ],
    "mood=neutral",
  );
  expect(rows.find((r) => r.name === "mood")?.value).toBe("neutral");
  expect(rows.find((r) => r.name === "affection")?.value).toBe("");
});
