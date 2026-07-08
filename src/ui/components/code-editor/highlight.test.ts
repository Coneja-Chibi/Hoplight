/**
 * The tokenizer must (1) find CBS macros in any language, (2) classify strings/comments/keywords per
 * language, and (3) round-trip: concatenating token text reproduces the input exactly, so the highlight
 * layer never drops or duplicates a character under the caret. It returns typed tokens, never HTML.
 */
import { describe, expect, test } from "bun:test";
import { tokenize } from "./highlight";

const roundTrips = (code: string, lang: Parameters<typeof tokenize>[1]): boolean =>
  tokenize(code, lang).map((t) => t.text).join("") === code;

describe("code highlighter", () => {
  test("round-trips exactly (no dropped/duplicated chars) across languages", () => {
    const samples = [
      '<div class="x">{{getvar::hp}}</div>',
      'local n = 6 // not lua\nlocal m = {{roll::100}} -- a comment',
      "const s = `hi ${x}` // c\n",
      "body { color: red; } /* c */",
    ] as const;
    for (const s of samples) {
      expect(roundTrips(s, "html")).toBe(true);
      expect(roundTrips(s, "lua")).toBe(true);
      expect(roundTrips(s, "js")).toBe(true);
    }
  });

  test("finds CBS macros in any language", () => {
    const t = tokenize('x = {{getvar::hp}} + {{roll::20}}', "lua");
    const macros = t.filter((x) => x.type === "macro").map((x) => x.text);
    expect(macros).toEqual(["{{getvar::hp}}", "{{roll::20}}"]);
  });

  test("an unterminated macro is still one macro token to end of input", () => {
    const t = tokenize("say {{getvar::", "text");
    expect(t.some((x) => x.type === "macro" && x.text === "{{getvar::")).toBe(true);
  });

  test("classifies lua keywords + comments + strings", () => {
    const t = tokenize('local x = "hi" -- note', "lua");
    expect(t.find((x) => x.text === "local")?.type).toBe("keyword");
    expect(t.find((x) => x.text === '"hi"')?.type).toBe("string");
    expect(t.find((x) => x.text.startsWith("--"))?.type).toBe("comment");
  });

  test("js line vs lua line comments do not cross-fire", () => {
    // in lua, // is not a comment; the tokens after it stay plain/number, not comment
    expect(tokenize("a // b", "lua").some((x) => x.type === "comment")).toBe(false);
    expect(tokenize("a // b", "js").some((x) => x.type === "comment")).toBe(true);
  });

  test("returns typed tokens, never HTML (angle brackets stay literal text)", () => {
    const t = tokenize("<script>alert(1)</script>", "html");
    expect(t.map((x) => x.text).join("")).toBe("<script>alert(1)</script>");
    expect(t.every((x) => typeof x.text === "string")).toBe(true);
  });
});
