import { describe, expect, test } from "bun:test";
import { resolveAccess } from "./access";

describe("resolveAccess", () => {
  test("the known read tools resolve to read", () => {
    expect(resolveAccess("list")).toBe("read");
    expect(resolveAccess("read")).toBe("read");
    expect(resolveAccess("search")).toBe("read");
  });

  test("an absent tool resolves to unknown (deny by absence)", () => {
    expect(resolveAccess("delete")).toBe("unknown");
    expect(resolveAccess("write")).toBe("unknown");
    expect(resolveAccess("")).toBe("unknown");
  });

  test("a prototype-chain key never surfaces a phantom access", () => {
    expect(resolveAccess("__proto__")).toBe("unknown");
    expect(resolveAccess("toString")).toBe("unknown");
    expect(resolveAccess("hasOwnProperty")).toBe("unknown");
  });

  test("a non-string name resolves to unknown", () => {
    expect(resolveAccess(undefined as unknown as string)).toBe("unknown");
    expect(resolveAccess(123 as unknown as string)).toBe("unknown");
  });
});
