/**
 * Whether thinking is ECHOED is the provider's answer, and these pin both halves of that.
 *
 * A DeepSeek-style reasoning backend rejects a history whose assistant turns lost the
 * reasoning_content they originally produced ("The reasoning_content in the thinking mode must be
 * passed back to the API"). Kit keeps the thought with the message, but only a spoke whose adapter
 * carries the reasoning part back onto the wire may declare it echoes; every other adapter either
 * signature-gates the block (anthropic, google), folds it into the visible text (mistral), or drops
 * it silently (openai chat-completions), so for those the safe default is to leave the wire alone.
 */
import { describe, expect, test } from "bun:test";
import { loadSpokes } from "./registry";

describe("reasoning echo capability", () => {
  test("the openai-compatible family and reasoning-aware SDKs declare it", async () => {
    const spokes = await loadSpokes();
    const declared = [...spokes.values()].filter((spoke) => spoke.reasoningEcho === true)
      .map((speak) => speak.id).sort();
    // Each of these maps an assistant reasoning part onto its request (reasoning_content for the
    // openai-compatible family, a `reasoning` field for OpenRouter and Groq). A spoke gaining the
    // echo adds one line and this list; the point is that the answer lives in the spoke file.
    expect(declared).toEqual(["custom", "deepseek", "groq", "local", "nanogpt", "openrouter"]);
  });

  test("absent means no, so an undeclared provider never gets thinking attached", async () => {
    const spokes = await loadSpokes();
    // Mistral's adapter FOLDS a reasoning part into the assistant text: echoing would corrupt the
    // wire message, so it must stay silent regardless of what Kit stored.
    const mistral = spokes.get("mistral");
    expect(mistral).toBeDefined();
    expect(mistral?.reasoningEcho).toBeUndefined();
    expect(mistral?.reasoningEcho === true).toBe(false);
    const google = spokes.get("google");
    expect(google?.reasoningEcho).toBeUndefined();
  });

  test("every spoke that declares it declares it as a literal true", async () => {
    // Guards against a truthy-but-not-true value creeping in, since the whole system compares `=== true`.
    for (const spoke of (await loadSpokes()).values()) {
      if (spoke.reasoningEcho !== undefined) expect(spoke.reasoningEcho).toBe(true);
    }
  });
});