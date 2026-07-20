/** Regression coverage for the follow-core.test behavior owned beside this file. */
import { expect, test } from "bun:test";
import { decideFollow } from "./follow-core";

test("already on the Workbench surfaces the piece regardless of preference", () => {
  expect(decideFollow(true, "always")).toBe("surface");
  expect(decideFollow(true, "never")).toBe("surface");
  expect(decideFollow(true, "ask")).toBe("surface");
  expect(decideFollow(true, undefined)).toBe("surface");
});

test("off the Workbench, the saved preference rules", () => {
  expect(decideFollow(false, "always")).toBe("navigate");
  expect(decideFollow(false, "never")).toBe("note");
  expect(decideFollow(false, "ask")).toBe("ask");
});

test("off the Workbench, an unset or garbage preference falls to ask (never a silent jump)", () => {
  expect(decideFollow(false, undefined)).toBe("ask");
  expect(decideFollow(false, "")).toBe("ask");
  expect(decideFollow(false, "sometimes")).toBe("ask");
});
