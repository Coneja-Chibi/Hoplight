/**
 * Model-discovery core: every wire shape RC saw in the wild must parse, garbage must yield [], and
 * the URL ladder must respect explicit /models URLs and versioned bases.
 */
import { describe, expect, test } from "bun:test";
import { formatContext, modelsUrlLadder, parseModelsPayload } from "./models";

describe("parseModelsPayload", () => {
  test("openai-style {data:[...]} with context sniffing", () => {
    const models = parseModelsPayload({
      data: [
        { id: "b-model", context_length: 128000 },
        { id: "a-model", context_window: 200000 },
      ],
    });
    expect(models).toEqual([
      { id: "a-model", context: 200000 },
      { id: "b-model", context: 128000 },
    ]);
  });

  test("bare arrays and anthropic display_name", () => {
    const models = parseModelsPayload([{ id: "claude-opus-4-8", display_name: "Claude Opus 4.8" }]);
    expect(models).toEqual([{ id: "claude-opus-4-8", label: "Claude Opus 4.8" }]);
  });

  test("google-style {models:[...]} with name and inputTokenLimit", () => {
    const models = parseModelsPayload({
      models: [{ name: "models/gemini-2.5-pro", displayName: "Gemini 2.5 Pro", inputTokenLimit: 1048576 }],
    });
    expect(models).toEqual([
      { id: "models/gemini-2.5-pro", label: "Gemini 2.5 Pro", context: 1048576 },
    ]);
  });

  test("dedupes ids and drops junk entries", () => {
    const models = parseModelsPayload({ data: [{ id: "x" }, { id: "x" }, { nope: true }, 42] });
    expect(models).toEqual([{ id: "x" }]);
  });

  test("garbage yields [] and never throws", () => {
    expect(parseModelsPayload(null)).toEqual([]);
    expect(parseModelsPayload("nonsense")).toEqual([]);
    expect(parseModelsPayload({ data: "not-an-array" })).toEqual([]);
  });
});

describe("modelsUrlLadder", () => {
  test("unversioned base gets the /v1 ladder, detailed first", () => {
    expect(modelsUrlLadder("https://proxy.example")).toEqual([
      "https://proxy.example/v1/models?detailed=true",
      "https://proxy.example/v1/models",
      "https://proxy.example/models",
    ]);
  });

  test("versioned base skips the /v1 insert", () => {
    expect(modelsUrlLadder("https://nano-gpt.com/api/v1")).toEqual([
      "https://nano-gpt.com/api/v1/models?detailed=true",
      "https://nano-gpt.com/api/v1/models",
    ]);
  });

  test("a pasted chat endpoint is stripped, an explicit models URL is used as-is", () => {
    expect(modelsUrlLadder("https://proxy.example/v1/chat/completions")).toEqual([
      "https://proxy.example/v1/models?detailed=true",
      "https://proxy.example/v1/models",
    ]);
    expect(modelsUrlLadder("https://proxy.example/v1/models")).toEqual(["https://proxy.example/v1/models"]);
  });
});

describe("formatContext", () => {
  test("chips", () => {
    expect(formatContext(1048576)).toBe("1M");
    expect(formatContext(128000)).toBe("128K");
    expect(formatContext(4096)).toBe("4K");
    expect(formatContext(undefined)).toBe("");
  });
});
