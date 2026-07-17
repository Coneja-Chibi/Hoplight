/**
 * ExpressionMap normalize: mappings record round-trip via rows.
 */
import { test, expect } from "bun:test";
import { mappingsToRows, rowsToMappings, normalizeExpressionMap } from "./index";

test("rowsToMappings drops empty labels", () => {
  expect(
    rowsToMappings([
      { label: "neutral", imageId: "img1" },
      { label: "  ", imageId: "x" },
      { label: "angry", imageId: "img2" },
    ]),
  ).toEqual({ neutral: "img1", angry: "img2" });
});

test("mappingsToRows / rowsToMappings round-trip", () => {
  const m = { smile: "a", frown: "b" };
  expect(rowsToMappings(mappingsToRows(m))).toEqual(m);
});

test("normalizeExpressionMap defaults", () => {
  const n = normalizeExpressionMap({});
  expect(n.enabled).toBe(false);
  expect(n.defaultExpression).toBe("");
  expect(n.mappings).toEqual({});
});
