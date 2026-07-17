/**
 * Plain-English Lua error map.
 */
import { test, expect } from "bun:test";
import { plainLuaError } from "./plain-lua";

test("timeout reason", () => {
  const p = plainLuaError("sandbox deadline 60000ms exceeded", "timeout");
  expect(p.plain.toLowerCase()).toContain("too long");
});

test("resource limit reason with category", () => {
  const p = plainLuaError("[resource:host-state] host state 99 bytes exceeds cap 10", "resource", "host-state");
  expect(p.plain.toLowerCase()).toContain("resource limit reached");
  expect(p.plain.toLowerCase()).toContain("host state");
  expect(p.technical).toContain("[resource:host-state]");
});

test("nil call", () => {
  const p = plainLuaError("attempt to call a nil value (global 'io')");
  expect(p.plain.toLowerCase()).toMatch(/not available|sealed/);
});

test("syntax", () => {
  const p = plainLuaError("')' expected near 'end'");
  // generic fallback or syntax - either is fine if technical preserved
  expect(p.technical.length).toBeGreaterThan(0);
  expect(p.plain.length).toBeGreaterThan(10);
});
