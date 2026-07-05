import { expect, test } from "bun:test";
import { clamp01, hexToHsv, hsvToHex, normalizeHex } from "./color-picker";

test("normalizeHex expands 3-digit shorthand and lowercases", () => {
  expect(normalizeHex("#ABC")).toBe("#aabbcc");
  expect(normalizeHex("E11D48")).toBe("#e11d48");
  expect(normalizeHex("  #Fff  ")).toBe("#ffffff");
});

test("normalizeHex fails closed on non-colors", () => {
  expect(normalizeHex("")).toBeNull();
  expect(normalizeHex("nope")).toBeNull();
  expect(normalizeHex("#12")).toBeNull();
  expect(normalizeHex("#1234567")).toBeNull();
  expect(normalizeHex("#gggggg")).toBeNull();
});

test("clamp01 pins to the unit interval", () => {
  expect(clamp01(-3)).toBe(0);
  expect(clamp01(0.42)).toBe(0.42);
  expect(clamp01(9)).toBe(1);
});

test("hexToHsv reads a pure hue", () => {
  const red = hexToHsv("#ff0000");
  expect(red.h).toBeCloseTo(0, 5);
  expect(red.s).toBeCloseTo(1, 5);
  expect(red.v).toBeCloseTo(1, 5);
});

test("hexToHsv reads black and white without dividing by zero", () => {
  expect(hexToHsv("#000000")).toEqual({ h: 0, s: 0, v: 0 });
  const white = hexToHsv("#ffffff");
  expect(white.s).toBeCloseTo(0, 5);
  expect(white.v).toBeCloseTo(1, 5);
});

test("hexToHsv tolerates garbage as black (never throws)", () => {
  expect(hexToHsv("not-a-color")).toEqual({ h: 0, s: 0, v: 0 });
});

test("hexToHsv -> hsvToHex round-trips real colors", () => {
  for (const hex of ["#e11d48", "#f59e0b", "#10b981", "#8b5cf6", "#3b82f6", "#123456", "#abcdef"]) {
    expect(hsvToHex(hexToHsv(hex))).toBe(hex);
  }
});

test("hsvToHex wraps hue and clamps out-of-range axes", () => {
  expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe(hsvToHex({ h: 0, s: 1, v: 1 }));
  expect(hsvToHex({ h: -120, s: 1, v: 1 })).toBe(hsvToHex({ h: 240, s: 1, v: 1 }));
  expect(hsvToHex({ h: 0, s: 5, v: 5 })).toBe("#ff0000");
});
