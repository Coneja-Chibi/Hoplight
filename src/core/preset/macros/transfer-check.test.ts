/**
 * The export-time macro question. These tests pin the honest boundary as hard as the happy path:
 * an unmodeled target must report `checked: false` rather than an empty finding list, because an
 * empty list read as "clean" is the exact failure this module exists to prevent.
 */
import { describe, expect, test } from "bun:test";
import {
  checkMacroTransfer,
  profileForAdapter,
} from "./transfer-check";

const preset = (...contents: string[]): unknown => ({
  prompts: contents.map((content, index) => ({
    id: `block-${index}`,
    name: `Block ${index}`,
    content,
  })),
});

describe("profileForAdapter", () => {
  test("maps the four modeled preset engines", () => {
    expect(profileForAdapter("rolecall-preset")).toBe("rolecall");
    expect(profileForAdapter("sillytavern-preset")).toBe("sillytavern");
    expect(profileForAdapter("marinara-preset")).toBe("marinara");
    expect(profileForAdapter("lumiverse-preset")).toBe("lumiverse");
  });

  test("an unmodeled engine resolves to null, never a default lens", () => {
    expect(profileForAdapter("risu-preset")).toBeNull();
    expect(profileForAdapter("")).toBeNull();
  });
});

describe("checkMacroTransfer", () => {
  test("flags a macro the target engine has no name for", () => {
    const report = checkMacroTransfer(
      preset("Hello {{char}}, your creator is {{charCreator}}."),
      "sillytavern-preset",
    );
    expect(report.checked).toBe(true);
    expect(report.target).toBe("sillytavern");
    expect(report.findings.map((f) => f.token)).toEqual(["{{charCreator}}"]);
    expect(report.findings[0]?.status).toBe("dies");
    expect(report.findings[0]?.where).toBe("prompts[Block 0].content");
  });

  test("leaves macros the target really carries alone", () => {
    const report = checkMacroTransfer(
      preset("{{char}} and {{user}} in {{scenario}}"),
      "sillytavern-preset",
    );
    expect(report.findings).toEqual([]);
    expect(report.checked).toBe(true);
  });

  test("reports the location per block so a fix is actionable", () => {
    const report = checkMacroTransfer(
      preset("plain text", "{{accentColor}} here"),
      "sillytavern-preset",
    );
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.where).toBe("prompts[Block 1].content");
  });

  test("an unmodeled target reports unchecked, not clean", () => {
    const report = checkMacroTransfer(
      preset("{{charCreator}} would die on most engines"),
      "risu-preset",
    );
    expect(report.checked).toBe(false);
    expect(report.target).toBeNull();
    expect(report.findings).toEqual([]);
    expect(report.limits.join(" ")).toContain("not a compatibility claim");
  });

  test("a checked report always carries its name-level caveat", () => {
    const report = checkMacroTransfer(preset("{{char}}"), "rolecall-preset");
    expect(report.checked).toBe(true);
    expect(report.limits.join(" ")).toContain("{{random::a::b}}");
  });

  test("a body with no prompts is empty, not an error", () => {
    expect(checkMacroTransfer({}, "sillytavern-preset").findings).toEqual([]);
    expect(checkMacroTransfer(null, "sillytavern-preset").checked).toBe(true);
  });
});
