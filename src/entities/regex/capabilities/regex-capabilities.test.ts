/** Standalone regex semantic bundle coverage; rules remain stored data and escrow stays sealed. */
import { expect, test } from "bun:test";
import type { CanonicalRegexSet } from "../schema";
import settings from "./settings";
import rules from "./rules";

const entity = (): CanonicalRegexSet => ({
  schemaVersion: "1",
  kind: "regex",
  id: "cleanup",
  body: {
    name: "Cleanup",
    rules: [{
      id: "brackets",
      label: "Brackets",
      find: "\\[(.*?)\\]",
      flags: "g",
      replace: "$1",
      phases: ["output"],
      enabled: true,
      sortOrder: 10,
      extras: { wireId: 7 },
    }],
  },
  original: { sillytavern: { raw: { sealed: true } } },
});

test("set metadata and overlay a rule without executing or rebuilding it", () => {
  const before = entity();
  const named = settings.preview(before, settings.input.parse({
    target: { id: "cleanup" },
    patch: { description: "Display cleanup", enabled: false },
  }));
  const edited = rules.preview(named.entity, rules.input.parse({
    target: { id: "cleanup" },
    operation: {
      type: "update",
      id: "brackets",
      patch: { find: "\\((.*?)\\)", phases: ["input", "output"] },
    },
  }));
  expect(edited.entity.body.rules[0]).toMatchObject({
    find: "\\((.*?)\\)",
    phases: ["input", "output"],
    extras: { wireId: 7 },
  });
  expect(edited.entity.body.enabled).toBe(false);
  expect(edited.entity.original).toEqual(before.original);
});
