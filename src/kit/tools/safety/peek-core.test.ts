import { describe, expect, test } from "bun:test";
import { summarizePeek } from "./peek-core";
import type { RiskVerdict } from "./risk";

const V: RiskVerdict = { level: "danger", access: "delete", reason: "removes a piece" };

describe("summarizePeek", () => {
  test("extracts kind/id into the title", () => {
    expect(summarizePeek("delete", { kind: "lorebook", id: "old-notes" }, V).title).toBe(
      "delete lorebook/old-notes",
    );
  });

  test("falls back through id, path, then name for the target", () => {
    expect(summarizePeek("read", { id: "abc" }, V).title).toBe("read abc");
    expect(summarizePeek("open", { path: "/x/y" }, V).title).toBe("open /x/y");
    expect(summarizePeek("save", { name: "Alice" }, V).title).toBe("save Alice");
  });

  test("redacts secret-looking keys and never surfaces the value", () => {
    const p = summarizePeek("call", { apiKey: "sk-123", token: "t", password: "p" }, V);
    expect(p.detail).not.toContain("sk-123");
    expect(p.detail).toContain("***");
  });

  test("empty or missing args yields a 'no arguments' detail", () => {
    expect(summarizePeek("ping", {}, V).detail).toBe("no arguments");
    expect(summarizePeek("ping", undefined, V).detail).toBe("no arguments");
  });

  test("a non-object args value is labeled, never thrown", () => {
    expect(() => summarizePeek("x", 42, V)).not.toThrow();
    expect(summarizePeek("x", "hello", V).detail).toBe("(unrecognized args)");
  });

  test("a huge value is truncated with a marker (bomb protection)", () => {
    const p = summarizePeek("write", { blob: "z".repeat(10_000) }, V);
    expect(p.detail.length).toBeLessThanOrEqual(160);
    expect(p.detail).toContain("...");
  });

  test("overflow fields collapse to a +N marker", () => {
    const p = summarizePeek("write", { a: 1, b: 2, c: 3, d: 4, e: 5 }, V);
    expect(p.detail).toContain("+2 fields");
  });

  test("the verdict supplies the level and reason", () => {
    const p = summarizePeek("read", { id: "x" }, V);
    expect(p.level).toBe("danger");
    expect(p.reason).toBe("removes a piece");
  });
});
