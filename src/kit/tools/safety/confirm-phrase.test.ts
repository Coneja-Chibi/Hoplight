/** Type-to-confirm phrase tests for destructive actions and malformed input. */
import { expect, test } from "bun:test";
import { requiredPhrase, matchesConfirm } from "./confirm-phrase";

test("requiredPhrase builds 'verb count', with safe fallbacks", () => {
  expect(requiredPhrase("delete", 12)).toBe("delete 12");
  expect(requiredPhrase("Delete", 12)).toBe("delete 12");
  expect(requiredPhrase("", 0)).toBe("confirm 0");
  expect(requiredPhrase("delete", -3)).toBe("delete 0");
});

test("matchesConfirm is exact but whitespace- and case-tolerant", () => {
  expect(matchesConfirm("delete 12", "delete 12")).toBe(true);
  expect(matchesConfirm("delete 12", "  Delete   12 ")).toBe(true);
  expect(matchesConfirm("delete 12", "delete 13")).toBe(false);
  expect(matchesConfirm("delete 12", "delete")).toBe(false);
  expect(matchesConfirm("delete 12", "")).toBe(false);
});

test("matchesConfirm denies ragged input (blank / non-string), never throws", () => {
  expect(matchesConfirm("", "")).toBe(false);
  expect(matchesConfirm("delete 12", 12 as unknown)).toBe(false);
  expect(matchesConfirm(null as unknown, "delete 12")).toBe(false);
});
