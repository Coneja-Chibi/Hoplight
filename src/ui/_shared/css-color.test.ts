/** resolveCssColor - the DOM-independent branches (pass-through contract). */
import { describe, expect, it } from "bun:test";
import { resolveCssColor } from "./css-color";

describe("resolveCssColor", () => {
  it("passes plain hex through untouched", () => {
    expect(resolveCssColor("#e11d48")).toBe("#e11d48");
  });

  it("passes non-color text through untouched", () => {
    expect(resolveCssColor("rose")).toBe("rose");
  });

  it("passes a malformed var() reference through untouched", () => {
    expect(resolveCssColor("var(--rose")).toBe("var(--rose");
    expect(resolveCssColor("var(rose)")).toBe("var(rose)");
  });

  it("passes a var() with a fallback through untouched (not a bare reference)", () => {
    expect(resolveCssColor("var(--rose, #fff)")).toBe("var(--rose, #fff)");
  });
});
