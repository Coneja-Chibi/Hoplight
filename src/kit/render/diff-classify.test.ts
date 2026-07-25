/** Proves fenced unified diffs are recognized without mistaking ordinary code for patches. */
import { describe, expect, test } from "bun:test";
import { classifyDiff } from "./diff-classify";

describe("classifyDiff", () => {
  test("classifies a unified diff and counts changed lines", () => {
    const result = classifyDiff([
      "--- a/old.ts",
      "+++ b/new.ts",
      "@@ -1,2 +1,2 @@",
      "-const oldName = true;",
      "+const newName = true;",
      " unchanged();",
    ]);

    expect(result).toEqual({
      additions: 1,
      removals: 1,
      lines: [
        { kind: "meta", text: "--- a/old.ts" },
        { kind: "meta", text: "+++ b/new.ts" },
        { kind: "meta", text: "@@ -1,2 +1,2 @@" },
        { kind: "remove", text: "-const oldName = true;" },
        { kind: "add", text: "+const newName = true;" },
        { kind: "context", text: " unchanged();" },
      ],
    });
  });

  test("accepts an explicit diff fence without headers", () => {
    expect(classifyDiff(["-before", "+after"], "diff")).toMatchObject({
      additions: 1,
      removals: 1,
    });
  });

  test("does not treat ordinary plus and minus code as a diff", () => {
    expect(classifyDiff(["const delta = left - right;", "total += delta;"], "ts")).toBeNull();
  });
});
