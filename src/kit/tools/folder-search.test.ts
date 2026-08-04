/**
 * folder_search.
 *
 * The whole value is that it cannot be talked into reading somewhere it was not sent, so the tests
 * are the denial paths rather than the happy one. Each case is a way a folder tool leaks: a sibling
 * sharing a prefix, a traversal, and no grants at all.
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import tool from "./folder-search";
import type { ToolContext } from "./tool";
import { grantFolder } from "./_shared/grants";

const ctx = (grants?: ReturnType<typeof grantFolder>[]): ToolContext =>
  ({ bridge: { studioDir: resolve("/studio") }, grants } as unknown as ToolContext);

const run = (args: Record<string, unknown>, c: ToolContext) =>
  tool.execute(tool.input.parse(args), c);

describe("folder_search", () => {
  test("is read-only and never offers a write action", () => {
    expect(tool.effect).toBe("read");
    expect(tool.input.safeParse({ action: "write", path: "/x" }).success).toBe(false);
    expect(tool.input.safeParse({ action: "delete", path: "/x" }).success).toBe(false);
  });

  test("a path outside every shared folder is refused", async () => {
    const out = await run({ action: "list", path: resolve("/elsewhere") }, ctx());
    expect(out.summary).toContain("outside-grants");
  });

  test("a traversal out of a shared folder is refused, because the RESOLVED path is checked", async () => {
    const c = ctx([grantFolder("/shared")]);
    const out = await run({ action: "list", path: resolve("/shared/../secrets") }, c);
    expect(out.summary).toContain("outside-grants");
  });

  test("a sibling sharing a prefix is not inside", async () => {
    const c = ctx([grantFolder("/shared")]);
    const out = await run({ action: "read", path: resolve("/shared-backup/f.json") }, c);
    expect(out.summary).toContain("outside-grants");
  });

  test("with nothing shared it says so rather than reading the studio silently", async () => {
    const out = await run({ action: "list", path: resolve("/anywhere") }, ctx());
    expect(out.summary).toContain("outside-grants");
  });
});
