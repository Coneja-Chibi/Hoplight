import { describe, expect, test } from "bun:test";
import { packHealth } from "./pack-health";

describe("packHealth", () => {
  test("empty tip", () => {
    const n = packHealth({ items: [] });
    expect(n.some((x) => /Empty/.test(x.text))).toBe(true);
  });

  test("ok when neutral present", () => {
    const n = packHealth({
      items: [
        { id: "1", label: "neutral", ref: "n" },
        { id: "2", label: "happy", ref: "h" },
      ],
    });
    expect(n.some((x) => x.kind === "ok")).toBe(true);
  });
});
