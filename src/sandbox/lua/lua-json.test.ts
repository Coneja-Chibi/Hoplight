/**
 * Proves the whitelisted json codec that replaces the stripped require: cards can require('json') and use
 * a bare json global, arrays and string-keyed maps round-trip through encode/decode, and require refuses
 * every module name but "json" (deny-by-absence, no package-loader reach). Driven through runLua so the
 * globals are exercised exactly as a real card would call them inside the hardened engine.
 */
import { describe, expect, test } from "bun:test";
import { runLua } from "./run";
import { jsonGlobals } from "./lua-json";

const withJson = { capabilities: jsonGlobals() };

describe("lua-json: whitelisted require 'json' codec", () => {
  test("require('json').encode serializes an array to JSON text", async () => {
    const result = await runLua("local j = require('json'); return j.encode({10, 20})", withJson);
    expect(result).toEqual({ ok: true, value: "[10,20]" });
  });

  test("the bare json global also exposes encode", async () => {
    const result = await runLua("return json.encode({1, 2, 3})", withJson);
    expect(result).toEqual({ ok: true, value: "[1,2,3]" });
  });

  test("encode of a string-keyed table produces a JSON object", async () => {
    const result = await runLua('return json.encode({name = "Ada", age = 36})', withJson);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(JSON.parse(result.value as string)).toEqual({ name: "Ada", age: 36 });
  });

  test("decode round-trips an array back into Lua values", async () => {
    const result = await runLua(
      "local j = require('json'); local t = j.decode('[10,20,30]'); return t[1] + t[2] + t[3]",
      withJson,
    );
    expect(result).toEqual({ ok: true, value: 60 });
  });

  test("decode round-trips a map back into Lua values", async () => {
    const result = await runLua(
      "local t = json.decode('{\"name\":\"Ada\",\"age\":36}'); return t.name .. ':' .. t.age",
      withJson,
    );
    expect(result).toEqual({ ok: true, value: "Ada:36" });
  });

  test("encode then decode is a full round-trip", async () => {
    const result = await runLua(
      "local j = require('json'); local s = j.encode({7, 8, 9}); local t = j.decode(s); return t[2]",
      withJson,
    );
    expect(result).toEqual({ ok: true, value: 8 });
  });

  test("nested tables round-trip through encode then decode", async () => {
    const result = await runLua(
      "local j = require('json'); local s = j.encode({items = {1, 2, 3}}); " +
        "local t = j.decode(s); return t.items[1] + t.items[3]",
      withJson,
    );
    expect(result).toEqual({ ok: true, value: 4 });
  });

  test("require of any other module errors", async () => {
    const result = await runLua("return require('os')", withJson);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toBe("error");
    expect(result.message).toContain("is not available");
  });

  test("decode of invalid JSON surfaces as a card error, not a host crash", async () => {
    const result = await runLua("return json.decode('{not json}')", withJson);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toBe("error");
  });
});
