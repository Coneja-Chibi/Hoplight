/**
 * The friendly-name map is a hand list beside a drop-in registry, which is exactly how it rotted:
 * the bare `lumiverse` character adapter was missing, so the setup quiz's publish list showed
 * "lumiverse" and "Lumiverse" as two different platforms. This pin walks the LIVE registry, so a
 * new adapter without a friendly name fails the gate instead of leaking its raw id into the UI.
 */
import { describe, expect, test } from "bun:test";
import { loadFormats } from "../core";
import { friendlyFormat, unsupportedShapeLine } from "./receipt";

describe("friendlyFormat", () => {
  test("every registered adapter has a human name, never its raw id", async () => {
    const adapters = await loadFormats();
    const leaking = adapters.filter((a) => friendlyFormat(a.id) === a.id).map((a) => a.id);
    expect(leaking).toEqual([]);
  });

  test("an unknown id still degrades to itself instead of throwing", () => {
    expect(friendlyFormat("someday-format")).toBe("someday-format");
  });
});

describe("unsupportedShapeLine", () => {
  test("stays SILENT on completion presets - the sillytavern-preset codec imports them now", () => {
    expect(
      unsupportedShapeLine(JSON.stringify({ name: "P", extensions: {}, prompts: [], prompt_order: [], temperature: 1 })),
    ).toBeNull();
  });

  test("names the RoleCall library wrapper by its declared type", () => {
    expect(
      unsupportedShapeLine(JSON.stringify({ exportedAt: "t", type: "preset", version: "1.0", data: { temperature: 1 } })),
    ).toContain("RoleCall library export of a preset");
  });

  test("names instruct and context templates", () => {
    expect(
      unsupportedShapeLine(JSON.stringify({ name: "I", system_prompt: "x", input_sequence: "a", output_sequence: "b" })),
    ).toContain("instruct template");
    expect(unsupportedShapeLine(JSON.stringify({ name: "C", story_string: "{{system}}" }))).toContain(
      "context template",
    );
  });

  test("stays silent on strangers, garbage, and non-JSON (the generic line stands)", () => {
    expect(unsupportedShapeLine(JSON.stringify({ name: "A", description: "a card-ish thing" }))).toBeNull();
    expect(unsupportedShapeLine("not json")).toBeNull();
    expect(unsupportedShapeLine(JSON.stringify([1, 2, 3]))).toBeNull();
    expect(unsupportedShapeLine(undefined)).toBeNull();
  });
});
