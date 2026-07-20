/** Regression coverage for the paint.test behavior owned beside this file. */
import { expect, test } from "bun:test";
import { gradientPaint, normalizePaint, paintToCss, solidPaint } from "./paint";

test("solid renders as its hex", () => {
  expect(paintToCss(solidPaint("#e11d48"))).toBe("#e11d48");
});

test("linear gradient renders angle + stops", () => {
  expect(paintToCss(gradientPaint("#000000", "#ffffff"))).toBe("linear-gradient(135deg, #000000 0%, #ffffff 100%)");
});

test("radial gradient renders as radial-gradient(circle, ...)", () => {
  const p = normalizePaint({ kind: "gradient", type: "radial", angle: 0, stops: [{ color: "#111111", at: 0 }, { color: "#222222", at: 1 }] });
  expect(paintToCss(p!)).toBe("radial-gradient(circle, #111111 0%, #222222 100%)");
});

test("paintToCss sorts stops by position regardless of input order", () => {
  const p = normalizePaint({ kind: "gradient", type: "linear", angle: 90, stops: [{ color: "#ff0000", at: 1 }, { color: "#00ff00", at: 0 }] });
  expect(paintToCss(p!)).toBe("linear-gradient(90deg, #00ff00 0%, #ff0000 100%)");
});

test("normalizePaint accepts a good solid and normalizes the hex", () => {
  expect(normalizePaint({ kind: "solid", color: "#ABC" })).toEqual({ kind: "solid", color: "#aabbcc" });
});

test("normalizePaint rejects garbage and non-paint shapes", () => {
  expect(normalizePaint(null)).toBeNull();
  expect(normalizePaint("blue")).toBeNull();
  expect(normalizePaint({ kind: "solid", color: "not-a-hex" })).toBeNull();
  expect(normalizePaint({ kind: "gradient", type: "spiral", angle: 0, stops: [] })).toBeNull();
});

test("normalizePaint drops bad stops and fails a gradient under two", () => {
  const one = normalizePaint({ kind: "gradient", type: "linear", angle: 0, stops: [{ color: "#fff", at: 0 }, { color: "nope", at: 1 }] });
  expect(one).toBeNull(); // only one valid stop survives -> not a gradient
});

test("normalizePaint clamps positions, wraps angle, sorts stops", () => {
  const p = normalizePaint({ kind: "gradient", type: "linear", angle: 450, stops: [{ color: "#fff", at: 2 }, { color: "#000", at: -1 }] });
  expect(p).toEqual({ kind: "gradient", type: "linear", angle: 90, stops: [{ color: "#000000", at: 0 }, { color: "#ffffff", at: 1 }] });
});
