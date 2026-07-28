/**
 * Splitting a block so a splice macro becomes the structural block a target actually uses.
 *
 * The risk here is not failing to promote - it is promoting wrongly. A macro moved to the wrong slot
 * relocates authored content to a different part of the prompt, which reads as the preset behaving
 * oddly rather than as a conversion error, and is far harder to trace than a macro that stayed put.
 * So these tests spend most of their weight on when promotion must NOT happen.
 */
import { describe, expect, test } from "bun:test";
import { markerSlotFor, promoteMarkers } from "./promote-markers";

const block = (content: string, id = "t", name = "Transcript"): unknown => ({
  id, name, content, role: "system", enabled: true, marker: false, placement: "relative",
});
const prompts = (body: unknown): Record<string, unknown>[] =>
  ((body as { prompts?: unknown[] }).prompts ?? []) as Record<string, unknown>[];

describe("a spliced macro becomes a marker between what surrounded it", () => {
  const out = promoteMarkers(
    { prompts: [block("Recent events:\n{{message_history}}\nRespond in character.")] },
    ["{{message_history}}"],
  );

  test("one block becomes three, in the order the text had", () => {
    expect(prompts(out.body).map((p) => p["id"])).toEqual(["t-before", "chatHistory", "t-after"]);
  });

  test("the marker carries the slot and no content of its own", () => {
    const marker = prompts(out.body)[1]!;
    expect(marker["marker"]).toBe(true);
    expect(marker["markerSlot"]).toBe("chatHistory");
    expect(marker["content"]).toBe("");
  });

  test("the surrounding text is kept, not discarded", () => {
    expect(prompts(out.body)[0]?.["content"]).toBe("Recent events:");
    expect(prompts(out.body)[2]?.["content"]).toBe("Respond in character.");
  });

  test("the split is recorded rather than done silently", () => {
    expect(out.promotions).toEqual([
      { block: "Transcript", token: "{{message_history}}", markerSlot: "chatHistory", became: 3 },
    ]);
  });

  test("a macro alone in its block becomes just the marker", () => {
    const only = promoteMarkers({ prompts: [block("{{message_history}}")] }, ["{{message_history}}"]);
    expect(prompts(only.body).map((p) => p["id"])).toEqual(["chatHistory"]);
  });
});

describe("when promotion must not happen", () => {
  test("a macro the target can still run is left exactly where it is", () => {
    // Restructuring a working preset for no reason is a worse outcome than doing nothing.
    const out = promoteMarkers({ prompts: [block("a {{message_history}} b")] }, []);
    expect(out.promotions).toEqual([]);
    expect(prompts(out.body)).toHaveLength(1);
  });

  test("a dead macro that matches no slot is left for a person to place", () => {
    const out = promoteMarkers({ prompts: [block("a {{accentColor}} b")] }, ["{{accentColor}}"]);
    expect(out.promotions).toEqual([]);
    expect(markerSlotFor("{{accentColor}}")).toBeNull();
  });

  test("an ambiguous name is refused rather than guessed", () => {
    // "character" appears in more than one canonical slot, so no single slot is meant.
    expect(markerSlotFor("{{character_stuff}}")).toBeNull();
  });

  test("a body with no prompts is returned unchanged", () => {
    expect(promoteMarkers({}, ["{{message_history}}"]).promotions).toEqual([]);
    expect(promoteMarkers(null, []).body).toBeNull();
  });
});

test("the input body is never mutated", () => {
  const original = { prompts: [block("x {{message_history}} y")] };
  promoteMarkers(original, ["{{message_history}}"]);
  expect(original.prompts).toHaveLength(1);
});
