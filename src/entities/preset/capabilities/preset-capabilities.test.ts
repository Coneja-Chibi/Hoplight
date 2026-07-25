/** Preset semantic bundle coverage for settings, blocks, groups, and escrow safety. */
import { expect, test } from "bun:test";
import type { CanonicalPreset } from "../schema";
import settings from "./settings";
import blocks from "./blocks";
import groups from "./groups";

const preset = (): CanonicalPreset => ({
  schemaVersion: "1",
  kind: "preset",
  id: "careful",
  body: {
    name: "Careful",
    prompts: [{
      id: "main",
      name: "Main",
      content: "Be precise.",
      role: "system",
      enabled: true,
      systemPrompt: true,
      marker: false,
      placement: "relative",
      injectionDepth: 4,
      injectionOrder: 100,
      forbidOverrides: false,
      extras: { sealed: 7 },
    }],
  },
  original: { "st-preset": { raw: { private: true } } },
});

test("settings patch exact sampler fields and remove absent values", () => {
  const before = preset();
  const first = settings.preview(before, settings.input.parse({
    target: { id: "careful" },
    patch: { description: "Visible defaults", temperature: 0.7, maxTokens: 800 },
  }));
  expect(first.entity.body.samplers).toEqual({ temperature: 0.7, maxTokens: 800 });
  const cleared = settings.preview(first.entity, settings.input.parse({
    target: { id: "careful" },
    patch: { temperature: null },
  }));
  expect(cleared.entity.body.samplers).toEqual({ maxTokens: 800 });
  expect(cleared.entity.original).toEqual(before.original);
});

test("block operations overlay one block and preserve extras", () => {
  const before = preset();
  const updated = blocks.preview(before, blocks.input.parse({
    target: { id: "careful" },
    operation: { type: "update", id: "main", patch: { content: "Be exact.", enabled: false } },
  }));
  expect(updated.entity.body.prompts[0]).toMatchObject({
    content: "Be exact.",
    enabled: false,
    extras: { sealed: 7 },
  });
  const added = blocks.preview(updated.entity, blocks.input.parse({
    target: { id: "careful" },
    operation: {
      type: "add",
      block: {
        id: "history",
        name: "History",
        content: "",
        role: "system",
        enabled: true,
        systemPrompt: false,
        marker: true,
        markerSlot: "chatHistory",
        placement: "relative",
        injectionDepth: 4,
        injectionOrder: 100,
        forbidOverrides: false,
      },
    },
  }));
  expect(added.entity.body.prompts.map((item) => item.id)).toEqual(["main", "history"]);
});

test("group lifecycle updates block membership without orphaning removed groups", () => {
  const before = preset();
  const added = groups.preview(before, groups.input.parse({
    target: { id: "careful" },
    operation: { type: "add", group: { id: "core", name: "Core", order: 1 } },
  }));
  const assigned = blocks.preview(added.entity, blocks.input.parse({
    target: { id: "careful" },
    operation: { type: "set-group", id: "main", groupId: "core" },
  }));
  expect(assigned.entity.body.prompts[0]?.groupId).toBe("core");
  const removed = groups.preview(assigned.entity, groups.input.parse({
    target: { id: "careful" },
    operation: { type: "remove", id: "core" },
  }));
  expect(removed.entity.body.groups).toBeUndefined();
  expect(removed.entity.body.prompts[0]?.groupId).toBeUndefined();
});
