/**
 * Character rpgStats normalize: Marinara RPGStatsConfig only (no pools).
 */
import { test, expect } from "bun:test";
import { normalizeCharacterRpgStats } from "./index";

test("normalize strips pools and foreign keys", () => {
  const out = normalizeCharacterRpgStats({
    enabled: true,
    attributes: [{ name: "STR", value: 12 }],
    hp: { value: 8, max: 20 },
    pools: [{ name: "Mana", value: 5, max: 10, color: "#00f" }],
    junk: true,
  });
  expect(out).toEqual({
    enabled: true,
    attributes: [{ name: "STR", value: 12 }],
    hp: { value: 8, max: 20 },
  });
  expect("pools" in out).toBe(false);
});

test("normalize defaults empty object to safe shape", () => {
  const out = normalizeCharacterRpgStats({});
  expect(out.enabled).toBe(false);
  expect(out.attributes).toEqual([]);
  expect(out.hp).toEqual({ value: 100, max: 100 });
});
