import { test, expect } from "bun:test";
import { normalizeSchema, schemaToWire } from "./core";

test("normalize and wire fields", () => {
  const n = normalizeSchema({
    schema: [{ name: "mood", type: "string", description: "tone" }],
    systemPrompt: "sys",
  });
  expect(n.fields[0]?.name).toBe("mood");
  expect(schemaToWire(n).systemPrompt).toBe("sys");
  expect((schemaToWire(n).schema as { name: string }[])[0]?.name).toBe("mood");
});
