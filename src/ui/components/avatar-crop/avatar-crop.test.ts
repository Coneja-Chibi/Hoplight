/**
 * Pure crop geometry: display px <-> normalized wire, square corner resize.
 */
import { test, expect } from "bun:test";
import { clamp, cropPxToValue, valueToCropPx, resizeCorner, cropPreviewStyle } from "./index";

test("clamp", () => {
  expect(clamp(5, 0, 10)).toBe(5);
  expect(clamp(-1, 0, 10)).toBe(0);
  expect(clamp(99, 0, 10)).toBe(10);
});

test("cropPxToValue / valueToCropPx round-trip on square canvas", () => {
  const w = 200;
  const h = 200;
  const px = { x: 50, y: 40, size: 80 };
  const v = cropPxToValue(px, w, h);
  expect(v.srcX).toBeCloseTo(0.25);
  expect(v.srcY).toBeCloseTo(0.2);
  expect(v.srcWidth).toBeCloseTo(0.4);
  expect(v.srcHeight).toBeCloseTo(0.4);
  const back = valueToCropPx(v, w, h);
  expect(back.x).toBeCloseTo(50);
  expect(back.y).toBeCloseTo(40);
  expect(back.size).toBeCloseTo(80);
});

test("resizeCorner br grows square; tl keeps opposite anchor", () => {
  const start = { x: 20, y: 20, size: 40 };
  const br = resizeCorner("br", start, 20, 20, 200, 200);
  expect(br.x).toBe(20);
  expect(br.y).toBe(20);
  expect(br.size).toBe(60);

  const tl = resizeCorner("tl", start, -10, -10, 200, 200);
  expect(tl.x + tl.size).toBeCloseTo(60);
  expect(tl.y + tl.size).toBeCloseTo(60);
});

test("cropPreviewStyle sizes img so crop fills the preview box", () => {
  const s = cropPreviewStyle({ srcX: 0.25, srcY: 0.25, srcWidth: 0.5, srcHeight: 0.5 });
  expect(s.width).toBe("200%");
  expect(s.height).toBe("200%");
  expect(s.left).toBe("-50%");
  expect(s.top).toBe("-50%");
});
