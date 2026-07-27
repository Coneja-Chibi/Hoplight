/**
 * The export-time macro question. These tests pin the honest boundary as hard as the happy path:
 * an unmodeled target must report `checked: false` rather than an empty finding list, because an
 * empty list read as "clean" is the exact failure this module exists to prevent.
 */
import { describe, expect, test } from "bun:test";
import {
  checkPresetMacroTransfer,
  profileForPresetAdapter,
} from "./transfer-check";

const preset = (...contents: string[]): unknown => ({
  prompts: contents.map((content, index) => ({
    id: `block-${index}`,
    name: `Block ${index}`,
    content,
  })),
});

describe("profileForPresetAdapter", () => {
  test("maps the four modeled preset engines", () => {
    expect(profileForPresetAdapter("rolecall-preset")).toBe("rolecall");
    expect(profileForPresetAdapter("sillytavern-preset")).toBe("sillytavern");
    expect(profileForPresetAdapter("marinara-preset")).toBe("marinara");
    expect(profileForPresetAdapter("lumiverse-preset")).toBe("lumiverse");
  });

  test("an unmodeled engine resolves to null, never a default lens", () => {
    expect(profileForPresetAdapter("risu-preset")).toBeNull();
    expect(profileForPresetAdapter("")).toBeNull();
  });
});

describe("checkPresetMacroTransfer", () => {
  test("flags a macro the target engine has no name for", () => {
    const report = checkPresetMacroTransfer(
      preset("Hello {{char}}, your creator is {{charCreator}}."),
      "sillytavern-preset",
    );
    expect(report.checked).toBe(true);
    expect(report.target).toBe("sillytavern");
    expect(report.findings.map((f) => f.token)).toEqual(["{{charCreator}}"]);
    expect(report.findings[0]?.status).toBe("dies");
    expect(report.findings[0]?.where).toBe("Block 0");
  });

  test("leaves macros the target really carries alone", () => {
    const report = checkPresetMacroTransfer(
      preset("{{char}} and {{user}} in {{scenario}}"),
      "sillytavern-preset",
    );
    expect(report.findings).toEqual([]);
    expect(report.checked).toBe(true);
  });

  test("reports the location per block so a fix is actionable", () => {
    const report = checkPresetMacroTransfer(
      preset("plain text", "{{accentColor}} here"),
      "sillytavern-preset",
    );
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.where).toBe("Block 1");
  });

  test("an unmodeled target reports unchecked, not clean", () => {
    const report = checkPresetMacroTransfer(
      preset("{{charCreator}} would die on most engines"),
      "risu-preset",
    );
    expect(report.checked).toBe(false);
    expect(report.target).toBeNull();
    expect(report.findings).toEqual([]);
    expect(report.limits.join(" ")).toContain("not a compatibility claim");
  });

  test("a checked report always carries its name-level caveat", () => {
    const report = checkPresetMacroTransfer(preset("{{char}}"), "rolecall-preset");
    expect(report.checked).toBe(true);
    expect(report.limits.join(" ")).toContain("{{random::a::b}}");
  });

  test("a body with no prompts is empty, not an error", () => {
    expect(checkPresetMacroTransfer({}, "sillytavern-preset").findings).toEqual([]);
    expect(checkPresetMacroTransfer(null, "sillytavern-preset").checked).toBe(true);
  });
});
