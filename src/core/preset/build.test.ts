/**
 * P2 assembly engine: pure, canonical-only, unit-tested against hand-built PresetBodies (no fixture
 * needed - the codec + its real-file round-trip are P5).
 */
import { describe, expect, test } from "bun:test";
import type { PresetBody, PresetPrompt } from "../../entities/preset";
import { blockTokens, buildPreview, markerLabel, presetWeight } from "./build";

const block = (over: Partial<PresetPrompt>): PresetPrompt => ({
  id: over.id ?? "b",
  name: over.name ?? "Block",
  content: over.content ?? "",
  role: over.role ?? "system",
  enabled: over.enabled ?? true,
  systemPrompt: over.systemPrompt ?? false,
  marker: over.marker ?? false,
  placement: over.placement ?? "relative",
  injectionDepth: over.injectionDepth ?? 4,
  injectionOrder: over.injectionOrder ?? 100,
  forbidOverrides: over.forbidOverrides ?? false,
  ...over,
});

const body = (prompts: PresetPrompt[]): PresetBody => ({ name: "T", prompts });

describe("blockTokens", () => {
  test("chars/4, ceil", () => {
    expect(blockTokens(block({ content: "" }))).toBe(0);
    expect(blockTokens(block({ content: "abcd" }))).toBe(1);
    expect(blockTokens(block({ content: "abcde" }))).toBe(2);
  });

  test("a marker has no content weight (it reads 'slot', never a faked number)", () => {
    expect(blockTokens(block({ marker: true, markerSlot: "chatHistory", content: "ignored" }))).toBe(0);
  });
});

describe("presetWeight", () => {
  test("counts only enabled; sums tokens; finds the heaviest; flags in-chat", () => {
    const w = presetWeight(
      body([
        block({ id: "a", content: "aaaaaaaa" }), // 2 tok
        block({ id: "b", content: "bbbb", enabled: false }), // disabled, skipped
        block({ id: "c", content: "cccccccccccc", placement: "in_chat" }), // 3 tok, in-chat
        block({ id: "m", marker: true, markerSlot: "chatHistory" }), // 0 tok
      ]),
    );
    expect(w.totalCount).toBe(4);
    expect(w.enabledCount).toBe(3);
    expect(w.inChatCount).toBe(1);
    expect(w.tokens).toBe(5);
    expect(w.largest).toEqual({ id: "c", name: "Block", tokens: 3 });
  });
});

describe("buildPreview", () => {
  test("orders by placement rank then injectionOrder; disabled excluded", () => {
    const build = buildPreview(
      body([
        block({ id: "bottom", placement: "append_preset", injectionOrder: 10 }),
        block({ id: "rel2", placement: "relative", injectionOrder: 200 }),
        block({ id: "top", placement: "prepend_preset", injectionOrder: 999 }),
        block({ id: "rel1", placement: "relative", injectionOrder: 100 }),
        block({ id: "off", placement: "relative", injectionOrder: 1, enabled: false }),
      ]),
    );
    expect(build.lines.map((l) => l.id)).toEqual(["top", "rel1", "rel2", "bottom"]);
  });

  test("markers render a plain 'splices in here' label, never faked content", () => {
    const build = buildPreview(body([block({ marker: true, markerSlot: "chatHistory" })]));
    expect(build.lines[0]!.isMarker).toBe(true);
    expect(build.lines[0]!.text).toBe("the chat history splices in here");
    expect(build.lines[0]!.tokens).toBe(0);
    expect(markerLabel("scenario")).toBe("the scenario splices in here");
    expect(markerLabel("x-unknown")).toBe("x-unknown splices in here");
  });

  test("in_chat/append carry depth; relative does not", () => {
    const build = buildPreview(
      body([
        block({ id: "r", placement: "relative", injectionDepth: 7 }),
        block({ id: "c", placement: "in_chat", injectionDepth: 2 }),
      ]),
    );
    const byId = Object.fromEntries(build.lines.map((l) => [l.id, l]));
    expect(byId.r!.depth).toBeUndefined();
    expect(byId.c!.depth).toBe(2);
  });

  test("does not mutate the input array order", () => {
    const b = body([
      block({ id: "x", placement: "append_preset" }),
      block({ id: "y", placement: "prepend_preset" }),
    ]);
    buildPreview(b);
    expect(b.prompts.map((p) => p.id)).toEqual(["x", "y"]);
  });
});
