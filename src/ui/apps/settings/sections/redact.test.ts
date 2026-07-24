/** Tests for the screenshot-redaction mask: hide identifying characters, keep the shape readable. */
import { expect, test } from "bun:test";
import { mask } from "./redact";

test("mask replaces letters and digits but keeps separators", () => {
  expect(mask("NA5-VH3-CK2")).toBe("•••-•••-•••");
  expect(mask("https://10.0.0.207:8790")).toBe("•••••://••.•.•.•••:••••");
  expect(mask("hoplight-studio.tail07fed6.ts.net")).toBe(
    "••••••••-••••••.••••••••••.••.•••",
  );
});

test("mask leaves a value with no alphanumerics untouched", () => {
  expect(mask("::--..")).toBe("::--..");
  expect(mask("")).toBe("");
});
