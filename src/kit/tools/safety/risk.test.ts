import { describe, expect, test } from "bun:test";
import { classifyRisk, type ToolAccess } from "./risk";

describe("classifyRisk", () => {
  test("read is safe", () => {
    const v = classifyRisk("read", undefined, "read");
    expect(v.level).toBe("safe");
    expect(v.access).toBe("read");
  });

  test("write is caution", () => {
    expect(classifyRisk("write").level).toBe("caution");
  });

  test("delete, egress, exec, and unknown are all danger", () => {
    for (const access of ["delete", "egress", "exec", "unknown"] as ToolAccess[]) {
      expect(classifyRisk(access).level).toBe("danger");
    }
  });

  test("the unknown reason names the offending tool", () => {
    expect(classifyRisk("unknown", undefined, "wipe").reason).toContain("wipe");
  });

  test("args never lower a level: a read with hostile args stays safe", () => {
    const v = classifyRisk("read", { cmd: "rm -rf", token: "abc" }, "read");
    expect(v.level).toBe("safe");
  });

  test("an out-of-range access fails toward danger and never throws", () => {
    const call = () => classifyRisk("bogus" as ToolAccess);
    expect(call).not.toThrow();
    const v = call();
    expect(v.level).toBe("danger");
    expect(v.access).toBe("unknown");
  });
});
