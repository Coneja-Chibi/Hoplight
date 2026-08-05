/**
 * Whether a picture is SENT is the provider's answer, and these pin both halves of that.
 *
 * Kit captioned every pasted image "shown to you only - Kit's providers take text", which was a
 * blanket claim about other people's software and false for most of them. The fix is a declaration
 * per spoke, so the two failures worth preventing are opposite: dropping an image a provider would
 * have read, and attaching one to a model that errors on it.
 */
import { describe, expect, test } from "bun:test";
import { loadSpokes } from "./registry";

describe("image capability", () => {
  test("a spoke declares it rather than Kit assuming", async () => {
    const spokes = await loadSpokes();
    const declared = [...spokes.values()].filter((spoke) => spoke.images === true).map((s) => s.id).sort();
    // The providers whose default model reads images. A spoke gaining vision adds one line and this
    // list; the point is that the answer lives in the spoke file, not in the renderer.
    expect(declared).toEqual(["anthropic", "codex", "google", "openai"]);
  });

  test("absent means no, so an undeclared provider never gets one attached", async () => {
    const spokes = await loadSpokes();
    const quiet = spokes.get("deepseek");
    expect(quiet).toBeDefined();
    // Not `false` - absent. The default has to be the safe one without every spoke restating it.
    expect(quiet?.images).toBeUndefined();
    expect(quiet?.images === true).toBe(false);
  });

  test("every spoke that declares it declares it as a literal true", async () => {
    // Guards against a truthy-but-not-true value creeping in, since the whole system compares `=== true`.
    for (const spoke of (await loadSpokes()).values()) {
      if (spoke.images !== undefined) expect(spoke.images).toBe(true);
    }
  });
});
