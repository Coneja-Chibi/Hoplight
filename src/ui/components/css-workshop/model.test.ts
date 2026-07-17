/**
 * CssWorkshop model: emit/parse round-trip and knob helpers.
 */
import { test, expect } from "bun:test";
import {
  appendRule,
  emitCss,
  emptyDoc,
  getProp,
  makeRule,
  mergeCss,
  parseCss,
  removeRule,
  replaceRule,
  resetCssIds,
  setProp,
  summarizeRule,
} from "./model";

test("emit empty is empty", () => {
  expect(emitCss(emptyDoc())).toBe("");
});

test("emit simple rule", () => {
  resetCssIds();
  const doc = {
    rules: [makeRule(".card", [{ property: "color", value: "#fff" }])],
    freeform: "",
  };
  expect(emitCss(doc)).toBe(".card {\n  color: #fff;\n}");
});

test("parse simple rule and round-trip props", () => {
  resetCssIds();
  const src = `.card {\n  color: #abc;\n  padding: 8px !important;\n}`;
  const doc = parseCss(src);
  expect(doc.rules.length).toBe(1);
  expect(doc.rules[0]!.selector).toBe(".card");
  expect(getProp(doc.rules[0]!, "color")?.value).toBe("#abc");
  expect(getProp(doc.rules[0]!, "padding")?.important).toBe(true);
  const again = parseCss(emitCss(doc));
  expect(getProp(again.rules[0]!, "color")?.value).toBe("#abc");
  expect(getProp(again.rules[0]!, "padding")?.value).toBe("8px");
});

test("parse keeps @media in freeform", () => {
  const src = `.a { color: red; }\n\n@media (max-width: 600px) {\n  .a { color: blue; }\n}`;
  const doc = parseCss(src);
  expect(doc.rules.length).toBe(1);
  expect(doc.freeform).toContain("@media");
  expect(emitCss(doc)).toContain("@media");
});

test("setProp clears empty and replaces", () => {
  resetCssIds();
  let r = makeRule(".x", [{ property: "color", value: "red" }]);
  r = setProp(r, "color", "blue");
  expect(getProp(r, "color")?.value).toBe("blue");
  r = setProp(r, "color", "");
  expect(getProp(r, "color")).toBeUndefined();
});

test("append replace remove", () => {
  resetCssIds();
  let doc = emptyDoc();
  const a = makeRule(".a", [{ property: "opacity", value: "0.5" }]);
  doc = appendRule(doc, a);
  expect(doc.rules.length).toBe(1);
  doc = replaceRule(doc, setProp(a, "opacity", "1"));
  expect(getProp(doc.rules[0]!, "opacity")?.value).toBe("1");
  doc = removeRule(doc, a.id);
  expect(doc.rules.length).toBe(0);
});

test("mergeCss appends with marker", () => {
  const m = mergeCss(".a { color: red; }", ".b { color: blue; }");
  expect(m).toContain(".a");
  expect(m).toContain("starter");
  expect(m).toContain(".b");
});

test("summarizeRule truncates long values", () => {
  resetCssIds();
  const r = makeRule(".z", [
    {
      property: "background",
      value: "linear-gradient(90deg, #000000 0%, #ffffff 100%) and then more text here",
    },
  ]);
  expect(summarizeRule(r)).toContain("...");
});

test("parse never throws on garbage", () => {
  expect(() => parseCss("{{{")).not.toThrow();
  expect(() => parseCss("")).not.toThrow();
  const d = parseCss("not css at all");
  expect(d.rules.length + (d.freeform ? 1 : 0)).toBeGreaterThan(0);
});
