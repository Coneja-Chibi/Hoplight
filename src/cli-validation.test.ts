/** Regression proof for the CLI's adapter-to-canonical validation boundary. */
import { expect, test } from "bun:test";
import type { FormatAdapter } from "./core";
import { validateAdapterOutput } from "./cli-validation";

test("rejects adapter output that has a recognizable envelope but an invalid nested body", () => {
  const adapter = {
    toCanonical: () => ({
      schemaVersion: "1",
      kind: "regex",
      id: "broken",
      body: {
        name: "Broken",
        rules: [{
          id: "rule",
          label: "Rule",
          find: "x",
          flags: "g",
          replace: "y",
          phases: ["output"],
          enabled: "yes",
          sortOrder: 0,
        }],
      },
    }),
  } as unknown as FormatAdapter;

  expect(() => validateAdapterOutput(adapter, { text: "{}" })).toThrow();
});

test("rejects valid canonical output whose kind contradicts the adapter contract", () => {
  const adapter = {
    id: "lying-regex",
    kind: "regex",
    toCanonical: () => ({
      schemaVersion: "1",
      kind: "persona",
      id: "wrong-kind",
      body: { name: "Wrong kind", content: "" },
    }),
  } as unknown as FormatAdapter;

  expect(() => validateAdapterOutput(adapter, { text: "{}" })).toThrow(
    'lying-regex: adapter declared kind "regex" but produced "persona"',
  );
});
