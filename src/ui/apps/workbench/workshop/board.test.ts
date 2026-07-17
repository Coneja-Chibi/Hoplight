/**
 * Workshop board ordering + export honesty.
 */
import { test, expect } from "bun:test";
import {
  EMPTY_VARS_MESSAGE,
  exportLossWarning,
  orderDeltaMovedFirst,
  orderVarsMovedFirst,
  PACKAGE_BANNER,
} from "./board";

test("orderVarsMovedFirst floats moved names", () => {
  const vars = [
    { name: "mood", value: "ok" },
    { name: "hp", value: "90" },
    { name: "day", value: "1" },
  ];
  const next = orderVarsMovedFirst(vars, new Set(["hp"]));
  expect(next.map((v) => v.name)).toEqual(["hp", "mood", "day"]);
});

test("orderDeltaMovedFirst puts moved first", () => {
  const delta = [
    { name: "a", before: "1", after: "1", moved: false },
    { name: "b", before: "1", after: "2", moved: true },
  ];
  expect(orderDeltaMovedFirst(delta)[0]?.name).toBe("b");
});

test("exportLossWarning silent when no behavior", () => {
  expect(exportLossWarning({ hasBehavior: false, hasPackage: false, targets: ["sillytavern"] })).toBeNull();
});

test("exportLossWarning when lens off Risu with package", () => {
  const w = exportLossWarning({ hasBehavior: true, hasPackage: true, targets: ["sillytavern"] });
  expect(w).toBeTruthy();
  expect(w!).toMatch(/drop the package/i);
});

test("exportLossWarning soft when aiming Risu with package", () => {
  const w = exportLossWarning({ hasBehavior: true, hasPackage: true, targets: ["risu"] });
  expect(w).toBeTruthy();
  expect(w!).toMatch(/Risu/i);
});

test("package empty-vars constants are non-empty", () => {
  expect(EMPTY_VARS_MESSAGE.length).toBeGreaterThan(20);
  expect(PACKAGE_BANNER.length).toBeGreaterThan(20);
});
