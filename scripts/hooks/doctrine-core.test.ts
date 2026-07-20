/** Tests the pure doctrine predicates used by the repository-wide enforcement shell. */
import { describe, expect, test } from "bun:test";
import { containsEmoji, hasOpeningDocblock } from "./doctrine-core";

describe("opening docblocks", () => {
  test("requires the documentation block at byte zero", () => {
    expect(hasOpeningDocblock("/** Why. */\nexport {};\n")).toBe(true);
    expect(hasOpeningDocblock("\uFEFF/** Why. */\nexport {};\n")).toBe(true);
    expect(hasOpeningDocblock("#!/usr/bin/env bun\n/** Why. */\n")).toBe(true);
    expect(hasOpeningDocblock("// Why.\nexport {};\n")).toBe(false);
    expect(hasOpeningDocblock("\n/** Too late. */\n")).toBe(false);
  });
});

describe("emoji detection", () => {
  test("finds pictographs without flagging ordinary punctuation", () => {
    expect(containsEmoji("release ready \u{1F3AF}")).toBe(true);
    expect(containsEmoji("release ready: yes.")).toBe(false);
  });
});
