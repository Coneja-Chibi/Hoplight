/**
 * CSS import summary against the workshop parser.
 */
import { test, expect } from "bun:test";
import { looksLikeCssFile, summarizeImport } from "./import-css";

test("summarizeImport counts rules and freeform", () => {
  const css = `.a { color: red; }\n\n@media (max-width: 600px) {\n  .a { color: blue; }\n}`;
  const s = summarizeImport(css);
  expect(s.rules).toBe(1);
  expect(s.freeform).toBe(true);
  expect(s.bytes).toBeGreaterThan(0);
});

test("summarizeImport empty", () => {
  const s = summarizeImport("");
  expect(s.rules).toBe(0);
  expect(s.freeform).toBe(false);
});

test("looksLikeCssFile", () => {
  expect(looksLikeCssFile("theme.css")).toBe(true);
  expect(looksLikeCssFile("notes.txt")).toBe(true);
  expect(looksLikeCssFile("x.scss")).toBe(true);
  expect(looksLikeCssFile("photo.png")).toBe(false);
});
