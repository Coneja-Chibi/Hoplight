/**
 * The resolved live preview: engine-truth ordering + closed-world macro resolution, with
 * segment provenance back into each block's authored content (the editable-preview contract).
 */
import { describe, expect, test } from "bun:test";
import type { PresetBody, PresetPrompt } from "../../entities/preset";
import { renderLivePreview } from "./live-render";

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

describe("renderLivePreview", () => {
  test("resolves macros with the stub identity and keeps block provenance", () => {
    const content = "You are {{char}} talking to {{user}}.";
    const render = renderLivePreview(body([block({ id: "sys", content })]));
    const line = render.lines[0];
    if (!line) throw new Error("expected a line");
    expect(line.resolved).toBe("You are Character talking to User.");
    expect(line.id).toBe("sys");
    // every segment's source range points into the AUTHORED content of that block
    for (const seg of line.segments) {
      if (seg.kind === "macro") {
        expect(content.slice(seg.sourceStart, seg.sourceEnd)).toBe(seg.raw);
      } else {
        expect(content.slice(seg.sourceStart, seg.sourceEnd)).toBe(seg.value);
      }
    }
  });

  test("variables thread across blocks in build order", () => {
    const render = renderLivePreview(
      body([
        block({ id: "a", content: "{{setvar::tone::grim}}", injectionOrder: 1 }),
        block({ id: "b", content: "Tone: {{getvar::tone}}", injectionOrder: 2 }),
      ]),
    );
    expect(render.lines[1]?.resolved).toBe("Tone: grim");
  });

  test("markers keep their label and render no segments", () => {
    const render = renderLivePreview(body([block({ id: "m", marker: true, markerSlot: "chatHistory" })]));
    expect(render.lines[0]?.resolved).toContain("splices in here");
    expect(render.lines[0]?.segments).toEqual([]);
  });

  test("chat macros render the stub conversation, identity substituted", () => {
    const render = renderLivePreview(
      body([block({ id: "c", content: "Last said: {{lastusermessage}}" })]),
      { userName: "Chi" },
    );
    expect(render.lines[0]?.resolved).toBe("Last said: Chi's test message");
  });

  test("the clock arrives as a value and never gets invented", () => {
    const b = body([block({ id: "t", content: "{{isodate}}" })]);
    const clocked = renderLivePreview(b, { now: 1787841045000, timezone: "UTC" });
    expect(clocked.lines[0]?.resolved).toBe("2026-08-27");
    const unclocked = renderLivePreview(b);
    expect(unclocked.lines[0]?.resolved).toBe("");
  });

  test("the same seed replays the same roll; a volatile render says so", () => {
    const b = body([block({ id: "r", content: "{{random::a::b::c}}" })]);
    const one = renderLivePreview(b, { randomSeed: 7 });
    const two = renderLivePreview(b, { randomSeed: 7 });
    expect(one.lines[0]?.resolved).toBe(two.lines[0]?.resolved ?? "");
    expect(one.volatile).toBe(true);
  });
});
