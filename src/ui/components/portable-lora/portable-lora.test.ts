/**
 * Portable LoRA normalize: filename + weight; empty clears to null.
 */
import { test, expect } from "bun:test";
import { normalizePortableLora } from "./index";

test("normalize maps weight_model alias and forces version 1", () => {
  const n = normalizePortableLora({
    lora_name: "x.safetensors",
    weight_model: 0.7,
    base_tags: "solo",
  });
  expect(n).toEqual({
    version: 1,
    lora_filename: "x.safetensors",
    weight: 0.7,
    base_tags: "solo",
    source_url: undefined,
  });
});

test("normalize empty object is null", () => {
  expect(normalizePortableLora({})).toBeNull();
  expect(normalizePortableLora(null)).toBeNull();
});
